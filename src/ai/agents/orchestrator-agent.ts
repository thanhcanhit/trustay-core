import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { buildOrchestratorPrompt } from '../prompts/orchestrator-agent.prompt';
import {
	ChatSession,
	MissingParam,
	OrchestratorAgentResponse,
	RequestType,
	UserRole,
} from '../types/chat.types';

/**
 * Agent 1: Orchestrator Agent - Labels user requests, identifies user role, reads RAG business context
 */
export class OrchestratorAgent {
	private readonly logger = new Logger(OrchestratorAgent.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
	) {}

	/**
	 * Process query and determine request type, user role, and readiness for SQL generation
	 * @param query - User query
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Orchestrator response with labels and context
	 */
	async process(
		query: string,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<OrchestratorAgentResponse> {
		const userId = session.userId;
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-4)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const isFirstMessage = session.messages.filter((m) => m.role === 'user').length <= 1;

		// Get user role from Prisma if authenticated, otherwise GUEST
		let userRole: UserRole = UserRole.GUEST;
		if (userId) {
			try {
				const user = await this.prisma.user.findUnique({
					where: { id: userId },
					select: { role: true },
				});
				if (user?.role === 'tenant') {
					userRole = UserRole.TENANT;
				} else if (user?.role === 'landlord') {
					userRole = UserRole.LANDLORD;
				}
			} catch (error) {
				this.logger.warn(`Failed to fetch user role for userId=${userId}`, error);
			}
		}

		// Get business context from RAG
		let businessContext = '';
		try {
			const ragContext = await this.knowledge.buildRagContext(query, {
				limit: 8,
				threshold: 0.6,
				includeBusiness: true,
			});
			businessContext = ragContext.businessBlock || '';
		} catch (error) {
			this.logger.warn('Failed to retrieve business context from RAG', error);
		}

		// Build orchestrator prompt with business context and user role
		const orchestratorPrompt = buildOrchestratorPrompt({
			recentMessages,
			query,
			isFirstMessage,
			userId,
			userRole,
			businessContext,
		});

		try {
			this.logger.debug(`Generating orchestrator response for query: "${query}"`);
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: orchestratorPrompt,
				temperature: 0.4,
				maxOutputTokens: 400,
			});
			const response = text.trim();
			this.logger.debug(`AI response: ${response.substring(0, 200)}...`);

			// Parse response to extract structured information
			const requestTypeMatch = response.match(
				/REQUEST_TYPE: (QUERY|GREETING|CLARIFICATION|GENERAL_CHAT)/,
			);
			const modeMatch = response.match(/MODE_HINT: (LIST|TABLE|CHART)/);
			const entityMatch = response.match(/ENTITY_HINT: (room|post|room_seeking_post|none)/);
			const filtersMatch = response.match(/FILTERS_HINT: (.+)/);
			const responseMatch = response.match(/RESPONSE: (.+)/s);

			const requestType = requestTypeMatch
				? (requestTypeMatch[1] as RequestType)
				: RequestType.GENERAL_CHAT;
			const message = responseMatch
				? responseMatch[1].trim()
				: this.getDefaultResponse(query, isFirstMessage);

			// Parse MISSING_PARAMS for clarification (MVP)
			const missingParamsMatch = response.match(/MISSING_PARAMS:\s*(.+?)(?=\n(?:RESPONSE|$))/s);
			let missingParams: MissingParam[] | undefined;
			if (missingParamsMatch) {
				const paramsStr = missingParamsMatch[1].trim();
				// MVP: Validate - ignore if empty, "none", "null", or contains RESPONSE text (AI might have mixed up fields)
				if (
					paramsStr &&
					paramsStr !== 'none' &&
					paramsStr !== 'null' &&
					!paramsStr.includes('RESPONSE:') &&
					!paramsStr.includes('[LANDLORD]') &&
					!paramsStr.includes('[TENANT]') &&
					!paramsStr.includes('[GUEST]') &&
					paramsStr.length > 0
				) {
					const params = paramsStr
						.split('|')
						.map((param) => param.trim())
						.filter((p) => p.length > 0);
					if (params.length > 0) {
						missingParams = params
							.map((param): MissingParam | null => {
								const parts = param.split(':');
								if (parts.length >= 2) {
									const name = parts[0].trim();
									const reason = parts[1].trim();
									// MVP: Validate that name and reason are not empty or user labels
									if (
										!name ||
										!reason ||
										name === 'none' ||
										reason === 'none' ||
										name.includes('[LANDLORD]') ||
										name.includes('[TENANT]') ||
										name.includes('[GUEST]') ||
										reason.includes('[LANDLORD]') ||
										reason.includes('[TENANT]') ||
										reason.includes('[GUEST]')
									) {
										return null;
									}
									const examples =
										parts.length > 2 && parts[2].trim()
											? parts[2]
													.split(',')
													.map((e) => e.trim())
													.filter((e) => e.length > 0 && !e.includes('['))
											: undefined;
									return { name, reason, examples };
								}
								return null;
							})
							.filter((p): p is MissingParam => p !== null);
						// MVP: If no valid params after filtering, set to undefined
						if (missingParams.length === 0) {
							missingParams = undefined;
						}
					}
				}
			}

			// MVP: Only set missingParams if readyForSql is false
			// If readyForSql is true, ignore missingParams (AI might have returned it incorrectly)
			const readyForSql =
				requestType === RequestType.QUERY && (!missingParams || missingParams.length === 0);

			// Clear missingParams if readyForSql is true (contradiction - shouldn't happen)
			const finalMissingParams =
				readyForSql || requestType !== RequestType.QUERY ? undefined : missingParams;

			this.logger.debug(
				`Parsed requestType: ${requestType}, userRole: ${userRole}, readyForSql: ${readyForSql}${finalMissingParams ? `, missingParams: [${finalMissingParams.length}]` : ''}`,
			);

			return {
				message,
				requestType,
				userRole,
				userId,
				businessContext: businessContext || undefined,
				readyForSql,
				needsClarification:
					requestType === RequestType.CLARIFICATION ||
					(finalMissingParams && finalMissingParams.length > 0),
				missingParams: finalMissingParams,
				needsIntroduction: requestType === RequestType.GREETING,
				intentModeHint: modeMatch ? (modeMatch[1] as 'LIST' | 'TABLE' | 'CHART') : undefined,
				entityHint:
					entityMatch && entityMatch[1] !== 'none'
						? (entityMatch[1] as 'room' | 'post' | 'room_seeking_post')
						: undefined,
				filtersHint: filtersMatch ? filtersMatch[1].trim() : undefined,
			};
		} catch (error) {
			this.logger.error('Orchestrator agent error:', error);
			return {
				message: this.getDefaultResponse(query, isFirstMessage),
				requestType: RequestType.GENERAL_CHAT,
				userRole,
				userId,
				businessContext: businessContext || undefined,
				readyForSql: false,
				needsClarification: true,
			};
		}
	}

	/**
	 * Get default orchestrator response when AI generation fails
	 * @param query - User query
	 * @param isFirstMessage - Whether this is the first message
	 * @returns Default response
	 */
	private getDefaultResponse(_query: string, isFirstMessage: boolean): string {
		return isFirstMessage
			? `Xin chào! 👋 Tôi là AI Assistant của Trustay, rất vui được trò chuyện với bạn!\n\nTôi có thể giúp bạn tìm hiểu về dữ liệu phòng trọ, thống kê doanh thu, thông tin người dùng và nhiều thứ khác.\n\nBạn muốn tìm hiểu điều gì? 😊`
			: `Tôi sẽ tìm kiếm thông tin cho bạn ngay! 🔍`;
	}
}
