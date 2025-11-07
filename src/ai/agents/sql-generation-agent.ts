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
				// Two-threshold canonical reuse/hint
				canonicalDecision = await this.knowledgeService.decideCanonicalReuse(query, {
					hard: 0.92,
					soft: 0.8,
				});
				if (canonicalDecision?.mode === 'reuse') {
					this.logger.debug(
						`Canonical reuse (hard) score=${canonicalDecision.score} sqlQAId=${canonicalDecision.sqlQAId}`,
					);
					// Execute canonical SQL directly and return
					const results = await prisma.$queryRawUnsafe(canonicalDecision.sql);
					const serializedResults = serializeBigInt(results);
					return {
						sql: canonicalDecision.sql,
						results: serializedResults,
						count: Array.isArray(serializedResults) ? serializedResults.length : 1,
						attempts: 1,
						userId: userId,
						userRole: userRole,
					};
				}
				// Step 1: always fetch schema context
				const schemaResults = await this.knowledgeService.retrieveSchemaContext(query, {
					limit: 8,
					threshold: 0.6,
				});
				const schemaContext = schemaResults.map((r) => r.content).join('\n');
				ragContext = schemaContext
					? `RELEVANT SCHEMA CONTEXT (from vector search):\n${schemaContext}\n`
					: '';

				// Step 2: optionally fetch QA examples when helpful (e.g., canonical hint)
				const needExamples = canonicalDecision?.mode === 'hint';
				if (needExamples) {
					const qaResults = await this.knowledgeService.retrieveKnowledgeContext(query, {
						limit: 8,
						threshold: 0.6,
					});
					const qaContext = qaResults
						.slice(0, 2)
						.map((r) => r.content)
						.join('\n');
					ragContext += qaContext ? `RELEVANT Q&A EXAMPLES:\n${qaContext}\n` : '';
				}
				if (canonicalDecision?.mode === 'hint') {
					ragContext += `\nCANONICAL SQL HINT (score=${canonicalDecision.score.toFixed(2)}):\n`;
					ragContext += `Question: ${canonicalDecision.question}\nSQL:\n${canonicalDecision.sql}\n`;
				}
				this.logger.debug(
					`RAG retrieved ${schemaResults.length} schema chunks` +
						(canonicalDecision?.mode === 'hint' ? ' and QA examples' : ''),
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
		// Vòng phản hồi tự sửa lỗi: Nếu SQL execution fails, truyền error vào prompt
		// để AI tự động regenerate SQL với context của lỗi trước đó
		while (attempts < maxAttempts) {
			attempts++;
			try {
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
					`[SQL Generation] Attempt ${attempts}/${maxAttempts} - Generated SQL: ${finalSql.substring(0, 200)}${finalSql.length > 200 ? '...' : ''}`,
				);

				// Lưu SQL để nếu fail thì có thể truyền vào prompt lần sau
				lastSql = finalSql;

				const results = await prisma.$queryRawUnsafe(finalSql);
				const serializedResults = serializeBigInt(results);
				return {
					sql: finalSql,
					results: serializedResults,
					count: Array.isArray(serializedResults) ? serializedResults.length : 1,
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
}
