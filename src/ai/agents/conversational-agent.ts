import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import {
	buildConversationalPrompt,
	DEFAULT_GREETING_MESSAGE,
	DEFAULT_SEARCH_MESSAGE,
} from '../prompts/conversational-agent.prompt';
import { ChatSession, ConversationalAgentResponse } from '../types/chat.types';

/**
 * Agent 1: Conversational Agent - Handles natural conversation and determines readiness for SQL
 */
export class ConversationalAgent {
	private readonly logger = new Logger(ConversationalAgent.name);

	/**
	 * Process query and determine if ready for SQL generation
	 * @param query - User query
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Conversational response with readiness indicator
	 */
	async process(
		query: string,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<ConversationalAgentResponse> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-4)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const isFirstMessage = session.messages.filter((m) => m.role === 'user').length <= 1;
		const conversationalPrompt = buildConversationalPrompt({
			recentMessages,
			query,
			isFirstMessage,
		});
		try {
			this.logger.debug(`Generating conversational response for query: "${query}"`);
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: conversationalPrompt,
				temperature: 0.4,
				maxOutputTokens: 400,
			});
			const response = text.trim();
			this.logger.debug(`AI response: ${response.substring(0, 200)}...`);
			const situationMatch = response.match(
				/SITUATION: (GREETING|READY_FOR_SQL|NEEDS_CLARIFICATION|GENERAL_CHAT)/,
			);
			const modeMatch = response.match(/MODE_HINT: (LIST|TABLE|CHART)/);
			const entityMatch = response.match(/ENTITY_HINT: (room|post|room_seeking_post|none)/);
			const filtersMatch = response.match(/FILTERS_HINT: (.+)/);
			const responseMatch = response.match(/RESPONSE: (.+)/s);
			const situation = situationMatch ? situationMatch[1] : 'GENERAL_CHAT';
			const message = responseMatch
				? responseMatch[1].trim()
				: this.getDefaultResponse(query, isFirstMessage);
			this.logger.debug(
				`Parsed situation: ${situation}, readyForSql: ${situation === 'READY_FOR_SQL'}`,
			);
			return {
				message,
				readyForSql: situation === 'READY_FOR_SQL',
				needsClarification: situation === 'NEEDS_CLARIFICATION',
				needsIntroduction: situation === 'GREETING',
				intentModeHint: modeMatch ? (modeMatch[1] as 'LIST' | 'TABLE' | 'CHART') : undefined,
				entityHint: entityMatch && entityMatch[1] !== 'none' ? (entityMatch[1] as any) : undefined,
				filtersHint: filtersMatch ? filtersMatch[1].trim() : undefined,
			};
		} catch (error) {
			this.logger.error('Conversational agent error:', error);
			return {
				message: this.getDefaultResponse(query, isFirstMessage),
				readyForSql: false,
				needsClarification: true,
			};
		}
	}

	/**
	 * Get default conversational response when AI generation fails
	 * @param query - User query
	 * @param isFirstMessage - Whether this is the first message
	 * @returns Default conversational response
	 */
	private getDefaultResponse(_query: string, isFirstMessage: boolean): string {
		return isFirstMessage ? DEFAULT_GREETING_MESSAGE : DEFAULT_SEARCH_MESSAGE;
	}
}
