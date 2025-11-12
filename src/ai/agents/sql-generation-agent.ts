import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { buildSqlPrompt } from '../prompts/sql-agent.prompt';
import { ChatSession, SqlGenerationResult } from '../types/chat.types';
import { getCompleteDatabaseSchema } from '../utils/schema-provider';
import { serializeBigInt } from '../utils/serializer';
import { isAggregateQuery, validateSqlSafety } from '../utils/sql-safety';

export interface AiConfig {
	temperature: number;
	maxTokens: number;
	limit: number;
	model: string;
}

/**
 * Agent 2: SQL Generation Agent - Generates and executes SQL when ready with RAG context
 */
export class SqlGenerationAgent {
	private readonly logger = new Logger(SqlGenerationAgent.name);

	constructor(private readonly knowledgeService?: KnowledgeService) {}

	/**
	 * Extract and format Prisma error message for better AI understanding
	 * Prisma errors have format: Invalid `prisma.$queryRawUnsafe()` invocation: Raw query failed. Code: `42P01`. Message: `relation "table_name" does not exist`
	 * @param error - Error object from Prisma
	 * @returns Formatted error message
	 */
	private extractPrismaErrorMessage(error: unknown): string {
		if (!(error instanceof Error)) {
			return String(error);
		}
		const errorMessage = error.message;
		// Extract PostgreSQL error code and message from Prisma error format
		// Format: Invalid `prisma.$queryRawUnsafe()` invocation: Raw query failed. Code: `42P01`. Message: `relation "table_name" does not exist`
		const codeMatch = errorMessage.match(/Code:\s*`([^`]+)`/);
		const messageMatch = errorMessage.match(/Message:\s*`([^`]+)`/);
		if (codeMatch && messageMatch) {
			const code = codeMatch[1];
			const message = messageMatch[1];
			// Format error for AI: include code and clear message
			return `PostgreSQL Error ${code}: ${message}`;
		}
		// Fallback: return original message
		return errorMessage;
	}

