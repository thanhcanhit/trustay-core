import { google } from '@ai-sdk/google';
import { ForbiddenException, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatSession, SqlGenerationResult } from '../types/chat.types';
import { AiConfig, PromptBuilder } from '../utils/prompt-builder';
import { QueryValidator } from '../utils/query-validator';
import { SchemaProvider } from '../utils/schema-provider';
import { SecurityHelper } from '../utils/security-helper';
import { Serializer } from '../utils/serializer';

/**
 * Agent 2: SQL Generation Agent - Generates and executes SQL when ready
 */
export class SqlGenerationAgent {
	private readonly logger = new Logger(SqlGenerationAgent.name);

	/**
	 * Generate and execute SQL with conversation context, retry logic and security
	 * @param query - User query
	 * @param session - Chat session for context
	 * @param prisma - Prisma service
	 * @param aiConfig - AI configuration
	 * @returns SQL execution result
	 */
	async process(
		query: string,
		session: ChatSession,
		prisma: PrismaService,
		aiConfig: AiConfig,
	): Promise<SqlGenerationResult> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-5)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const userId = session.userId;
		const validation = await QueryValidator.validateQueryIntent(query);
		if (!validation.isValid) {
			throw new Error(
				`Query not suitable for database querying: ${validation.reason || 'Invalid query intent'}`,
			);
		}
		const accessValidation = await SecurityHelper.validateUserAccess(
			prisma,
			userId,
			query,
			validation.queryType,
		);
		if (!accessValidation.hasAccess) {
			throw new ForbiddenException(accessValidation.restrictions.join('; '));
		}
		const dbSchema = SchemaProvider.getCompleteDatabaseSchema();
		let lastError: string = '';
		let attempts = 0;
		const maxAttempts = 5;
		while (attempts < maxAttempts) {
			attempts++;
			try {
				const contextualPrompt =
					userId && accessValidation.userRole
						? PromptBuilder.buildSecureContextualSqlPrompt(
								query,
								dbSchema,
								recentMessages,
								userId,
								accessValidation.userRole,
								aiConfig,
								lastError,
								attempts,
							)
						: PromptBuilder.buildContextualSqlPrompt(
								query,
								dbSchema,
								recentMessages,
								aiConfig,
								lastError,
								attempts,
							);
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
				if (userId && accessValidation.restrictions.length > 0) {
					const hasUserRestriction = SecurityHelper.validateSqlSecurity(
						sql,
						accessValidation.restrictions,
					);
					if (!hasUserRestriction) {
						throw new Error(
							'Security violation: Query must include user-specific WHERE clauses for sensitive data',
						);
					}
				}
				const results = await prisma.$queryRawUnsafe(sql);
				const serializedResults = Serializer.serializeBigInt(results);
				return {
					sql,
					results: serializedResults,
					count: Array.isArray(serializedResults) ? serializedResults.length : 1,
					attempts: attempts,
					userId: userId,
					userRole: accessValidation.userRole,
				};
			} catch (error) {
				lastError = error.message;
				this.logger.warn(`Contextual SQL generation attempt ${attempts} failed: ${lastError}`);
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
		const validation = await QueryValidator.validateQueryIntent(query);
		if (!validation.isValid) {
			throw new Error(
				`Query not suitable for database querying: ${validation.reason || 'Invalid query intent'}`,
			);
		}
		const accessValidation = await SecurityHelper.validateUserAccess(
			prisma,
			userId,
			query,
			validation.queryType,
		);
		if (!accessValidation.hasAccess) {
			throw new ForbiddenException(accessValidation.restrictions.join('; '));
		}
		const dbSchema = SchemaProvider.getCompleteDatabaseSchema();
		let lastError: string = '';
		let attempts = 0;
		const maxAttempts = 5;
		while (attempts < maxAttempts) {
			attempts++;
			try {
				const prompt =
					userId && accessValidation.userRole
						? PromptBuilder.buildSecureSqlPrompt(
								query,
								dbSchema,
								userId,
								accessValidation.userRole,
								aiConfig,
								lastError,
								attempts,
							)
						: PromptBuilder.buildSqlPrompt(query, dbSchema, aiConfig, lastError, attempts);
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
				if (userId && accessValidation.restrictions.length > 0) {
					const hasUserRestriction = SecurityHelper.validateSqlSecurity(
						sql,
						accessValidation.restrictions,
					);
					if (!hasUserRestriction) {
						throw new Error(
							'Security violation: Query must include user-specific WHERE clauses for sensitive data',
						);
					}
				}
				const results = await prisma.$queryRawUnsafe(sql);
				const serializedResults = Serializer.serializeBigInt(results);
				return {
					query,
					sql,
					results: serializedResults,
					count: Array.isArray(serializedResults) ? serializedResults.length : 1,
					config: aiConfig,
					timestamp: new Date().toISOString(),
					validation: validation,
					attempts: attempts,
					userId: userId,
					userRole: accessValidation.userRole,
				};
			} catch (error) {
				lastError = error.message;
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
