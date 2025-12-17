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

	// Configuration constants
	private static readonly RECENT_MESSAGES_LIMIT = 10;
	private static readonly RAG_BUSINESS_LIMIT = 8;
	private static readonly RAG_BUSINESS_THRESHOLD = 0.85;
	private static readonly TEMPERATURE = 0.4;
	private static readonly MAX_OUTPUT_TOKENS = 400;
	private static readonly LOG_PREVIEW_LENGTH = 200;
	private static readonly FILTERS_HINT_PREVIEW_LENGTH = 50;
	private static readonly MIN_PARTS_FOR_MISSING_PARAM = 2;
	private static readonly FIRST_MESSAGE_USER_COUNT_THRESHOLD = 1;
	// User role strings
	private static readonly USER_ROLE_TENANT = 'tenant';
	private static readonly USER_ROLE_LANDLORD = 'landlord';
	// Intent action strings
	private static readonly INTENT_ACTION_OWN = 'own';
	// Validation strings
	private static readonly VALIDATION_NONE = 'none';
	private static readonly VALIDATION_NULL = 'null';
	private static readonly ANNOTATION_RESPONSE = 'RESPONSE:';
	// Role tags (internal annotations)
	private static readonly ROLE_TAG_LANDLORD = '[LANDLORD]';
	private static readonly ROLE_TAG_TENANT = '[TENANT]';
	private static readonly ROLE_TAG_GUEST = '[GUEST]';
	// Delimiters
	private static readonly DELIMITER_PARAM = '|';
	private static readonly DELIMITER_KEY_VALUE = ':';
	private static readonly DELIMITER_EXAMPLES = ',';
	// Login keywords
	private static readonly LOGIN_KEYWORD_VI = 'đăng nhập';
	private static readonly LOGIN_KEYWORD_EN = 'login';
	// Default messages
	private static readonly DEFAULT_LOGIN_MESSAGE =
		'Để xem thông tin dãy trọ/phòng/hóa đơn của bạn, vui lòng đăng nhập vào hệ thống nhé! 🔐';
	private static readonly DEFAULT_GREETING_MESSAGE =
		`Xin chào! 👋 Tôi là AI Assistant của Trustay, rất vui được trò chuyện với bạn!\n\nTôi có thể giúp bạn tìm hiểu về dữ liệu phòng trọ, thống kê doanh thu, thông tin người dùng và nhiều thứ khác.\n\nBạn muốn tìm hiểu điều gì? 😊`;
	private static readonly DEFAULT_SEARCH_MESSAGE = `Tôi sẽ tìm kiếm thông tin cho bạn ngay! 🔍`;

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
			.slice(-OrchestratorAgent.RECENT_MESSAGES_LIMIT)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const isFirstMessage =
			session.messages.filter((m) => m.role === 'user').length <=
			OrchestratorAgent.FIRST_MESSAGE_USER_COUNT_THRESHOLD;

		// Get user role from Prisma if authenticated, otherwise GUEST
		let userRole: UserRole = UserRole.GUEST;
		if (userId) {
			try {
				const user = await this.prisma.user.findUnique({
					where: { id: userId },
					select: { role: true },
				});
				if (user?.role === OrchestratorAgent.USER_ROLE_TENANT) {
					userRole = UserRole.TENANT;
				} else if (user?.role === OrchestratorAgent.USER_ROLE_LANDLORD) {
					userRole = UserRole.LANDLORD;
				}
			} catch (error) {
				this.logger.warn(`Failed to fetch user role for userId=${userId}`, error);
			}
		}

		// Get business context from RAG
		// Note: Schema context will be retrieved by SQL agent with enhanced query using tablesHint
		let businessContext = '';
		try {
			const ragContext = await this.knowledge.buildRagContext(query, {
				schemaLimit: OrchestratorAgent.RAG_BUSINESS_LIMIT,
				threshold: OrchestratorAgent.RAG_BUSINESS_THRESHOLD,
				includeBusiness: true,
				qaLimit: 2,
			});
			businessContext = ragContext.businessBlock || '';
		} catch (error) {
			this.logger.warn('Failed to retrieve business context from RAG', error);
		}

		// Extract currentPageContext từ session messages
		let currentPageContext:
			| { entity: string; identifier: string; type?: 'slug' | 'id' }
			| undefined;
		const contextMessages = session.messages.filter(
			(m) => m.role === 'system' && m.content.includes('[CONTEXT]'),
		);
		if (contextMessages.length > 0) {
			const lastContextMessage = contextMessages[contextMessages.length - 1].content;
			this.logger.debug(
				`[OrchestratorAgent] Extracting context from message: ${lastContextMessage.substring(0, 200)}`,
			);
			const entityMatch = lastContextMessage.match(/Entity:\s*(\w+)/);
			const identifierMatch = lastContextMessage.match(/Identifier:\s*([^\s,\n]+)/);
			const typeMatch = lastContextMessage.match(/Type:\s*(\w+)/);
			if (entityMatch && identifierMatch) {
				currentPageContext = {
					entity: entityMatch[1],
					identifier: identifierMatch[1],
					type: typeMatch ? (typeMatch[1] as 'slug' | 'id') : undefined,
				};
				this.logger.debug(
					`[OrchestratorAgent] Extracted currentPageContext: entity=${currentPageContext.entity}, identifier=${currentPageContext.identifier}, type=${currentPageContext.type || 'unknown'}`,
				);
			} else {
				this.logger.warn(
					`[OrchestratorAgent] Failed to extract context from message. Entity match: ${entityMatch ? 'found' : 'not found'}, Identifier match: ${identifierMatch ? 'found' : 'not found'}`,
				);
			}
		} else {
			this.logger.debug('[OrchestratorAgent] No context messages found in session');
		}

		// Build orchestrator prompt with business context, user role, and current page context
		const orchestratorPrompt = buildOrchestratorPrompt({
			recentMessages,
			query,
			isFirstMessage,
			userId,
			userRole,
			businessContext,
			currentPageContext,
		});

		try {
			this.logger.debug(`Generating orchestrator response for query: "${query}"`);
			const { text, usage } = await generateText({
				model: google(aiConfig.model),
				prompt: orchestratorPrompt,
				temperature: OrchestratorAgent.TEMPERATURE,
				maxOutputTokens: OrchestratorAgent.MAX_OUTPUT_TOKENS,
			});
			const response = text.trim();
			const tokenUsage = usage
				? {
						promptTokens: (usage as any).promptTokens || (usage as any).prompt || 0,
						completionTokens: (usage as any).completionTokens || (usage as any).completion || 0,
						totalTokens:
							(usage as any).totalTokens ||
							((usage as any).promptTokens || (usage as any).prompt || 0) +
								((usage as any).completionTokens || (usage as any).completion || 0),
					}
				: undefined;
			this.logger.debug(
				`AI response (first ${OrchestratorAgent.LOG_PREVIEW_LENGTH} chars): ${response.substring(0, OrchestratorAgent.LOG_PREVIEW_LENGTH)}...`,
			);
			// Log full response for debugging (can be enabled via log level)
			this.logger.verbose(`Full orchestrator AI response:\n${response}`);

			// Parse response to extract structured information
			const requestTypeMatch = response.match(
				/REQUEST_TYPE:\s*(QUERY|GREETING|CLARIFICATION|GENERAL_CHAT)/i,
			);
			const modeMatch = response.match(/MODE_HINT:\s*(LIST|TABLE|CHART|INSIGHT)/i);
			const entityMatch = response.match(/ENTITY_HINT:\s*(room|post|room_seeking_post|none)/i);
			const filtersMatch = response.match(/FILTERS_HINT:\s*(.+)/i);
			const tablesMatch = response.match(
				/TABLES_HINT:\s*(.+?)(?=\n(?:RELATIONSHIPS_HINT|MISSING_PARAMS|RESPONSE|$))/is,
			);
			const relationshipsMatch = response.match(
				/RELATIONSHIPS_HINT:\s*(.+?)(?=\n(?:MISSING_PARAMS|RESPONSE|$))/is,
			);
			// Parse INTENT_ACTION to detect "own" intent
			const intentActionMatch = response.match(/INTENT_ACTION:\s*(search|own|stats)/i);
			const intentAction = intentActionMatch ? intentActionMatch[1].toLowerCase() : undefined;
			// Parse RESPONSE - stop at any annotation field (INTENT_ACTION, POLARITY, CANONICAL_REUSE_OK)
			// Use non-greedy match to stop at first annotation
			const responseMatch = response.match(
				/RESPONSE:\s*([\s\S]+?)(?=\n(?:INTENT_ACTION|POLARITY|CANONICAL_REUSE_OK|REQUEST_TYPE|MODE_HINT|ENTITY_HINT|FILTERS_HINT|TABLES_HINT|RELATIONSHIPS_HINT|MISSING_PARAMS|$))/i,
			);

			let requestType = requestTypeMatch
				? (requestTypeMatch[1] as RequestType)
				: RequestType.GENERAL_CHAT;

			let message = responseMatch
				? responseMatch[1].trim()
				: this.getDefaultResponse(query, isFirstMessage);

			// SECURITY CHECK: If user asks about personal data (INTENT_ACTION=own) but not logged in, force CLARIFICATION
			if (intentAction === OrchestratorAgent.INTENT_ACTION_OWN && !userId) {
				this.logger.warn(
					`User asked about personal data (INTENT_ACTION=own) but not logged in. Forcing CLARIFICATION. Query: "${query}"`,
				);
				requestType = RequestType.CLARIFICATION;
				// Override message to request login if not already requesting login
				if (
					!message.toLowerCase().includes(OrchestratorAgent.LOGIN_KEYWORD_VI) &&
					!message.toLowerCase().includes(OrchestratorAgent.LOGIN_KEYWORD_EN)
				) {
					message = OrchestratorAgent.DEFAULT_LOGIN_MESSAGE;
				}
			}

			// Remove user role tags from message if present (should not be shown to users)
			// Tags like [LANDLORD], [TENANT], [GUEST] should only be used internally between agents
			message = message
				.replace(OrchestratorAgent.ROLE_TAG_LANDLORD, '')
				.replace(OrchestratorAgent.ROLE_TAG_TENANT, '')
				.replace(OrchestratorAgent.ROLE_TAG_GUEST, '')
				.replace(/\s+/g, ' ')
				.trim();

			// Remove internal annotations that might leak into RESPONSE (defensive cleanup)
			// These are internal metadata and should never be shown to users
			message = message
				.replace(/\n*\s*INTENT_ACTION:\s*\w+.*/gi, '')
				.replace(/\n*\s*POLARITY:\s*\w+.*/gi, '')
				.replace(/\n*\s*CANONICAL_REUSE_OK:\s*\w+.*/gi, '')
				.replace(/\n*\s*REQUEST_TYPE:\s*\w+.*/gi, '')
				.replace(/\n*\s*MODE_HINT:\s*\w+.*/gi, '')
				.replace(/\n*\s*ENTITY_HINT:\s*\w+.*/gi, '')
				.replace(/\n*\s*FILTERS_HINT:\s*.+?$/gim, '')
				.replace(/\n*\s*TABLES_HINT:\s*.+?$/gim, '')
				.replace(/\n*\s*RELATIONSHIPS_HINT:\s*.+?$/gim, '')
				.replace(/\n*\s*MISSING_PARAMS:\s*.+?$/gim, '')
				.replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
				.trim();

			// Parse MISSING_PARAMS for clarification (MVP)
			const missingParamsMatch = response.match(/MISSING_PARAMS:\s*(.+?)(?=\n(?:RESPONSE|$))/s);
			let missingParams: MissingParam[] | undefined;
			if (missingParamsMatch) {
				const paramsStr = missingParamsMatch[1].trim();
				// MVP: Validate - ignore if empty, "none", "null", or contains RESPONSE text (AI might have mixed up fields)
				if (
					paramsStr &&
					paramsStr !== OrchestratorAgent.VALIDATION_NONE &&
					paramsStr !== OrchestratorAgent.VALIDATION_NULL &&
					!paramsStr.includes(OrchestratorAgent.ANNOTATION_RESPONSE) &&
					!paramsStr.includes(OrchestratorAgent.ROLE_TAG_LANDLORD) &&
					!paramsStr.includes(OrchestratorAgent.ROLE_TAG_TENANT) &&
					!paramsStr.includes(OrchestratorAgent.ROLE_TAG_GUEST) &&
					paramsStr.length > 0
				) {
					const params = paramsStr
						.split(OrchestratorAgent.DELIMITER_PARAM)
						.map((param) => param.trim())
						.filter((p) => p.length > 0);
					if (params.length > 0) {
						missingParams = params
							.map((param): MissingParam | null => {
								const parts = param.split(OrchestratorAgent.DELIMITER_KEY_VALUE);
								if (parts.length >= OrchestratorAgent.MIN_PARTS_FOR_MISSING_PARAM) {
									const name = parts[0].trim();
									const reason = parts[1].trim();
									// MVP: Validate that name and reason are not empty or user labels
									if (
										!name ||
										!reason ||
										name === OrchestratorAgent.VALIDATION_NONE ||
										reason === OrchestratorAgent.VALIDATION_NONE ||
										name.includes(OrchestratorAgent.ROLE_TAG_LANDLORD) ||
										name.includes(OrchestratorAgent.ROLE_TAG_TENANT) ||
										name.includes(OrchestratorAgent.ROLE_TAG_GUEST) ||
										reason.includes(OrchestratorAgent.ROLE_TAG_LANDLORD) ||
										reason.includes(OrchestratorAgent.ROLE_TAG_TENANT) ||
										reason.includes(OrchestratorAgent.ROLE_TAG_GUEST)
									) {
										return null;
									}
									const examples =
										parts.length > 2 && parts[2].trim()
											? parts[2]
													.split(OrchestratorAgent.DELIMITER_EXAMPLES)
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
			// SECURITY: Also check if user asks about personal data but not logged in
			let readyForSql =
				requestType === RequestType.QUERY && (!missingParams || missingParams.length === 0);

			// SECURITY CHECK: If user asks about personal data but not logged in, force readyForSql=false
			if (intentAction === OrchestratorAgent.INTENT_ACTION_OWN && !userId) {
				readyForSql = false;
				this.logger.debug(
					'Forcing readyForSql=false because INTENT_ACTION=own but userId is missing',
				);
			}

			// Clear missingParams if readyForSql is true (contradiction - shouldn't happen)
			const finalMissingParams =
				readyForSql || requestType !== RequestType.QUERY ? undefined : missingParams;

			const parsedTablesHint =
				tablesMatch?.[1]?.trim() && tablesMatch[1].trim() !== OrchestratorAgent.VALIDATION_NONE
					? tablesMatch[1].trim()
					: undefined;
			const parsedRelationshipsHint =
				relationshipsMatch?.[1]?.trim() &&
				relationshipsMatch[1].trim() !== OrchestratorAgent.VALIDATION_NONE
					? relationshipsMatch[1].trim()
					: undefined;

			this.logger.debug(
				`Parsed requestType: ${requestType}, userRole: ${userRole}, readyForSql: ${readyForSql}` +
					`${finalMissingParams ? `, missingParams: [${finalMissingParams.length}]` : ''}` +
					`${parsedTablesHint ? `, tablesHint: ${parsedTablesHint}` : ''}` +
					`${parsedRelationshipsHint ? `, relationshipsHint: ${parsedRelationshipsHint}` : ''}` +
					`${modeMatch ? `, modeHint: ${modeMatch[1]}` : ''}` +
					`${entityMatch && entityMatch[1] !== OrchestratorAgent.VALIDATION_NONE ? `, entityHint: ${entityMatch[1]}` : ''}` +
					`${filtersMatch ? `, filtersHint: ${filtersMatch[1].trim().substring(0, OrchestratorAgent.FILTERS_HINT_PREVIEW_LENGTH)}` : ''}`,
			);

			return {
				message,
				requestType,
				userRole,
				userId,
				prompt: orchestratorPrompt,
				rawResponse: response,
				recentMessages,
				currentPageContext,
				businessContext: businessContext || undefined,
				readyForSql,
				needsClarification:
					requestType === RequestType.CLARIFICATION ||
					(finalMissingParams && finalMissingParams.length > 0),
				missingParams: finalMissingParams,
				needsIntroduction: requestType === RequestType.GREETING,
				intentModeHint: modeMatch
					? (modeMatch[1] as 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT')
					: undefined,
				entityHint:
					entityMatch && entityMatch[1] !== OrchestratorAgent.VALIDATION_NONE
						? (entityMatch[1] as 'room' | 'post' | 'room_seeking_post')
						: undefined,
				filtersHint: filtersMatch ? filtersMatch[1].trim() : undefined,
				tablesHint: parsedTablesHint,
				relationshipsHint: parsedRelationshipsHint,
				intentAction: intentAction as 'search' | 'own' | 'stats' | undefined,
				tokenUsage,
			};
		} catch (error) {
			this.logger.error('Orchestrator agent error:', error);
			return {
				message: this.getDefaultResponse(query, isFirstMessage),
				requestType: RequestType.GENERAL_CHAT,
				userRole,
				userId,
				prompt: orchestratorPrompt,
				businessContext: businessContext || undefined,
				readyForSql: false,
				needsClarification: true,
				tokenUsage: undefined,
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
			? OrchestratorAgent.DEFAULT_GREETING_MESSAGE
			: OrchestratorAgent.DEFAULT_SEARCH_MESSAGE;
	}
}
