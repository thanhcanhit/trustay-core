import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { buildSqlPrompt } from '../prompts/sql-agent.prompt';
import {
	ChatSession,
	SqlGenerationAttempt,
	SqlGenerationResult,
	TokenUsage,
} from '../types/chat.types';
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

	// Configuration constants
	private static readonly RECENT_MESSAGES_LIMIT = 5;
	private static readonly MAX_ATTEMPTS = 5;
	private static readonly RETRY_DELAY_MS = 1000;
	private static readonly MAX_CONSECUTIVE_SAME_ERROR = 2; // Stop early if same error repeats
	// Canonical thresholds
	private static readonly CANONICAL_HARD_THRESHOLD = 0.95;
	private static readonly CANONICAL_SOFT_THRESHOLD = 0.8;
	// RAG thresholds (increased for better precision with table_complete chunks)
	private static readonly RAG_SCHEMA_THRESHOLD = 0.65; // Slightly higher for better precision
	private static readonly RAG_QA_THRESHOLD = 0.6;
	// Dynamic limit calculation (optimized for 1 chunk per table strategy)
	private static readonly DYNAMIC_LIMIT_BASE = 1; // Base chunks for general context (reduced from 2)
	private static readonly DYNAMIC_LIMIT_TABLE_MULTIPLIER = 1; // 1 chunk per table (since we use table_complete chunks)
	private static readonly DYNAMIC_LIMIT_RELATIONSHIP_MULTIPLIER = 0; // Relationships are included in table chunks
	private static readonly DYNAMIC_LIMIT_HARD_CAP = 6; // Reduced cap to prevent token overflow (reduced from 10)
	// Preview lengths
	private static readonly CHUNK_PREVIEW_LENGTH = 200;
	private static readonly SQL_PREVIEW_LENGTH = 200;
	// QA limit
	private static readonly QA_EXAMPLES_LIMIT = 2; // Reduced from 8 to 2
	// Max chunk content length (truncate if exceeds)
	private static readonly MAX_CHUNK_CONTENT_LENGTH = 8000; // Max 8KB per chunk to prevent token overflow
	// Message labels
	private static readonly LABEL_USER = 'Người dùng';
	private static readonly LABEL_AI = 'AI';
	// Validation strings
	private static readonly VALIDATION_NONE = 'none';
	// Delimiters
	private static readonly DELIMITER_TABLES = ',';
	private static readonly DELIMITER_RELATIONSHIPS = '→';
	// Canonical modes
	private static readonly CANONICAL_MODE_REUSE = 'reuse';
	private static readonly CANONICAL_MODE_HINT = 'hint';
	// SQL commands
	private static readonly SQL_COMMAND_SELECT = 'select';

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
			.slice(-SqlGenerationAgent.RECENT_MESSAGES_LIMIT)
			.map(
				(m) =>
					`${m.role === 'user' ? SqlGenerationAgent.LABEL_USER : SqlGenerationAgent.LABEL_AI}: ${m.content}`,
			)
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
		const attemptLogs: SqlGenerationAttempt[] = [];
		let tablesHint: string | undefined;
		let relationshipsHint: string | undefined;
		let filtersHint: string | undefined;
		let intentAction: 'search' | 'own' | 'stats' | undefined;
		// Step A: RAG Retrieval - Get relevant schema and QA chunks
		let ragContext = '';
		let canonicalDecision: any = null;
		if (this.knowledgeService) {
			try {
				// Check for canonical SQL to use as hint (never execute directly)
				// Always regenerate SQL based on current schema to handle schema changes
				canonicalDecision = await this.knowledgeService.decideCanonicalReuse(query, {
					hard: SqlGenerationAgent.CANONICAL_HARD_THRESHOLD, // Very high threshold - only exact matches
					soft: SqlGenerationAgent.CANONICAL_SOFT_THRESHOLD, // Use as hint for similar queries
				});
				// NOTE: We never execute canonical SQL directly anymore
				// Always regenerate to ensure SQL matches current schema
				// Canonical SQL is only used as a hint/reference in the prompt
				if (canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_REUSE) {
					this.logger.debug(
						`Canonical match found (score=${canonicalDecision.score.toFixed(4)}) - Will use as hint only, still regenerating SQL from current schema`,
					);
					// Convert 'reuse' to 'hint' to ensure we still fetch RAG and regenerate
					canonicalDecision = {
						...canonicalDecision,
						mode: SqlGenerationAgent.CANONICAL_MODE_HINT,
					};
				}
				// Step 1: always fetch schema context
				// Enhance query with table hints from orchestrator if available
				// This helps vector search match with table_complete chunks (1 chunk per table)
				tablesHint = this.extractTablesHint(session);
				relationshipsHint = this.extractRelationshipsHint(session);
				// Enhanced query: add table names to help vector search find relevant table_complete chunks
				// Format: "query table1 table2 table3" - helps match table_name field in chunks
				const enhancedQuery = tablesHint
					? `${query} ${tablesHint
							.split(SqlGenerationAgent.DELIMITER_TABLES)
							.map((t) => t.trim())
							.filter((t) => t.length > 0)
							.join(' ')}`
					: query;

				this.logger.debug(
					`RAG Context Setup:` +
						`${tablesHint ? `\n  - TABLES_HINT: ${tablesHint}` : `\n  - TABLES_HINT: ${SqlGenerationAgent.VALIDATION_NONE}`}` +
						`${relationshipsHint ? `\n  - RELATIONSHIPS_HINT: ${relationshipsHint}` : `\n  - RELATIONSHIPS_HINT: ${SqlGenerationAgent.VALIDATION_NONE}`}` +
						`${tablesHint ? `\n  - Enhanced query: "${query}" → "${enhancedQuery}"` : ''}`,
				);

				// Dynamic limit based on number of tables in TABLES_HINT
				// Optimized for 1 chunk per table strategy (table_complete chunks)
				// Formula: base (2) + tables_count * 1
				// Each table_complete chunk contains all columns and relationships, so we only need 1 chunk per table
				const tablesCount = tablesHint
					? tablesHint.split(SqlGenerationAgent.DELIMITER_TABLES).length
					: 0;
				const dynamicLimit = Math.min(
					SqlGenerationAgent.DYNAMIC_LIMIT_BASE +
						tablesCount * SqlGenerationAgent.DYNAMIC_LIMIT_TABLE_MULTIPLIER, // 1 chunk per table
					SqlGenerationAgent.DYNAMIC_LIMIT_HARD_CAP, // Hard cap to prevent token overflow
				);
				this.logger.debug(
					`Dynamic limit calculation: base=${SqlGenerationAgent.DYNAMIC_LIMIT_BASE}, tables=${tablesCount} → limit=${dynamicLimit} (optimized for 1 chunk per table)`,
				);
				const schemaResults = await this.knowledgeService.retrieveSchemaContext(enhancedQuery, {
					limit: dynamicLimit,
					threshold: SqlGenerationAgent.RAG_SCHEMA_THRESHOLD,
				});

				// Log preview of each schema chunk (first 200 chars)
				if (schemaResults.length > 0) {
					this.logger.debug(`RAG Schema Chunks (${schemaResults.length} chunks):`);
					schemaResults.forEach((chunk, index) => {
						const preview = chunk.content.substring(0, SqlGenerationAgent.CHUNK_PREVIEW_LENGTH);
						const truncated =
							chunk.content.length > SqlGenerationAgent.CHUNK_PREVIEW_LENGTH ? '...' : '';
						this.logger.debug(
							`  [${index + 1}/${schemaResults.length}] Chunk preview (${chunk.content.length} chars): ${preview}${truncated}`,
						);
					});
				}

				// Truncate chunks that are too large to prevent token overflow
				const schemaContext = schemaResults
					.map((r) => {
						if (r.content.length > SqlGenerationAgent.MAX_CHUNK_CONTENT_LENGTH) {
							// Truncate but keep JSON structure intact
							const truncated = r.content.substring(0, SqlGenerationAgent.MAX_CHUNK_CONTENT_LENGTH);
							// Try to find last complete JSON object/array
							const lastBrace = truncated.lastIndexOf('}');
							const lastBracket = truncated.lastIndexOf(']');
							const cutPoint = Math.max(lastBrace, lastBracket);
							if (cutPoint > SqlGenerationAgent.MAX_CHUNK_CONTENT_LENGTH * 0.8) {
								return `${truncated.substring(0, cutPoint + 1)}\n... (truncated)`;
							}
							return `${truncated}\n... (truncated)`;
						}
						return r.content;
					})
					.join('\n\n');
				ragContext = schemaContext
					? `RELEVANT SCHEMA CONTEXT (from vector search):\n${schemaContext}\n`
					: '';

				// Add relationships hint to RAG context if available (helps AI understand JOINs)
				if (relationshipsHint && ragContext) {
					ragContext += `\nRELATIONSHIPS HINT (from orchestrator): ${relationshipsHint}\n`;
				}

				// Extract filters hint to check if this is a room-specific query
				const filtersHint = this.extractFiltersHint(session);

				// Step 2: optionally fetch QA examples when helpful (e.g., canonical hint)
				// IMPORTANT: For room-specific queries (with filtersHint), skip QA examples
				// because they are usually not relevant (statistics queries vs room analysis)
				const needExamples =
					canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_HINT && !filtersHint; // Skip QA examples if we have a specific room filter
				if (needExamples) {
					const qaResults = await this.knowledgeService.retrieveKnowledgeContext(query, {
						limit: SqlGenerationAgent.QA_EXAMPLES_LIMIT,
						threshold: SqlGenerationAgent.RAG_QA_THRESHOLD + 0.2, // Increase threshold to 0.8 for better relevance
					});

					// Log preview of QA chunks
					if (qaResults.length > 0) {
						this.logger.debug(`RAG QA Chunks (${qaResults.length} chunks):`);
						qaResults.slice(0, 2).forEach((chunk, index) => {
							const preview = chunk.content.substring(0, SqlGenerationAgent.CHUNK_PREVIEW_LENGTH);
							const truncated =
								chunk.content.length > SqlGenerationAgent.CHUNK_PREVIEW_LENGTH ? '...' : '';
							this.logger.debug(
								`  [${index + 1}/2] QA preview (${chunk.content.length} chars): ${preview}${truncated}`,
							);
						});
					}

					// Limit QA examples and truncate if too long
					const qaContext = qaResults
						.slice(0, 2)
						.map((r) => {
							// Truncate QA content if too long (max 2000 chars per QA)
							if (r.content.length > 2000) {
								return `${r.content.substring(0, 2000)}... (truncated)`;
							}
							return r.content;
						})
						.join('\n\n');
					ragContext += qaContext ? `RELEVANT Q&A EXAMPLES:\n${qaContext}\n` : '';
				}
				if (
					canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_HINT ||
					canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_REUSE
				) {
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
						`${canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_HINT || canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_REUSE ? '\n  - Canonical hint: included (reference only)' : ''}` +
						`${canonicalDecision?.mode === SqlGenerationAgent.CANONICAL_MODE_HINT && !filtersHint ? '\n  - QA examples: included' : filtersHint ? '\n  - QA examples: skipped (room-specific query)' : ''}` +
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
		const maxAttempts = SqlGenerationAgent.MAX_ATTEMPTS;
		let consecutiveSameError = 0;
		let totalTokenUsage:
			| { promptTokens: number; completionTokens: number; totalTokens: number }
			| undefined;

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
				const intentAction = this.extractIntentAction(session);
				const filtersHint = this.extractFiltersHint(session);
				this.logger.debug(
					`SQL Generation context: intentAction=${intentAction || 'none'}, filtersHint=${filtersHint || 'none'}`,
				);
				const contextualPrompt = buildSqlPrompt({
					query,
					schema: dbSchema,
					ragContext,
					recentMessages,
					userId,
					userRole,
					businessContext,
					intentAction, // Intent action: search (toàn hệ thống) vs own (cá nhân)
					filtersHint, // Filters hint from orchestrator (BẮT BUỘC phải dùng)
					lastError, // Error từ lần attempt trước → AI tự sửa lỗi
					lastSql, // SQL cũ để AI biết cần sửa gì
					attempt: attempts,
					limit: aiConfig.limit,
				});
				const { text, usage } = await generateText({
					model: google(aiConfig.model),
					prompt: contextualPrompt,
					temperature: aiConfig.temperature,
					maxOutputTokens: aiConfig.maxTokens,
				});
				// Accumulate token usage across attempts
				if (usage) {
					const promptTokens = (usage as any).promptTokens || (usage as any).prompt || 0;
					const completionTokens =
						(usage as any).completionTokens || (usage as any).completion || 0;
					const totalTokens = (usage as any).totalTokens || promptTokens + completionTokens;
					totalTokenUsage = {
						promptTokens: (totalTokenUsage?.promptTokens || 0) + promptTokens,
						completionTokens: (totalTokenUsage?.completionTokens || 0) + completionTokens,
						totalTokens: (totalTokenUsage?.totalTokens || 0) + totalTokens,
					};
				}
				let sql = text.trim();
				sql = sql
					.replace(/```sql\n?/g, '')
					.replace(/```\n?/g, '')
					.trim();
				if (!sql.endsWith(';')) {
					sql += ';';
				}
				const sqlLower = sql.toLowerCase().trim();
				if (!sqlLower.startsWith(SqlGenerationAgent.SQL_COMMAND_SELECT)) {
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
					tokenUsage: totalTokenUsage,
				};
			} catch (error) {
				// Vòng phản hồi tự sửa lỗi: Lưu error và SQL cũ để truyền vào prompt lần sau
				// AI sẽ tự động sửa SQL dựa trên error message và SQL cũ này
				const currentError = this.extractPrismaErrorMessage(error);

				// Detect if same error repeats (early exit to save resources)
				const isSameError = lastError && currentError === lastError;
				if (isSameError) {
					consecutiveSameError++;
				} else {
					consecutiveSameError = 1;
				}

				// Early exit if same error repeats (AI is not learning from previous attempts)
				if (consecutiveSameError >= SqlGenerationAgent.MAX_CONSECUTIVE_SAME_ERROR) {
					this.logger.error(
						`[SQL Regeneration] Same error repeated ${consecutiveSameError} times. Stopping early to save resources. Error: ${currentError}`,
					);
					throw new Error(
						`Failed to generate valid SQL after ${attempts} attempts. Same error repeated ${consecutiveSameError} times: ${currentError}`,
					);
				}

				lastError = currentError;

				// Log SQL cũ để debug
				if (lastSql) {
					this.logger.warn(
						`[SQL Regeneration] Attempt ${attempts}/${maxAttempts} failed. Previous SQL: ${lastSql.substring(0, SqlGenerationAgent.SQL_PREVIEW_LENGTH)}${lastSql.length > SqlGenerationAgent.SQL_PREVIEW_LENGTH ? '...' : ''}`,
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
				await new Promise((resolve) => setTimeout(resolve, SqlGenerationAgent.RETRY_DELAY_MS));
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
		const maxAttempts = SqlGenerationAgent.MAX_ATTEMPTS;
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
				if (!sqlLower.startsWith(SqlGenerationAgent.SQL_COMMAND_SELECT)) {
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
				await new Promise((resolve) => setTimeout(resolve, SqlGenerationAgent.RETRY_DELAY_MS));
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

	/**
	 * Extract filters hint from session messages
	 * @param session - Chat session
	 * @returns Filters hint string or undefined
	 */
	private extractFiltersHint(session: ChatSession): string | undefined {
		const filtersMessage = session.messages
			.filter((m) => m.role === 'system')
			.find((m) => m.content.startsWith('[INTENT] FILTERS='));
		if (filtersMessage) {
			const match = filtersMessage.content.match(/\[INTENT\] FILTERS=(.+)/);
			return match?.[1]?.trim();
		}
		return undefined;
	}

	/**
	 * Extract intent action from session messages
	 * @param session - Chat session
	 * @returns Intent action ('search' | 'own' | 'stats') or undefined
	 */
	private extractIntentAction(session: ChatSession): 'search' | 'own' | 'stats' | undefined {
		const actionMessage = session.messages
			.filter((m) => m.role === 'system')
			.find((m) => m.content.startsWith('[INTENT] ACTION='));
		if (actionMessage) {
			const match = actionMessage.content.match(/\[INTENT\] ACTION=(.+)/);
			const action = match?.[1]?.trim().toLowerCase();
			if (action === 'search' || action === 'own' || action === 'stats') {
				return action;
			}
		}
		return undefined;
	}
}
