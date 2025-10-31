import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import {
	buildFinalResponsePrompt,
	buildFriendlyResponsePrompt,
	getNoResultsMessage,
	getSuccessMessage,
} from '../prompts/response-generator.prompt';
import { ChatSession, SqlGenerationResult } from '../types/chat.types';

/**
 * Response Generator - Generates human-friendly responses from SQL results
 */
export class ResponseGenerator {
	private readonly logger = new Logger(ResponseGenerator.name);

	/**
	 * Generate final response combining conversational context with SQL results
	 * @param conversationalMessage - Message from conversational agent
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Final combined response
	 */
	async generateFinalResponse(
		conversationalMessage: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const finalPrompt = buildFinalResponsePrompt({
			recentMessages,
			conversationalMessage,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(0, 800),
		});
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: finalPrompt,
				temperature: 0.3,
				maxOutputTokens: 350,
			});
			return text.trim();
		} catch {
			return sqlResult.count === 0 ? getNoResultsMessage() : getSuccessMessage(sqlResult.count);
		}
	}

	/**
	 * Generate friendly response from SQL results
	 * @param query - Original user query
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Human-friendly response
	 */
	async generateFriendlyResponse(
		query: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const responsePrompt = buildFriendlyResponsePrompt({
			recentMessages,
			query,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(0, 1000),
		});
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: responsePrompt,
				temperature: 0.3,
				maxOutputTokens: 300,
			});
			return text.trim();
		} catch {
			return sqlResult.count === 0
				? getNoResultsMessage(query)
				: getSuccessMessage(sqlResult.count, query);
		}
	}
}