	/**
	 * Generate and execute SQL with conversation context, retry logic and security
	 * @param query - User query
	 * @param session - Chat session for context
	 * @param prisma - Prisma service
	 * @param aiConfig - AI configuration
	 * @param businessContext - Business context from orchestrator agent
	 * @returns SQL execution result
	 */
	async process(
		query: string,
		session: ChatSession,
		prisma: PrismaService,
		aiConfig: AiConfig,
		businessContext?: string,
	): Promise<SqlGenerationResult> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-5)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const userId = session.userId;
		// Get user role if authenticated - AI will handle security via prompt
		let userRole: string | undefined;
		if (userId) {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { role: true },
			});
			userRole = user?.role ?? undefined;
		}
		// Step A: RAG Retrieval - Get relevant schema and QA chunks
		let ragContext = '';
		let canonicalDecision: any = null;
		if (this.knowledgeService) {
			try {
				// Check for canonical SQL to use as hint (never execute directly)
				// Always regenerate SQL based on current schema to handle schema changes
				canonicalDecision = await this.knowledgeService.decideCanonicalReuse(query, {
					hard: 0.95, // Very high threshold - only exact matches
					soft: 0.8, // Use as hint for similar queries
				});
				// NOTE: We never execute canonical SQL directly anymore
				// Always regenerate to ensure SQL matches current schema
				// Canonical SQL is only used as a hint/reference in the prompt
				if (canonicalDecision?.mode === 'reuse') {
					this.logger.debug(
						`Canonical match found (score=${canonicalDecision.score.toFixed(4)}) - Will use as hint only, still regenerating SQL from current schema`,
					);
					// Convert 'reuse' to 'hint' to ensure we still fetch RAG and regenerate
					canonicalDecision = {
						...canonicalDecision,
						mode: 'hint' as const,
					};
				}
				// Step 1: always fetch schema context
				// Enhance query with table hints from orchestrator if available
				// This helps vector search match with table_overview, relationship, and column_detail chunks
				const tablesHint = this.extractTablesHint(session);
				const relationshipsHint = this.extractRelationshipsHint(session);
				const enhancedQuery = tablesHint
					? `${query} ${tablesHint
							.split(',')
							.map((t) => t.trim())
							.join(' ')}`
					: query;

				this.logger.debug(
					`RAG Context Setup:` +
						`${tablesHint ? `\n  - TABLES_HINT: ${tablesHint}` : '\n  - TABLES_HINT: none'}` +
						`${relationshipsHint ? `\n  - RELATIONSHIPS_HINT: ${relationshipsHint}` : '\n  - RELATIONSHIPS_HINT: none'}` +
						`${tablesHint ? `\n  - Enhanced query: "${query}" → "${enhancedQuery}"` : ''}`,
				);

				// Dynamic limit based on number of tables in TABLES_HINT
				// Semantic chunking strategy: each column = 1 chunk, so we need more chunks for tables with many columns
				// Formula: base (5) + tables_count * 5 + relationships_count * 2
				// This ensures we get enough chunks without overwhelming the context window
				const tablesCount = tablesHint ? tablesHint.split(',').length : 0;
				const relationshipsCount = relationshipsHint ? relationshipsHint.split('→').length - 1 : 0;
				const dynamicLimit = Math.min(
					5 + tablesCount * 5 + relationshipsCount * 2, // Dynamic calculation
					25, // Hard cap to prevent token overflow (safety limit)
				);
				this.logger.debug(
					`Dynamic limit calculation: base=5, tables=${tablesCount}, relationships=${relationshipsCount} → limit=${dynamicLimit}`,
				);
				const schemaResults = await this.knowledgeService.retrieveSchemaContext(enhancedQuery, {
					limit: dynamicLimit,
					threshold: 0.6,
				});

				// Log preview of each schema chunk (first 200 chars)
				if (schemaResults.length > 0) {
					this.logger.debug(`RAG Schema Chunks (${schemaResults.length} chunks):`);
					schemaResults.forEach((chunk, index) => {
						const preview = chunk.content.substring(0, 200);
						const truncated = chunk.content.length > 200 ? '...' : '';
						this.logger.debug(
							`  [${index + 1}/${schemaResults.length}] Chunk preview (${chunk.content.length} chars): ${preview}${truncated}`,
						);
					});
				}

				const schemaContext = schemaResults.map((r) => r.content).join('\n');
				ragContext = schemaContext
					? `RELEVANT SCHEMA CONTEXT (from vector search):\n${schemaContext}\n`
					: '';

				// Add relationships hint to RAG context if available (helps AI understand JOINs)
				if (relationshipsHint && ragContext) {
					ragContext += `\nRELATIONSHIPS HINT (from orchestrator): ${relationshipsHint}\n`;
				}

				// Step 2: optionally fetch QA examples when helpful (e.g., canonical hint)
				const needExamples = canonicalDecision?.mode === 'hint';
				if (needExamples) {
					const qaResults = await this.knowledgeService.retrieveKnowledgeContext(query, {
						limit: 8,
						threshold: 0.6,
					});

					// Log preview of QA chunks
					if (qaResults.length > 0) {
						this.logger.debug(`RAG QA Chunks (${qaResults.length} chunks):`);
						qaResults.slice(0, 2).forEach((chunk, index) => {
							const preview = chunk.content.substring(0, 200);
							const truncated = chunk.content.length > 200 ? '...' : '';
							this.logger.debug(
								`  [${index + 1}/2] QA preview (${chunk.content.length} chars): ${preview}${truncated}`,
							);
						});
					}

					const qaContext = qaResults
						.slice(0, 2)
						.map((r) => r.content)
						.join('\n');
					ragContext += qaContext ? `RELEVANT Q&A EXAMPLES:\n${qaContext}\n` : '';
				}
				if (canonicalDecision?.mode === 'hint' || canonicalDecision?.mode === 'reuse') {
					ragContext += `\nCANONICAL SQL HINT (score=${canonicalDecision.score.toFixed(2)}, REFERENCE ONLY - schema may have changed):\n`;
					ragContext += `Original question: ${canonicalDecision.question}\nPrevious SQL (for reference only):\n${canonicalDecision.sql}\n`;
					ragContext += `\n⚠️ LƯU Ý QUAN TRỌNG: SQL trên chỉ là THAM KHẢO từ lần trước.\n`;
					ragContext += `PHẢI regenerate SQL MỚI dựa trên schema HIỆN TẠI trong RAG context.\n`;
					ragContext += `Nếu schema đã thay đổi (tên bảng/cột, relationships), PHẢI điều chỉnh SQL cho phù hợp.\n`;
					this.logger.debug(
						`Canonical SQL found (score=${canonicalDecision.score.toFixed(4)}) - Using as hint only, will regenerate from current schema`,
					);
				}
				this.logger.debug(
					`RAG retrieval completed:` +
						`\n  - Schema chunks: ${schemaResults.length}` +
						`${canonicalDecision?.mode === 'hint' || canonicalDecision?.mode === 'reuse' ? '\n  - Canonical hint: included (reference only)' : ''}` +
						`${canonicalDecision?.mode === 'hint' ? '\n  - QA examples: included' : ''}` +
						`${ragContext.length > 0 ? `\n  - RAG context length: ${ragContext.length} chars` : '\n  - RAG context: empty (using fallback schema)'}`,
				);
			} catch (ragError) {
				this.logger.warn('RAG retrieval failed, using fallback schema', ragError);
			}
		}
		const dbSchema = getCompleteDatabaseSchema();
		let lastError: string = '';
		let lastSql: string = '';
		let attempts = 0;
		const maxAttempts = 5;

		// Log SQL generation start
		this.logger.debug(
			`SQL Generation starting:` +
				`\n  - Query: "${query}"` +
				`${ragContext ? `\n  - RAG context: ${ragContext.length} chars` : '\n  - RAG context: none (using fallback schema)'}` +
				`${businessContext ? `\n  - Business context: ${businessContext.length} chars` : '\n  - Business context: none'}` +
				`${userId ? `\n  - User: ${userId} (${userRole})` : '\n  - User: anonymous'}`,
		);

		// Vòng phản hồi tự sửa lỗi: Nếu SQL execution fails, truyền error vào prompt
		// để AI tự động regenerate SQL với context của lỗi trước đó
		while (attempts < maxAttempts) {
			attempts++;
			try {
				if (attempts > 1) {
					this.logger.debug(
						`SQL Regeneration attempt ${attempts}/${maxAttempts} (previous error: ${lastError.substring(0, 100)})`,
					);
				}
				const contextualPrompt = buildSqlPrompt({
					query,
					schema: dbSchema,
					ragContext,
					recentMessages,
					userId,
					userRole,
					businessContext,
					lastError, // Error từ lần attempt trước → AI tự sửa lỗi
					lastSql, // SQL cũ để AI biết cần sửa gì
					attempt: attempts,
					limit: aiConfig.limit,
				});
				const { text } = await generateText({
					model: google(aiConfig.model),
					prompt: contextualPrompt,
					temperature: aiConfig.temperature,
					maxOutputTokens: aiConfig.maxTokens,
				});
				let sql = text.trim();
				sql = sql
					.replace(/```sql\n?/g, '')
					.replace(/```\n?/g, '')
					.trim();
				if (!sql.endsWith(';')) {
					sql += ';';
				}
				const sqlLower = sql.toLowerCase().trim();
				if (!sqlLower.startsWith('select')) {
					throw new Error('Only SELECT queries are allowed for security reasons');
				}

				// SQL Safety Validation - MVP: enforce LIMIT and allow-list
				const isAggregate = isAggregateQuery(sql);
				const safetyCheck = validateSqlSafety(sql, isAggregate);
				if (!safetyCheck.isValid) {
					throw new Error(`SQL safety validation failed: ${safetyCheck.violations.join(', ')}`);
				}
				// Use enforced SQL if available (with LIMIT added)
				const finalSql = safetyCheck.enforcedSql || sql;

				// Log SQL được generate để debug
				this.logger.debug(
					`SQL Generated (attempt ${attempts}/${maxAttempts}):` +
						`\n  - SQL preview: ${finalSql.substring(0, 150)}${finalSql.length > 150 ? '...' : ''}` +
						`\n  - SQL length: ${finalSql.length} chars` +
						`\n  - Is aggregate: ${isAggregate}` +
						`${safetyCheck.enforcedSql ? '\n  - LIMIT enforced by safety check' : ''}`,
				);

				// Lưu SQL để nếu fail thì có thể truyền vào prompt lần sau
				lastSql = finalSql;

				const results = await prisma.$queryRawUnsafe(finalSql);
				const serializedResults = serializeBigInt(results);
				const resultCount = Array.isArray(serializedResults) ? serializedResults.length : 1;

				this.logger.debug(
					`SQL Execution successful:` +
						`\n  - Results: ${resultCount} row(s)` +
						`\n  - Attempts: ${attempts}`,
				);

				return {
					sql: finalSql,
					results: serializedResults,
					count: resultCount,
					attempts: attempts,
					userId: userId,
					userRole: userRole,
				};
			} catch (error) {
				// Vòng phản hồi tự sửa lỗi: Lưu error và SQL cũ để truyền vào prompt lần sau
				// AI sẽ tự động sửa SQL dựa trên error message và SQL cũ này
				lastError = this.extractPrismaErrorMessage(error);
				// Log SQL cũ để debug
				if (lastSql) {
					this.logger.warn(
						`[SQL Regeneration] Attempt ${attempts}/${maxAttempts} failed. Previous SQL: ${lastSql.substring(0, 200)}${lastSql.length > 200 ? '...' : ''}`,
					);
				}
				this.logger.warn(
					`[SQL Regeneration] Attempt ${attempts}/${maxAttempts} failed: ${lastError}. Regenerating SQL...`,
				);
				if (attempts >= maxAttempts) {
					throw new Error(
						`Failed to generate valid SQL after ${maxAttempts} attempts. Last error: ${lastError}`,
					);
				}
				// Delay để tránh rate limiting
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	/**
	 * Generate and execute SQL (legacy method for backward compatibility)
	 * @param query - User query
	 * @param userId - Optional user ID for authorization
	 * @param prisma - Prisma service
	 * @param aiConfig - AI configuration
	 * @returns SQL execution result
	 */
	async generateAndExecuteSql(
		query: string,
		userId: string | undefined,
		prisma: PrismaService,
		aiConfig: AiConfig,
	): Promise<
		SqlGenerationResult & { query: string; config: AiConfig; timestamp: string; validation: any }
	> {
		// Get user role if authenticated - AI will handle security via prompt
		let userRole: string | undefined;
		if (userId) {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { role: true },
			});
			userRole = user?.role ?? undefined;
		}
		const dbSchema = getCompleteDatabaseSchema();
		let lastError: string = '';
		let attempts = 0;
		const maxAttempts = 5;
		while (attempts < maxAttempts) {
			attempts++;
			try {
				const prompt = buildSqlPrompt({
					query,
					schema: dbSchema,
					userId,
					userRole,
					lastError,
					attempt: attempts,
					limit: aiConfig.limit,
				});
				const { text } = await generateText({
					model: google(aiConfig.model),
					prompt,
					temperature: aiConfig.temperature,
					maxOutputTokens: aiConfig.maxTokens,
				});
				let sql = text.trim();
				sql = sql
					.replace(/```sql\n?/g, '')
					.replace(/```\n?/g, '')
					.trim();
				if (!sql.endsWith(';')) {
					sql += ';';
				}
				const sqlLower = sql.toLowerCase().trim();
				if (!sqlLower.startsWith('select')) {
					throw new Error('Only SELECT queries are allowed for security reasons');
				}
				const results = await prisma.$queryRawUnsafe(sql);
				const serializedResults = serializeBigInt(results);
				return {
					query,
					sql,
					results: serializedResults,
					count: Array.isArray(serializedResults) ? serializedResults.length : 1,
					config: aiConfig,
					timestamp: new Date().toISOString(),
					validation: { isValid: true, queryType: undefined },
					attempts: attempts,
					userId: userId,
					userRole: userRole,
				};
			} catch (error) {
				lastError = this.extractPrismaErrorMessage(error);
				this.logger.warn(`SQL generation attempt ${attempts} failed: ${lastError}`);
				if (attempts >= maxAttempts) {
					throw new Error(
						`Failed to generate valid SQL after ${maxAttempts} attempts. Last error: ${lastError}`,
					);
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	/**
	 * Extract tables hint from session messages
	 * @param session - Chat session
	 * @returns Tables hint string or undefined
	 */
	private extractTablesHint(session: ChatSession): string | undefined {
		const tablesMessage = session.messages
			.filter((m) => m.role === 'system')
			.find((m) => m.content.startsWith('[INTENT] TABLES='));
		if (tablesMessage) {
			const match = tablesMessage.content.match(/\[INTENT\] TABLES=(.+)/);
			return match?.[1]?.trim();
		}
		return undefined;
	}

	/**
	 * Extract relationships hint from session messages
	 * @param session - Chat session
	 * @returns Relationships hint string or undefined
	 */
	private extractRelationshipsHint(session: ChatSession): string | undefined {
		const relationshipsMessage = session.messages
			.filter((m) => m.role === 'system')
			.find((m) => m.content.startsWith('[INTENT] RELATIONSHIPS='));
		if (relationshipsMessage) {
			const match = relationshipsMessage.content.match(/\[INTENT\] RELATIONSHIPS=(.+)/);
			return match?.[1]?.trim();
		}
		return undefined;
	}
}
