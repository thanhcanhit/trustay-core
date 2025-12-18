import { google } from '@ai-sdk/google';
import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { BuildingsService } from '../api/buildings/buildings.service';
import { AddressService } from '../api/provinces/address/address.service';
import { RoomsService } from '../api/rooms/rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatSessionQueueService } from '../queue/services/chat-session-queue.service';
import { OrchestratorAgent } from './agents/orchestrator-agent';
import { QuestionExpansionAgent } from './agents/question-expansion-agent';
import { ResponseGenerator } from './agents/response-generator';
import { ResultValidatorAgent } from './agents/result-validator-agent';
import { SqlGenerationAgent } from './agents/sql-generation-agent';
import { KnowledgeService } from './knowledge/knowledge.service';
import { buildOneForAllPrompt } from './prompts/simple-system-one-for-all';
import { VIETNAMESE_LOCALE_SYSTEM_PROMPT } from './prompts/system.prompt';
import { AiProcessingLogService } from './services/ai-processing-log.service';
import { ChatSessionService } from './services/chat-session.service';
import { generateErrorResponse } from './services/error-handler.service';
import { PendingKnowledgeService } from './services/pending-knowledge.service';
import {
	RoomPublishingService,
	RoomPublishingStepResult,
} from './services/room-publishing.service';
import {
	ChatMessage,
	ChatResponse,
	ChatSession,
	DataPayload,
	RequestType,
	SqlGenerationResult,
	TableColumn,
} from './types/chat.types';
import { RoomPublishingStatus } from './types/room-publishing.types';
import {
	inferColumns,
	isListLike,
	normalizeRows,
	selectImportantColumns,
	toListItems,
	tryBuildChart,
} from './utils/data-utils';
import { buildEntityPath } from './utils/entity-route';
import { parseResponseText } from './utils/response-parser';
import { getCompleteDatabaseSchema } from './utils/schema-provider';
import { serializeBigInt } from './utils/serializer';
import { isAggregateQuery, validateSqlSafety } from './utils/sql-safety';
export { ChatResponse };

/**
 * Conversation management methods - New API variant
 * These methods work with explicit conversation IDs
 */

@Injectable()
export class AiService {
	// AI Constants
	private readonly AI_CONFIG = {
		temperature: 0.1,
		maxTokens: 500,
		limit: 100,
		model: 'gemini-2.0-flash',
	};

	// Logger for debugging
	private readonly logger = new Logger(AiService.name);

	// AI Agents
	private orchestratorAgent: OrchestratorAgent;
	private sqlGenerationAgent: SqlGenerationAgent;
	private readonly responseGenerator = new ResponseGenerator();
	private readonly resultValidatorAgent = new ResultValidatorAgent();
	private readonly questionExpansionAgent = new QuestionExpansionAgent();

	// Chat session management - using database-backed ChatSessionService
	private readonly SUMMARY_THRESHOLD = 10; // Trigger summary generation when messageCount > this
	private readonly AUTO_TITLE_MESSAGE_COUNT = 2; // Trigger auto-title when session has this many messages

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
		private readonly roomPublishingService: RoomPublishingService,
		private readonly buildingsService: BuildingsService,
		private readonly roomsService: RoomsService,
		private readonly addressService: AddressService,
		private readonly processingLogService: AiProcessingLogService,
		private readonly pendingKnowledgeService: PendingKnowledgeService,
		private readonly chatSessionService: ChatSessionService,
		private readonly chatSessionQueueService: ChatSessionQueueService,
	) {
		// Initialize orchestrator agent with Prisma and KnowledgeService
		this.orchestratorAgent = new OrchestratorAgent(this.prisma, this.knowledge);
		// Initialize SQL generation agent with knowledge service for RAG
		this.sqlGenerationAgent = new SqlGenerationAgent(this.knowledge);
	}

	/**
	 * Format step-based log message with a consistent, prominent tag
	 */
	private formatStep(step: string, message: string): string {
		const tag = `[${step}@ai.service.ts]`;
		return `${tag} ${message}`;
	}

	private logDebug(step: string, message: string): void {
		this.logger.debug(this.formatStep(step, message));
	}

	private logInfo(step: string, message: string): void {
		this.logger.log(this.formatStep(step, message));
	}

	private logWarn(step: string, message: string, err?: unknown): void {
		this.logger.warn(this.formatStep(step, message), err as any);
	}

	private logError(step: string, message: string, err?: unknown): void {
		this.logger.error(this.formatStep(step, message), err as any);
	}

	/**
	 * Save processing log safely with error handling
	 * Đảm bảo log luôn được lưu, kể cả khi có lỗi xảy ra
	 */
	private async saveProcessingLogSafely(
		query: string,
		processingLogData: any,
		canonicalQuestion?: string,
	): Promise<string | null> {
		try {
			const logId = await this.processingLogService.saveProcessingLog({
				question: query,
				canonicalQuestion,
				...processingLogData,
			});
			if (logId) {
				this.logInfo(
					'PROCESSING_LOG',
					`✅ Saved processing log | id=${logId} | question="${query.substring(0, 50)}..." | status=${processingLogData.status || 'N/A'} | duration=${processingLogData.totalDuration || 'N/A'}ms`,
				);
			} else {
				this.logWarn(
					'PROCESSING_LOG',
					`⚠️ Failed to save processing log (returned null) | question="${query.substring(0, 50)}..." | status=${processingLogData.status || 'N/A'}`,
				);
			}
			return logId;
		} catch (logErr) {
			// Log error nhưng không throw để không ảnh hưởng đến response
			this.logError(
				'PROCESSING_LOG',
				`❌ Exception while saving processing log | question="${query.substring(0, 50)}..." | status=${processingLogData.status || 'N/A'}`,
				logErr,
			);
			return null;
		}
	}

	/**
	 * Structured pipeline banners for easier tracing across a full question lifecycle
	 */
	private logPipelineStart(question: string, sessionId: string): number {
		const bannerTop = '==================== START PIPELINE ====================';
		const bannerBottom = '========================================================';
		const header = `PIPELINE@ai.service.ts | session=${sessionId}`;
		this.logger.log(`${bannerTop}`);
		this.logger.log(`[${header}] question: "${question}"`);
		this.logger.log(`${bannerBottom}`);
		return Date.now();
	}

	private logPipelineEnd(
		sessionId: string,
		outcome: string,
		startedAtMs: number,
		tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number },
	): void {
		const tookMs = Date.now() - startedAtMs;
		const bannerTop = '===================== END PIPELINE =====================';
		const bannerBottom = '========================================================';
		const header = `PIPELINE@ai.service.ts | session=${sessionId}`;
		this.logger.log(`${bannerTop}`);
		this.logger.log(`[${header}] outcome=${outcome} took=${tookMs}ms`);
		if (tokenUsage) {
			this.logger.log(
				`[${header}] tokens: prompt=${tokenUsage.promptTokens} completion=${tokenUsage.completionTokens} total=${tokenUsage.totalTokens}`,
			);
		}
		this.logger.log(`${bannerBottom}`);
	}

	/**
	 * Convert database session to ChatSession format
	 * @param dbSession - Database session from ChatSessionService
	 * @param clientIp - Client IP (not stored in DB, passed separately)
	 * @returns ChatSession format
	 */
	private convertDbSessionToChatSession(dbSession: any, clientIp?: string): ChatSession {
		const messages: ChatMessage[] = dbSession.messages
			? dbSession.messages.map((m: any) => ({
					role: m.role as 'user' | 'assistant' | 'system',
					content: m.content,
					timestamp: new Date(m.createdAt),
					kind: (m.metadata as any)?.kind,
					payload: (m.metadata as any)?.payload,
					meta: (m.metadata as any)?.meta,
				}))
			: [];
		// Không thêm system prompt vào in-memory session (chỉ dùng khi build prompt)
		// System prompt sẽ được inject vào prompt khi gọi LLM, không cần lưu vào session
		return {
			sessionId: dbSession.id,
			userId: dbSession.userId || undefined,
			clientIp,
			messages,
			lastActivity: dbSession.lastMessageAt
				? new Date(dbSession.lastMessageAt)
				: new Date(dbSession.createdAt),
			createdAt: new Date(dbSession.createdAt),
		};
	}

	/**
	 * Get or create chat session - using database-backed ChatSessionService
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Chat session
	 */
	private async getOrCreateSession(userId?: string, clientIp?: string): Promise<ChatSession> {
		const dbSession = await this.chatSessionService.getOrCreateSession(userId, clientIp);
		// Không lưu system prompt vào DB, chỉ dùng trong memory cho processing
		// Reload session with messages
		const sessionWithMessages = await this.chatSessionService.getSession(dbSession.id);
		return this.convertDbSessionToChatSession(sessionWithMessages || dbSession, clientIp);
	}

	/**
	 * Extract last SQL query from session messages metadata
	 * Query from database to ensure we get the latest data
	 * @param sessionId - Session ID
	 * @returns Last SQL query or null
	 */
	private async extractLastSqlFromSession(sessionId: string): Promise<string | null> {
		try {
			// Query recent messages from database to get latest SQL
			const recentMessages = await this.chatSessionService.getRecentMessages(sessionId, 20);
			// Look for last assistant message with SQL in metadata
			for (const msg of recentMessages) {
				if (msg.role === 'assistant' && msg.metadata) {
					const metadata = msg.metadata as any;
					// Check metadata.sql (stored directly)
					if (metadata.sql) {
						return metadata.sql as string;
					}
					// Check payload.sql (from DATA payload)
					if (metadata.payload?.sql) {
						return metadata.payload.sql as string;
					}
					// Check meta.sql (from envelope meta)
					if (metadata.meta?.sql) {
						return metadata.meta.sql as string;
					}
				}
			}
			return null;
		} catch (error) {
			this.logger.warn(`Failed to extract SQL from session: ${sessionId}`, error);
			return null;
		}
	}

	/**
	 * Extract last canonical question from session messages metadata
	 * Query from database to ensure we get the latest data
	 * @param sessionId - Session ID
	 * @returns Last canonical question or null
	 */
	private async extractLastCanonicalQuestionFromSession(sessionId: string): Promise<string | null> {
		try {
			// Query recent messages from database to get latest canonical question
			const recentMessages = await this.chatSessionService.getRecentMessages(sessionId, 20);
			// Look for last assistant message with canonical question in metadata
			for (const msg of recentMessages) {
				if (msg.role === 'assistant' && msg.metadata) {
					const metadata = msg.metadata as any;
					// Check metadata.canonicalQuestion (stored directly)
					if (metadata.canonicalQuestion) {
						return metadata.canonicalQuestion as string;
					}
					// Check meta.canonicalQuestion (from envelope meta)
					if (metadata.meta?.canonicalQuestion) {
						return metadata.meta.canonicalQuestion as string;
					}
					// Check payload.meta.canonicalQuestion
					if (metadata.payload?.meta?.canonicalQuestion) {
						return metadata.payload.meta.canonicalQuestion as string;
					}
				}
			}
			return null;
		} catch (error) {
			this.logger.warn(`Failed to extract canonical question from session: ${sessionId}`, error);
			return null;
		}
	}

	/**
	 * Add message to session with AI SDK CoreMessage format
	 * Now saves to database via ChatSessionService
	 * @param session - Chat session
	 * @param role - Message role
	 * @param content - Message content
	 * @param envelope - Optional envelope with kind, payload, meta
	 * @param triggerJobs - Whether to trigger background jobs (default: true for assistant messages)
	 * @param sqlQuery - Optional SQL query to store in metadata
	 * @param canonicalQuestion - Optional canonical question to store in metadata
	 */
	private async addMessageToSession(
		session: ChatSession,
		role: 'user' | 'assistant' | 'system',
		content: string,
		envelope?: {
			kind?: 'CONTENT' | 'DATA' | 'CONTROL';
			payload?: any;
			meta?: Record<string, unknown>;
		},
		triggerJobs: boolean = role === 'assistant',
		sqlQuery?: string,
		canonicalQuestion?: string,
	): Promise<void> {
		// Prepare metadata for database storage
		const metadata: Record<string, unknown> = {};
		if (envelope?.kind) {
			metadata.kind = envelope.kind;
		}
		if (envelope?.payload) {
			metadata.payload = envelope.payload;
		}
		if (envelope?.meta) {
			metadata.meta = envelope.meta;
		}
		// Store SQL query and canonical question in metadata if provided
		if (sqlQuery) {
			metadata.sql = sqlQuery;
		}
		if (canonicalQuestion) {
			metadata.canonicalQuestion = canonicalQuestion;
		}
		// Save to database
		await this.chatSessionService.addMessage(session.sessionId, role, content, metadata);
		// Update in-memory session for backward compatibility (will be refactored later)
		const message: ChatMessage = {
			role,
			content,
			timestamp: new Date(),
			kind: envelope?.kind,
			payload: envelope?.payload as any,
			meta: {
				...(envelope?.meta as Record<string, string | number | boolean> | undefined),
				...(sqlQuery ? { sql: sqlQuery } : {}),
				...(canonicalQuestion ? { canonicalQuestion } : {}),
			},
		};
		session.messages.push(message);
		session.lastActivity = new Date();
		// Trigger background jobs if this is an assistant message
		if (triggerJobs && role === 'assistant') {
			// Trigger background jobs - will get user message from DB
			await this.triggerBackgroundJobs(session);
		}
	}

	/**
	 * Trigger background jobs (auto-title, summary) after adding assistant message
	 * @param session - Chat session
	 */
	private async triggerBackgroundJobs(session: ChatSession): Promise<void> {
		try {
			const dbSession = await this.chatSessionService.getSession(session.sessionId);
			if (!dbSession) {
				return;
			}
			// Trigger auto-title if session has exactly AUTO_TITLE_MESSAGE_COUNT messages
			// (1 user + 1 assistant, excluding system messages)
			// Count only user and assistant messages from DB
			const allMessages = await this.chatSessionService.getRecentMessages(session.sessionId, 10);
			const userAssistantMessages = allMessages.filter(
				(m) => m.role === 'user' || m.role === 'assistant',
			);
			if (userAssistantMessages.length === this.AUTO_TITLE_MESSAGE_COUNT) {
				// Get first user message from DB
				const firstUserMessage = allMessages.reverse().find((m) => m.role === 'user')?.content;
				if (firstUserMessage) {
					await this.chatSessionQueueService.queueAutoTitle(session.sessionId, firstUserMessage);
					this.logger.debug(
						`Queued auto-title job | sessionId=${session.sessionId} | messageCount=${dbSession.messageCount} | userAssistantCount=${userAssistantMessages.length}`,
					);
				} else {
					this.logger.warn(
						`Auto-title skipped: No user message found | sessionId=${session.sessionId} | messageCount=${dbSession.messageCount}`,
					);
				}
			}
			// Trigger summary generation if messageCount > threshold
			if (dbSession.messageCount > this.SUMMARY_THRESHOLD) {
				await this.chatSessionQueueService.queueSummaryGeneration(
					session.sessionId,
					5, // Summarize last 5 old messages
				);
				this.logger.debug(`Queued summary generation job | sessionId=${session.sessionId}`);
			}
		} catch (error) {
			this.logger.warn(`Failed to trigger background jobs: ${(error as Error).message}`, error);
		}
	}

	/**
	 * Build prompt with context (summary + recent messages)
	 * @param session - Chat session
	 * @param currentQuery - Current user query
	 * @returns Formatted prompt string
	 */
	private async buildPromptWithContext(
		session: ChatSession,
		currentQuery: string,
	): Promise<string> {
		// Get session from database to access summary
		const dbSession = await this.chatSessionService.getSession(session.sessionId);
		const summary = dbSession?.summary || null;
		// Get recent messages (last 10)
		const recentMessages = await this.chatSessionService.getRecentMessages(session.sessionId, 10);
		// Build prompt sections
		const sections: string[] = [];
		// System instruction (from system prompt)
		sections.push(VIETNAMESE_LOCALE_SYSTEM_PROMPT);
		// Long-term summary (if exists)
		if (summary) {
			sections.push(`\n[CONTEXT SUMMARY]\n${summary}\n`);
		}
		// Short-term history (recent messages) - chỉ lấy user và assistant messages
		const userAssistantMessages = recentMessages.filter(
			(m) => m.role === 'user' || m.role === 'assistant',
		);
		if (userAssistantMessages.length > 0) {
			const historyText = userAssistantMessages
				.reverse() // Reverse to get chronological order
				.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
				.join('\n\n');
			sections.push(`\n[RECENT CONVERSATION]\n${historyText}\n`);
			// Inject SQL query from metadata if available
			// recentMessages is already in DESC order (newest first), so find() will get the newest SQL
			const lastSqlMessage = recentMessages.find(
				(m) => m.metadata && (m.metadata as any)?.payload?.sql,
			);
			if (lastSqlMessage && (lastSqlMessage.metadata as any)?.payload?.sql) {
				const sql = (lastSqlMessage.metadata as any).payload.sql;
				sections.push(`\n[LAST SQL QUERY]\n${sql}\n`);
			}
		}
		// Current user input
		sections.push(`\n[CURRENT QUERY]\n${currentQuery}`);
		return sections.join('\n');
	}

	/**
	 * Dedicated room publishing endpoint - Separate from main chat flow
	 * @param message - User message about room information
	 * @param context - User context (userId, clientIp, buildingId, images)
	 * @returns ChatResponse for room publishing flow
	 */
	async publishRoom(
		message: string,
		context: { userId: string; clientIp?: string; buildingId?: string; images?: string[] },
	): Promise<ChatResponse> {
		const { userId, clientIp, buildingId, images } = context;
		if (!userId) {
			throw new Error('User must be authenticated to publish room');
		}

		const session = await this.getOrCreateSession(userId, clientIp);
		const pipelineStartAt = this.logPipelineStart(message, session.sessionId);

		this.logDebug('ROOM_PUBLISH', `Starting room publishing flow for user ${userId}`);
		if (buildingId) {
			this.logDebug('ROOM_PUBLISH', `Building ID provided: ${buildingId}`);
		}

		// Lưu câu hỏi của người dùng vào session
		await this.addMessageToSession(session, 'user', message);

		try {
			// Step 1: Handle user message
			this.logInfo('ROOM_PUBLISH', '[STEP 1/4] handleUserMessage - Processing user input');
			let stepResult = await this.roomPublishingService.handleUserMessage(
				session,
				message,
				images,
				buildingId,
			);
			this.logInfo(
				'ROOM_PUBLISH',
				`[STEP 1/4] handleUserMessage - Completed | stage=${stepResult.stage} status=${stepResult.status} actions=${stepResult.actions?.length || 0}`,
			);

			// Step 2: Resolve actions (lookup location, list buildings, etc.)
			if (stepResult.actions && stepResult.actions.length > 0) {
				this.logInfo(
					'ROOM_PUBLISH',
					`[STEP 2/4] resolveRoomPublishingActions - Processing ${stepResult.actions.length} action(s)`,
				);
				stepResult.actions.forEach((action, idx) => {
					this.logDebug(
						'ROOM_PUBLISH',
						`[STEP 2/4] Action ${idx + 1}: ${action.type} - ${action.description}`,
					);
				});
			} else {
				this.logInfo(
					'ROOM_PUBLISH',
					'[STEP 2/4] resolveRoomPublishingActions - No actions to process',
				);
			}
			stepResult = await this.resolveRoomPublishingActions(session, stepResult);
			this.logInfo(
				'ROOM_PUBLISH',
				`[STEP 2/4] resolveRoomPublishingActions - Completed | stage=${stepResult.stage} status=${stepResult.status} planReady=${stepResult.executionPlan ? 'yes' : 'no'}`,
			);

			// Step 3: Execute room creation if ready
			if (
				stepResult.status === RoomPublishingStatus.READY_TO_CREATE &&
				stepResult.executionPlan &&
				(!message || message.trim() === '')
			) {
				this.logInfo(
					'ROOM_PUBLISH',
					'[STEP 3/4] executeRoomCreation - Auto-creating room (empty message + plan ready)',
				);
				stepResult = await this.executeRoomCreation(userId, stepResult);
				this.logInfo(
					'ROOM_PUBLISH',
					`[STEP 3/4] executeRoomCreation - Completed | status=${stepResult.status} roomId=${stepResult.roomId || 'N/A'}`,
				);
			} else {
				this.logInfo(
					'ROOM_PUBLISH',
					'[STEP 3/4] executeRoomCreation - Skipped (not ready or message not empty)',
				);
			}

			// Step 4: Build response
			this.logInfo('ROOM_PUBLISH', '[STEP 4/4] buildRoomFlowResponse - Building final response');
			this.logInfo(
				'ROOM_PUBLISH',
				`Final state: stage=${stepResult.stage} status=${stepResult.status} planReady=${stepResult.executionPlan ? 'yes' : 'no'}`,
			);
			const meta: Record<string, string | number | boolean> = {
				stage: stepResult.stage,
			};
			const response = this.buildRoomFlowResponse(session, stepResult, meta);
			this.logInfo('ROOM_PUBLISH', '[STEP 4/4] buildRoomFlowResponse - Completed');
			this.logPipelineEnd(session.sessionId, 'ROOM_PUBLISH', pipelineStartAt);
			return response;
		} catch (error) {
			this.logError('ROOM_PUBLISH', `Error in room publishing flow`, error);
			const errorMessage = generateErrorResponse((error as Error).message);
			const messageText: string = `Xin lỗi, đã xảy ra lỗi khi xử lý đăng phòng: ${errorMessage}`;
			await this.addMessageToSession(session, 'assistant', messageText, {
				kind: 'CONTROL',
				payload: { mode: 'ERROR', details: (error as Error).message },
			});
			const response: ChatResponse = {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message: messageText,
				payload: { mode: 'ERROR', details: (error as Error).message },
			};
			this.logPipelineEnd(session.sessionId, 'ROOM_PUBLISH_ERROR', pipelineStartAt);
			return response;
		}
	}

	private async resolveRoomPublishingActions(
		session: ChatSession,
		initialStep: RoomPublishingStepResult,
	): Promise<RoomPublishingStepResult> {
		let stepResult = initialStep;
		let guard = 0;
		while (stepResult.actions && stepResult.actions.length > 0 && guard < 5) {
			for (const action of stepResult.actions) {
				try {
					this.logDebug('ROOM_FLOW', `[TOOL CALL] Executing action: ${action.type}`);
					const actionStartTime = Date.now();
					let data: Array<Record<string, unknown>> = [];

					if (
						action.type === 'LIST_OWNER_BUILDINGS' &&
						action.params.userId &&
						action.params.keyword
					) {
						// Gọi BuildingsService thay vì SQL
						this.logInfo(
							'ROOM_FLOW',
							`[TOOL CALL] buildingsService.findQuickListByOwner(userId=${action.params.userId})`,
						);
						const buildings = await this.buildingsService.findQuickListByOwner(
							action.params.userId,
						);
						this.logInfo(
							'ROOM_FLOW',
							`[TOOL CALL] buildingsService.findQuickListByOwner - Found ${buildings.length} buildings`,
						);

						// Filter buildings by keyword
						const keyword = action.params.keyword.toLowerCase();
						const filteredBuildings = buildings.filter(
							(b) =>
								b.name.toLowerCase().includes(keyword) ||
								(b.location.districtName?.toLowerCase().includes(keyword) ?? false) ||
								(b.location.provinceName?.toLowerCase().includes(keyword) ?? false),
						);
						this.logInfo(
							'ROOM_FLOW',
							`[TOOL CALL] Filtered to ${filteredBuildings.length} buildings matching keyword "${keyword}"`,
						);

						// Map to BuildingCandidate format
						data = filteredBuildings.slice(0, 5).map((b) => ({
							id: b.id,
							name: b.name,
							slug: b.id, // QuickList uses id as slug
							address_line1: undefined,
							ward_id: null,
							district_id: undefined,
							province_id: undefined,
							district_name: b.location.districtName || undefined,
							province_name: b.location.provinceName || undefined,
							match_score: 0.8,
						}));
						this.logInfo(
							'ROOM_FLOW',
							`[TOOL CALL] LIST_OWNER_BUILDINGS - Returning ${data.length} candidates`,
						);
					} else if (action.type === 'LOOKUP_LOCATION' && action.params.locationQuery) {
						// Gọi AddressService thay vì SQL
						this.logInfo(
							'ROOM_FLOW',
							`[TOOL CALL] addressService.search(query="${action.params.locationQuery}")`,
						);
						const searchResult = await this.addressService.search(action.params.locationQuery);
						this.logInfo(
							'ROOM_FLOW',
							`[TOOL CALL] addressService.search - Found ${searchResult.results.districts.length} districts, ${searchResult.results.provinces.length} provinces`,
						);

						// Ưu tiên districts (vì thường có district + province)
						// Nếu không tìm được, lấy item đầu tiên (fallback)
						if (searchResult.results.districts.length > 0) {
							const district = searchResult.results.districts[0];
							data = [
								{
									district_id: district.id,
									district_name: district.name,
									province_id: district.provinceId,
									province_name: district.province?.name,
									confidence_score: 0.8,
								},
							];
							this.logInfo(
								'ROOM_FLOW',
								`[TOOL CALL] LOOKUP_LOCATION - Selected district: ${district.name} (id=${district.id})`,
							);
						} else if (searchResult.results.provinces.length > 0) {
							// Fallback: Lấy province đầu tiên nếu không có district
							const province = searchResult.results.provinces[0];
							data = [
								{
									province_id: province.id,
									province_name: province.name,
									confidence_score: 0.7,
								},
							];
							this.logInfo(
								'ROOM_FLOW',
								`[TOOL CALL] LOOKUP_LOCATION - Selected province (fallback): ${province.name} (id=${province.id})`,
							);
						} else {
							// Không tìm được gì cả - sẽ được xử lý bởi applyLocationResults (set locationLookupFailed = true)
							this.logInfo(
								'ROOM_FLOW',
								`[TOOL CALL] LOOKUP_LOCATION - No results found for "${action.params.locationQuery}"`,
							);
						}
					}

					const normalizedRows = serializeBigInt(data) as Array<Record<string, unknown>>;
					const actionDuration = Date.now() - actionStartTime;
					this.logInfo(
						'ROOM_FLOW',
						`[TOOL CALL] Action ${action.type} completed in ${actionDuration}ms`,
					);

					this.logDebug(
						'ROOM_FLOW',
						`[TOOL CALL] roomPublishingService.applyActionResult(action=${action.type})`,
					);
					stepResult = await this.roomPublishingService.applyActionResult(
						session,
						action,
						normalizedRows,
					);
					this.logDebug(
						'ROOM_FLOW',
						`[TOOL CALL] roomPublishingService.applyActionResult - Completed`,
					);
				} catch (error) {
					this.logError('ROOM_FLOW', `[TOOL CALL] Action ${action.type} failed`, error);
				}
			}
			guard += 1;
		}
		return stepResult;
	}

	private buildRoomFlowResponse(
		session: ChatSession,
		stepResult: RoomPublishingStepResult,
		meta: Record<string, string | number | boolean>,
	): ChatResponse {
		if (stepResult.missingField?.key) {
			meta.missingField = stepResult.missingField.key;
		}
		if (stepResult.draft.building.candidates) {
			meta.buildingCandidates = stepResult.draft.building.candidates.length;
		}
		if (stepResult.actions && stepResult.actions.length > 0) {
			meta.pendingActions = stepResult.actions.length;
			meta.actionTypes = stepResult.actions.map((a) => a.type).join(',');
		}

		// Đảm bảo message luôn có giá trị rõ ràng
		let message = stepResult.prompt || 'Xin chào! Mình sẽ giúp bạn đăng phòng.';

		// Nếu message quá ngắn hoặc không rõ ràng, cải thiện dựa trên status
		if (message.length < 10 || message.includes('Đang xử lý') || message.includes('...')) {
			switch (stepResult.status) {
				case RoomPublishingStatus.READY_TO_CREATE:
					message = stepResult.executionPlan
						? `Tuyệt vời! Mình đã có đủ thông tin để tạo phòng trọ cho bạn.${stepResult.draft.room.images.length === 0 ? ' Bạn có muốn thêm hình ảnh không? (Không bắt buộc)' : ''}`
						: message;
					break;
				case RoomPublishingStatus.NEED_MORE_INFO:
					if (stepResult.actions && stepResult.actions.length > 0) {
						// Đang chờ action results
						if (stepResult.actions.some((a) => a.type === 'LOOKUP_LOCATION')) {
							message = 'Đang tìm kiếm thông tin địa điểm...';
						} else if (stepResult.actions.some((a) => a.type === 'LIST_OWNER_BUILDINGS')) {
							message = 'Đang tìm kiếm tòa nhà của bạn...';
						} else {
							message = 'Đang xử lý thông tin...';
						}
					} else if (stepResult.missingField) {
						// Cần thêm thông tin cụ thể
						const fieldLabel = stepResult.missingField.label || stepResult.missingField.key;
						message = `Mình cần thêm thông tin về ${fieldLabel.toLowerCase()} để hoàn tất đăng phòng cho bạn.`;
					} else {
						message =
							'Mình cần thêm một số thông tin để hoàn tất đăng phòng. Bạn có thể cung cấp thông tin về giá thuê và địa điểm được không?';
					}
					break;
				case RoomPublishingStatus.CREATED:
					message = stepResult.roomId
						? `Đã tạo phòng thành công! Phòng của bạn đã được đăng tải.`
						: message;
					break;
				case RoomPublishingStatus.CREATION_FAILED:
					message = stepResult.error
						? `Xin lỗi, đã xảy ra lỗi khi tạo phòng: ${stepResult.error}`
						: 'Xin lỗi, đã xảy ra lỗi khi tạo phòng.';
					break;
			}
		}

		this.logDebug('ROOM_FLOW', `Response message: "${message.substring(0, 100)}..."`);
		this.logInfo(
			'ROOM_FLOW',
			`Response status: ${stepResult.status} | hasExecutionPlan: ${!!stepResult.executionPlan} | hasActions: ${!!stepResult.actions} | missingField: ${stepResult.missingField?.key || 'none'}`,
		);

		// Luôn trả về status trong payload - ĐẢM BẢO 4 TRẠNG THÁI
		const basePayload: any = {
			mode: 'ROOM_PUBLISH',
			status: stepResult.status,
		};

		// Status 1: READY_TO_CREATE
		if (stepResult.status === RoomPublishingStatus.READY_TO_CREATE && stepResult.executionPlan) {
			meta.planReady = true;
			meta.shouldCreateBuilding = stepResult.executionPlan.shouldCreateBuilding;
			return {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message,
				payload: {
					...basePayload,
					plan: stepResult.executionPlan,
				},
				meta,
			};
		}

		// Status 2: CREATED
		if (stepResult.status === RoomPublishingStatus.CREATED && stepResult.roomId) {
			return {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message,
				payload: {
					...basePayload,
					roomId: stepResult.roomId,
					roomSlug: stepResult.roomSlug,
					roomPath: stepResult.roomPath,
				},
				meta,
			};
		}

		// Status 3: CREATION_FAILED
		if (stepResult.status === RoomPublishingStatus.CREATION_FAILED && stepResult.error) {
			return {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message,
				payload: {
					...basePayload,
					error: stepResult.error,
				},
				meta,
			};
		}

		// Status 4: NEED_MORE_INFO (default)
		return {
			kind: 'CONTROL',
			sessionId: session.sessionId,
			timestamp: new Date().toISOString(),
			message,
			payload: {
				...basePayload,
				missingField: stepResult.missingField?.key,
				hasPendingActions: !!(stepResult.actions && stepResult.actions.length > 0),
			},
			meta,
		};
	}

	/**
	 * Execute room creation based on execution plan
	 * @param userId - User ID
	 * @param stepResult - Step result with execution plan
	 * @returns Updated step result with room creation status
	 */
	private async executeRoomCreation(
		userId: string,
		stepResult: RoomPublishingStepResult,
	): Promise<RoomPublishingStepResult> {
		if (!stepResult.executionPlan) {
			return {
				...stepResult,
				status: RoomPublishingStatus.CREATION_FAILED,
				error: 'No execution plan available',
			};
		}

		const { executionPlan } = stepResult;

		try {
			let finalBuildingId = executionPlan.buildingId;

			// Tạo building nếu cần
			if (executionPlan.shouldCreateBuilding && executionPlan.buildingPayload) {
				this.logInfo(
					'ROOM_PUBLISH',
					'[TOOL CALL] buildingsService.create() - Creating new building',
				);
				const buildingStartTime = Date.now();
				const building = await this.buildingsService.create(userId, executionPlan.buildingPayload);
				const buildingDuration = Date.now() - buildingStartTime;
				finalBuildingId = building.id;
				this.logInfo(
					'ROOM_PUBLISH',
					`[TOOL CALL] buildingsService.create() - Completed in ${buildingDuration}ms | buildingId=${finalBuildingId} slug=${building.slug}`,
				);
			} else {
				this.logInfo(
					'ROOM_PUBLISH',
					`[TOOL CALL] buildingsService.create() - Skipped (using existing buildingId=${finalBuildingId})`,
				);
			}

			if (!finalBuildingId) {
				this.logError(
					'ROOM_PUBLISH',
					'[TOOL CALL] Building ID validation failed - No building ID available',
				);
				return {
					...stepResult,
					status: RoomPublishingStatus.CREATION_FAILED,
					error: 'Building ID is required but not available',
				};
			}

			// Tạo room
			this.logInfo(
				'ROOM_PUBLISH',
				`[TOOL CALL] roomsService.create(buildingId=${finalBuildingId}) - Creating room`,
			);
			const roomStartTime = Date.now();
			const room = await this.roomsService.create(
				userId,
				finalBuildingId,
				executionPlan.roomPayload,
			);
			const roomDuration = Date.now() - roomStartTime;
			this.logInfo(
				'ROOM_PUBLISH',
				`[TOOL CALL] roomsService.create() - Completed in ${roomDuration}ms | roomId=${room.id} slug=${room.slug}`,
			);

			// Lưu message thành công vào session
			const successMessage = `Đã tạo phòng thành công! Phòng của bạn đã được đăng tải.`;
			const session = await this.getOrCreateSession(userId);
			this.logDebug(
				'ROOM_PUBLISH',
				'[TOOL CALL] addMessageToSession() - Saving success message to session',
			);
			await this.addMessageToSession(session, 'assistant', successMessage, {
				kind: 'CONTROL',
				payload: {
					mode: 'ROOM_PUBLISH',
					status: RoomPublishingStatus.CREATED,
					roomId: room.id,
					roomSlug: room.slug,
					roomPath: `/rooms/${room.slug}`,
				},
			});
			this.logDebug('ROOM_PUBLISH', '[TOOL CALL] addMessageToSession() - Completed');

			// Clear room publishing context để tránh nhầm context cũ khi tạo phòng mới
			if (session.context?.roomPublishing) {
				this.logDebug(
					'ROOM_PUBLISH',
					'[CLEANUP] Clearing room publishing context to prevent stale data',
				);
				session.context.roomPublishing = undefined;
				// Nếu context không còn gì khác, reset context
				if (session.context && !session.context.activeFlow) {
					session.context = undefined;
				}
			}

			this.logInfo(
				'ROOM_PUBLISH',
				`[SUCCESS] Room creation completed | roomId=${room.id} roomSlug=${room.slug} roomPath=/rooms/${room.slug}`,
			);

			return {
				...stepResult,
				status: RoomPublishingStatus.CREATED,
				prompt: successMessage,
				roomId: room.id,
				roomSlug: room.slug,
				roomPath: `/rooms/${room.slug}`,
			};
		} catch (error) {
			this.logError('ROOM_PUBLISH', '[TOOL CALL] Room creation failed', error);
			const errorMessage = (error as Error).message || 'Unknown error occurred';
			return {
				...stepResult,
				status: RoomPublishingStatus.CREATION_FAILED,
				prompt: `Xin lỗi, đã xảy ra lỗi khi tạo phòng: ${errorMessage}`,
				error: errorMessage,
			};
		}
	}

	/**
	 * Check if identifier is UUID format
	 * @param identifier - Identifier to check
	 * @returns true if UUID format
	 */
	private isUuid(identifier: string): boolean {
		// UUID v4 pattern: 8-4-4-4-12 hex digits
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		return uuidPattern.test(identifier);
	}

	/**
	 * Parse page context từ URL path để extract entity và identifier
	 * @param currentPage - URL path (ví dụ: /rooms/tuyenquan-go-vap-phong-ap1443 hoặc /rooms/uuid-123)
	 * @returns Parsed context hoặc null nếu không parse được
	 */
	private parsePageContext(currentPage: string): {
		entity: string;
		identifier: string;
		type?: 'slug' | 'id';
	} | null {
		if (!currentPage || !currentPage.startsWith('/')) {
			return null;
		}
		// Parse pattern: /rooms/{slug} hoặc /rooms/{id}
		const roomMatch = currentPage.match(/^\/rooms\/([^/?#]+)/);
		if (roomMatch) {
			const identifier = roomMatch[1];
			// Detect if identifier is UUID or slug
			const type = this.isUuid(identifier) ? 'id' : 'slug';
			return {
				entity: 'room',
				identifier,
				type,
			};
		}
		// Parse pattern: /room-seeking-posts/{slug} hoặc /room-seekings/{slug}
		const roomSeekingMatch = currentPage.match(/^\/room-seeking-posts?\/([^/?#]+)/);
		if (roomSeekingMatch) {
			return {
				entity: 'room_seeking_post',
				identifier: roomSeekingMatch[1],
				type: 'slug',
			};
		}
		// Parse pattern: /roommate-seeking-posts/{slug}
		const roommateSeekingMatch = currentPage.match(/^\/roommate-seeking-posts?\/([^/?#]+)/);
		if (roommateSeekingMatch) {
			return {
				entity: 'roommate_seeking_post',
				identifier: roommateSeekingMatch[1],
				type: 'slug',
			};
		}
		// Parse pattern: /buildings/{slug}
		const buildingMatch = currentPage.match(/^\/buildings\/([^/?#]+)/);
		if (buildingMatch) {
			return {
				entity: 'building',
				identifier: buildingMatch[1],
				type: 'slug',
			};
		}
		return null;
	}

	/**
	 * Chat với AI để truy vấn database - Flow đa agent
	 *
	 * Flow xử lý:
	 * 1. Quản lý session: Lấy hoặc tạo session chat cho user
	 * 2. Agent 1 (Conversational): Phân tích câu hỏi, xác định có đủ thông tin để tạo SQL không
	 * 3. Agent 2 (SQL Generation): Nếu đủ thông tin, tạo và thực thi SQL query
	 * 4. Agent 3 (Response Generator): Tạo câu trả lời thân thiện từ kết quả SQL
	 * 5. Persist: Lưu Q&A vào knowledge store để học hỏi
	 *
	 * @param query - Câu hỏi của người dùng
	 * @param context - Ngữ cảnh người dùng (userId, clientIp, currentPage)
	 * @param context.userId - User ID nếu đã đăng nhập
	 * @param context.clientIp - IP address của client
	 * @param context.currentPage - URL trang hiện tại người dùng đang xem (từ referer hoặc x-current-page header)
	 * @returns Phản hồi chat với lịch sử hội thoại
	 */
	async chatWithAI(
		query: string,
		context: { userId?: string; clientIp?: string; currentPage?: string } = {},
	): Promise<ChatResponse> {
		const { userId, clientIp, currentPage } = context;

		// Bước 1: Quản lý session - Lấy hoặc tạo session chat
		// Session tự động có system prompt tiếng Việt khi tạo mới
		const session = await this.getOrCreateSession(userId, clientIp);
		const pipelineStartAt = this.logPipelineStart(query, session.sessionId);
		// Use internal method to process query with explicit session
		return await this.processChatQueryWithSession(
			query,
			session,
			{ userId, clientIp, currentPage },
			pipelineStartAt,
		);
	}

	/**
	 * Core chat processing with explicit session (extracted from chatWithAI)
	 * This method processes the query using the provided session without creating a new one
	 * Used by both old API (after getOrCreateSession) and new API (with explicit conversationId)
	 * @param query - User query
	 * @param session - Chat session (already loaded)
	 * @param context - Additional context
	 * @param pipelineStartAt - Pipeline start timestamp
	 * @returns AI response
	 */
	private async processChatQueryWithSession(
		query: string,
		session: ChatSession,
		context: { userId?: string; clientIp?: string; currentPage?: string },
		pipelineStartAt: number,
	): Promise<ChatResponse> {
		const { currentPage } = context;

		// Parse và log thông tin trang hiện tại
		// Lưu vào session messages dưới dạng system message để orchestrator agent có thể đọc
		if (currentPage) {
			this.logDebug('CONTEXT', `Current page received: ${currentPage}`);
			// Parse entity và identifier từ URL path
			const contextInfo = this.parsePageContext(currentPage);
			if (contextInfo) {
				this.logInfo(
					'CONTEXT',
					`Parsed page context: entity=${contextInfo.entity}, identifier=${contextInfo.identifier}, type=${contextInfo.type || 'unknown'}`,
				);
				// Lưu context vào session messages dưới dạng system message để orchestrator agent có thể đọc
				// Format: [CONTEXT] Entity: room Identifier: slug-123 Type: slug
				const contextMessage = `[CONTEXT] Entity: ${contextInfo.entity} Identifier: ${contextInfo.identifier} Type: ${contextInfo.type || 'slug'}`;
				// Chỉ lưu vào in-memory session, không lưu vào DB (system messages không được persist)
				session.messages.push({
					role: 'system',
					content: contextMessage,
					timestamp: new Date(),
				});
			} else {
				this.logWarn('CONTEXT', `Could not parse page context from: ${currentPage}`);
			}
		} else {
			this.logDebug('CONTEXT', 'No currentPage provided');
		}

		// Lưu câu hỏi của người dùng vào session
		await this.addMessageToSession(session, 'user', query);

		// Trigger auto-title job if session has exactly 2 messages (1 user + 1 will be assistant)
		// We'll check after assistant response is added

		// Track processing data để lưu vào 1 log duy nhất (append ở từng bước)
		const processingLogData: {
			orchestratorData?: any;
			sqlGenerationAttempts?: any[];
			validatorData?: any;
			responseGeneratorData?: any;
			ragContext?: any;
			stepsLog?: string;
			response?: string;
			status?: string;
			error?: string;
			tokenUsage?: any;
			totalDuration?: number;
		} = {
			sqlGenerationAttempts: [],
		};
		// Step-by-step textual log (readable in DB)
		type StepDetail = Record<string, unknown> | string | undefined;
		const stepLogs: Array<{ title: string; detail?: StepDetail }> = [];
		const appendStep = (title: string, detail?: StepDetail) => {
			stepLogs.push({ title, detail });
		};

		const extractTableNames = (ragContext: string): string[] => {
			const regex = /"table_name"\s*:\s*"([^"]+)"/g;
			const tables = new Set<string>();
			let match: RegExpExecArray | null = regex.exec(ragContext);
			while (match) {
				if (match[1]) {
					tables.add(match[1]);
				}
				match = regex.exec(ragContext);
			}
			return Array.from(tables);
		};

		const formatKey = (key: string): string =>
			key
				.replace(/([A-Z])/g, ' $1')
				.replace(/_/g, ' ')
				.trim()
				.toUpperCase();

		const formatValue = (key: string, value: unknown): string => {
			const label = `**${formatKey(key)}**`;
			if (value === undefined || value === null) return `${label}: none`;
			if (typeof value === 'string') {
				const trimmed = value.trim();
				if (trimmed.includes('\n') || trimmed.length > 160 || key.toLowerCase().includes('sql')) {
					return `${label}:\n\`\`\`sql\n${trimmed}\n\`\`\``;
				}
				return `${label}: ${trimmed}`;
			}
			if (Array.isArray(value)) {
				return `${label}: ${value.map((v) => String(v)).join(', ') || 'none'}`;
			}
			if (typeof value === 'object') {
				return `${label}: ${JSON.stringify(value)}`;
			}
			return `${label}: ${String(value)}`;
		};

		const formatStepLogsToMarkdown = (entries: Array<{ title: string; detail?: StepDetail }>) => {
			return entries
				.map((entry, idx) => {
					const header = `## **STEP ${idx + 1} - ${entry.title.toUpperCase()}**`;
					if (!entry.detail) return header;
					if (typeof entry.detail === 'string') {
						return `${header}\n${entry.detail}`;
					}
					const lines = Object.entries(entry.detail).map(([k, v]) => `- ${formatValue(k, v)}`);
					return `${header}\n${lines.join('\n')}`;
				})
				.join('\n\n');
		};

		try {
			this.logInfo(
				'SESSION',
				`BẮT ĐẦU XỬ LÝ | session=${session.sessionId}${currentPage ? ` | page=${currentPage}` : ''} | originalQuery="${query}"`,
			);
			appendStep('SESSION START', {
				session: session.sessionId,
				page: currentPage || 'none',
				userId: session.userId || 'anonymous',
				originalQuery: query,
			});

			// ========================================
			// BƯỚC 2: Agent 1 - Orchestrator Agent
			// ========================================
			// ORCHESTRATOR features:
			// - Classify user role & request type
			// - Read business context via RAG (limit=8, threshold=0.85)
			// - Decide readiness for SQL
			// - Derive intent hints: ENTITY/FILTERS/MODE
			// Load summary from DB for context
			const dbSession = await this.chatSessionService.getSession(session.sessionId);
			const sessionSummary = dbSession?.summary || null;
			if (sessionSummary) {
				this.logDebug(
					'CONTEXT',
					`Loaded session summary (${sessionSummary.length} chars) for context`,
				);
			}
			const orchestratorStartTime = Date.now();
			this.logInfo(
				'ORCHESTRATOR',
				'START | classify role & type | read business RAG | derive intents',
			);
			const orchestratorResponse = await this.orchestratorAgent.process(
				query,
				session,
				this.AI_CONFIG,
				sessionSummary, // Pass summary for context
			);
			const orchestratorDuration = Date.now() - orchestratorStartTime;
			this.logInfo(
				'ORCHESTRATOR',
				`END | readyForSql=${orchestratorResponse.readyForSql} | requestType=${orchestratorResponse.requestType} | userRole=${orchestratorResponse.userRole}` +
					`${orchestratorResponse.tablesHint ? ` | tablesHint=${orchestratorResponse.tablesHint}` : ''}` +
					`${orchestratorResponse.relationshipsHint ? ` | relationshipsHint=${orchestratorResponse.relationshipsHint}` : ''}` +
					`${orchestratorResponse.intentModeHint ? ` | modeHint=${orchestratorResponse.intentModeHint}` : ''}` +
					`${orchestratorResponse.entityHint ? ` | entityHint=${orchestratorResponse.entityHint}` : ''}` +
					` | took=${orchestratorDuration}ms`,
			);
			appendStep('ORCHESTRATOR DONE', {
				readyForSql: orchestratorResponse.readyForSql,
				requestType: orchestratorResponse.requestType,
				tablesHint: orchestratorResponse.tablesHint || 'none',
				filtersHint: orchestratorResponse.filtersHint || 'none',
				entityHint: orchestratorResponse.entityHint || 'none',
				intentAction: orchestratorResponse.intentAction || 'none',
				durationMs: orchestratorDuration,
			});

			// Update processing log với orchestrator data
			processingLogData.orchestratorData = {
				requestType: orchestratorResponse.requestType,
				userRole: orchestratorResponse.userRole,
				readyForSql: orchestratorResponse.readyForSql,
				entityHint: orchestratorResponse.entityHint,
				filtersHint: orchestratorResponse.filtersHint,
				tablesHint: orchestratorResponse.tablesHint,
				relationshipsHint: orchestratorResponse.relationshipsHint,
				intentModeHint: orchestratorResponse.intentModeHint,
				intentAction: orchestratorResponse.intentAction,
				missingParams: orchestratorResponse.missingParams,
				tokenUsage: orchestratorResponse.tokenUsage,
				duration: orchestratorDuration,
			};
			// Capture RAG context
			if (orchestratorResponse.businessContext) {
				const businessCtx = orchestratorResponse.businessContext;
				if (typeof businessCtx === 'object' && businessCtx !== null) {
					processingLogData.ragContext = {
						businessContext: businessCtx,
						schemaChunks: (businessCtx as any).schemaBlock ? 1 : 0,
						businessChunks: (businessCtx as any).businessBlock ? 1 : 0,
						qaChunks: (businessCtx as any).qaBlock ? 1 : 0,
					};
				} else {
					processingLogData.ragContext = {
						businessContext: businessCtx,
						schemaChunks: 0,
						businessChunks: 0,
						qaChunks: 0,
					};
				}
			}

			// SKIP LOGIC: Nếu không phải QUERY, return ngay (CLARIFICATION, GENERAL_CHAT, GREETING)
			if (orchestratorResponse.requestType !== RequestType.QUERY) {
				this.logInfo(
					'ORCHESTRATOR',
					`Skipping SQL flow | requestType=${orchestratorResponse.requestType}`,
				);
				appendStep('FLOW EXIT (NON-QUERY)', { requestType: orchestratorResponse.requestType });
				if (orchestratorResponse.requestType === RequestType.CLARIFICATION) {
					const cleanedMessage = this.cleanMessage(orchestratorResponse.message);
					const messageText: string = cleanedMessage.trim().endsWith('?')
						? cleanedMessage
						: `Minh can them thong tin de tra loi chinh xac: ${cleanedMessage}`;
					await this.addMessageToSession(session, 'assistant', messageText, {
						kind: 'CONTROL',
						payload: { mode: 'CLARIFY', questions: [] },
					});
					const response: ChatResponse = {
						kind: 'CONTROL',
						sessionId: session.sessionId,
						timestamp: new Date().toISOString(),
						message: messageText,
						payload: { mode: 'CLARIFY', questions: [] },
					};

					// Save single log entry
					processingLogData.response = messageText;
					processingLogData.status = 'completed';
					processingLogData.tokenUsage = orchestratorResponse.tokenUsage;
					processingLogData.totalDuration = Date.now() - pipelineStartAt;
					appendStep('SUMMARY', {
						totalDurationMs: processingLogData.totalDuration,
						totalTokens: processingLogData.tokenUsage?.totalTokens || 0,
					});
					processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
					await this.saveProcessingLogSafely(query, processingLogData);

					this.logPipelineEnd(
						session.sessionId,
						response.kind,
						pipelineStartAt,
						orchestratorResponse.tokenUsage,
					);
					return response;
				} else {
					// General chat or greeting
					const cleanedMessage = this.cleanMessage(orchestratorResponse.message);
					await this.addMessageToSession(session, 'assistant', cleanedMessage, {
						kind: 'CONTENT',
						payload: { mode: 'CONTENT' },
					});
					const response: ChatResponse = {
						kind: 'CONTENT',
						sessionId: session.sessionId,
						timestamp: new Date().toISOString(),
						message: cleanedMessage,
						payload: { mode: 'CONTENT' },
					};

					// Save single log entry
					processingLogData.response = cleanedMessage;
					processingLogData.status = 'completed';
					processingLogData.tokenUsage = orchestratorResponse.tokenUsage;
					processingLogData.totalDuration = Date.now() - pipelineStartAt;
					appendStep('SUMMARY', {
						totalDurationMs: processingLogData.totalDuration,
						totalTokens: processingLogData.tokenUsage?.totalTokens || 0,
					});
					processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
					await this.saveProcessingLogSafely(query, processingLogData);

					this.logPipelineEnd(
						session.sessionId,
						response.kind,
						pipelineStartAt,
						orchestratorResponse.tokenUsage,
					);
					return response;
				}
			}

			// MVP: Handle clarification when missingParams are present (chỉ khi requestType === QUERY)
			if (orchestratorResponse.missingParams && orchestratorResponse.missingParams.length > 0) {
				// Return clarification response with missingParams
				const clarificationMessage = this.formatClarificationMessage(
					orchestratorResponse.message,
					orchestratorResponse.missingParams,
				);
				await this.addMessageToSession(session, 'assistant', clarificationMessage, {
					kind: 'CONTROL',
					payload: {
						mode: 'CLARIFY',
						questions: orchestratorResponse.missingParams.map(
							(p) => `${p.reason}${p.examples ? ` (ví dụ: ${p.examples.join(', ')})` : ''}`,
						),
					},
				});
				const response: ChatResponse = {
					kind: 'CONTROL',
					sessionId: session.sessionId,
					timestamp: new Date().toISOString(),
					message: clarificationMessage,
					payload: {
						mode: 'CLARIFY',
						questions: orchestratorResponse.missingParams.map(
							(p) => `${p.reason}${p.examples ? ` (ví dụ: ${p.examples.join(', ')})` : ''}`,
						),
					},
				};

				// Save single log entry
				processingLogData.response = clarificationMessage;
				processingLogData.status = 'completed';
				processingLogData.tokenUsage = orchestratorResponse.tokenUsage;
				processingLogData.totalDuration = Date.now() - pipelineStartAt;
				appendStep('SUMMARY', {
					totalDurationMs: processingLogData.totalDuration,
					totalTokens: processingLogData.tokenUsage?.totalTokens || 0,
				});
				processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
				await this.saveProcessingLogSafely(query, processingLogData);

				this.logPipelineEnd(
					session.sessionId,
					response.kind,
					pipelineStartAt,
					orchestratorResponse.tokenUsage,
				);
				return response;
			}

			// Từ đây trở đi, chỉ xử lý khi requestType === QUERY và không có missingParams
			// Xác định mode response dựa trên ý định người dùng (LIST/TABLE/CHART/INSIGHT)
			// Ưu tiên MODE_HINT từ Orchestrator (có thể là INSIGHT nếu có currentPageContext)
			const desiredMode: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT' =
				orchestratorResponse.intentModeHint === 'INSIGHT'
					? 'INSIGHT'
					: (orchestratorResponse.intentModeHint ?? 'TABLE');
			// Initialize canonical question variables (used for modification queries and saving to pending knowledge)
			let canonicalQuestion: string = query; // Default to original query
			let previousSql: string | null = null;
			let previousCanonicalQuestion: string | null = null;

			// Log hints từ agent (không lưu vào DB, chỉ để debug)
			if (orchestratorResponse.entityHint) {
				this.logDebug('ORCHESTRATOR', `ENTITY hint: ${orchestratorResponse.entityHint}`);
			}
			if (orchestratorResponse.filtersHint) {
				this.logDebug(
					'ORCHESTRATOR',
					`FILTERS hint: ${orchestratorResponse.filtersHint.substring(0, 50)}`,
				);
			}
			if (orchestratorResponse.tablesHint) {
				this.logDebug(
					'ORCHESTRATOR',
					`TABLES hint: ${orchestratorResponse.tablesHint} (will enhance RAG query)`,
				);
			}
			if (orchestratorResponse.relationshipsHint) {
				this.logDebug(
					'ORCHESTRATOR',
					`RELATIONSHIPS hint: ${orchestratorResponse.relationshipsHint}`,
				);
			}
			if (desiredMode === 'INSIGHT') {
				this.logDebug('ORCHESTRATOR', 'MODE hint: INSIGHT');
			} else if (desiredMode === 'CHART') {
				this.logDebug('ORCHESTRATOR', 'MODE hint: CHART');
			} else if (desiredMode === 'LIST') {
				this.logDebug('ORCHESTRATOR', 'MODE hint: LIST');
			} else {
				this.logDebug('ORCHESTRATOR', 'MODE hint: TABLE');
			}
			if (orchestratorResponse.intentAction) {
				this.logDebug('ORCHESTRATOR', `INTENT_ACTION hint: ${orchestratorResponse.intentAction}`);
			}

			// Kiểm tra: Agent 1 đã xác định đủ thông tin để tạo SQL chưa?
			if (orchestratorResponse.readyForSql) {
				// ========================================
				// BƯỚC 2.5: Question Expansion (dùng LLM để tự detect và expand)
				// ========================================
				// Luôn thử expand nếu có previous SQL - LLM sẽ tự quyết định có cần expand không
				previousSql = await this.extractLastSqlFromSession(session.sessionId);
				previousCanonicalQuestion = await this.extractLastCanonicalQuestionFromSession(
					session.sessionId,
				);
				if (previousSql) {
					this.logInfo(
						'QUESTION_EXPANSION',
						`Attempting to expand question with LLM | originalQuery="${query}" | hasPreviousSql=true | previousCanonicalQuestion="${previousCanonicalQuestion || 'none'}"`,
					);
					try {
						canonicalQuestion = await this.questionExpansionAgent.expandQuestion(
							query,
							previousSql,
							previousCanonicalQuestion || undefined,
						);
						// LLM sẽ tự quyết định: nếu query đã đầy đủ thì trả về như cũ, nếu là modification thì expand
						if (canonicalQuestion !== query) {
							this.logInfo(
								'QUESTION_EXPANSION',
								`✅ LLM expanded question | originalQuery="${query}" | canonicalQuestion="${canonicalQuestion}"`,
							);
						} else {
							this.logInfo(
								'QUESTION_EXPANSION',
								`✅ LLM determined query is already complete, no expansion needed | originalQuery="${query}" | canonicalQuestion="${canonicalQuestion}" (same as original)`,
							);
						}
						appendStep('QUESTION EXPANSION', {
							originalQuestion: query,
							canonicalQuestion,
							previousSqlLength: previousSql.length,
							previousCanonicalQuestion: previousCanonicalQuestion || 'none',
						});
					} catch (error) {
						this.logWarn(
							'QUESTION_EXPANSION',
							`Failed to expand question, using original: ${(error as Error).message}`,
							error,
						);
						// Fallback: use original query
						canonicalQuestion = query;
					}
				}
				// ========================================
				// BƯỚC 3: Agent 2 - SQL Generation Agent
				// ========================================
				// SQL_AGENT features:
				// - Canonical reuse decision (hard=0.92, soft=0.8)
				// - Retrieve schema context via RAG (limit=8, threshold=0.85)
				// - Generate SQL (use business + intent hints)
				// - Execute read-only & serialize results
				const sqlStartTime = Date.now();
				this.logInfo(
					'SQL_AGENT',
					`START | canonical decision | schema RAG | generate SQL | execute | originalQuery="${query}" | canonicalQuestion="${canonicalQuestion}"${canonicalQuestion !== query ? ' (EXPANDED)' : ' (SAME AS ORIGINAL)'}`,
				);
				let sqlResult: SqlGenerationResult;
				let sqlError: Error | null = null;
				try {
					// Use canonical question for SQL generation (not original short query)
					// Pass previous SQL and canonical question to SQL Agent for modification queries
					sqlResult = await this.sqlGenerationAgent.process(
						canonicalQuestion, // Use expanded canonical question instead of original
						session,
						this.prisma,
						this.AI_CONFIG,
						orchestratorResponse.businessContext,
						previousSql || undefined, // Pass previous SQL if available (for modification queries)
						previousCanonicalQuestion || undefined, // Pass previous canonical question if available
						sessionSummary, // Pass session summary for long-term context
					);
				} catch (error) {
					// SQL generation failed completely - log đầy đủ error
					sqlError = error instanceof Error ? error : new Error(String(error));
					this.logError('SQL_AGENT', `SQL generation failed: ${sqlError.message}`, error);
					appendStep('SQL AGENT FAILED', {
						error: sqlError.message,
						stack: sqlError.stack,
						attempts: 'unknown',
					});
					// Create a failed sqlResult for logging purposes
					sqlResult = {
						sql: '',
						results: [],
						count: 0,
						attempts: 0,
						userId: session.userId,
						userRole: orchestratorResponse.userRole,
						tokenUsage: undefined,
						debug: {
							attempts: [
								{
									attempt: 0,
									error: sqlError.message,
									durationMs: Date.now() - sqlStartTime,
								},
							],
						},
					};
					// Log failed attempt
					processingLogData.sqlGenerationAttempts!.push({
						attempt: 0,
						error: sqlError.message,
						duration: Date.now() - sqlStartTime,
						sql: null,
						count: 0,
						results: [],
					});
				}
				const sqlDuration = Date.now() - sqlStartTime;
				const sqlPreview = sqlResult.sql ? sqlResult.sql.substring(0, 50) : 'NO_SQL';
				this.logInfo(
					'SQL_AGENT',
					`END | sqlPreview=${sqlPreview}... | results=${sqlResult.count} | took=${sqlDuration}ms${sqlError ? ` | ERROR: ${sqlError.message}` : ''}`,
				);
				const canonicalData = sqlResult.debug?.canonicalDecision as any;
				const sqlStepDetail = [
					'**INPUTS**',
					`- tables_hint: ${processingLogData.orchestratorData?.tablesHint || 'none'}`,
					`- filters_hint: ${processingLogData.orchestratorData?.filtersHint || 'none'}`,
					`- canonical_mode: ${canonicalData?.mode || 'none'}`,
					`- canonical_score: ${canonicalData?.score ?? 'none'}`,
					`- canonical_question: ${canonicalData?.question || 'none'}`,
					canonicalData?.sql
						? `- canonical_sql:\n\`\`\`sql\n${canonicalData.sql}\n\`\`\``
						: '- canonical_sql: none',
					'',
					'**OUTPUTS**',
					`- results: ${sqlResult.count}`,
					`- attempts: ${sqlResult.attempts || 1}`,
					`- took_ms: ${sqlDuration}`,
					sqlResult.sql ? `- final_sql:\n\`\`\`sql\n${sqlResult.sql}\n\`\`\`` : '- final_sql: none',
					`- attempt_errors: ${
						(sqlResult.debug?.attempts || [])
							.filter((a: any) => a.error)
							.map((a: any) => `try${a.attempt}:${a.error}`)
							.join(', ') || 'none'
					}`,
					'',
					'**RAG CONTEXT**',
					`- rag_tables: ${(extractTableNames(sqlResult.debug?.ragContext || '') || []).join(', ') || 'none'}`,
					`- rag_schema_chunks: ${(sqlResult.debug as any)?.schemaChunkCount ?? 'unknown'}`,
					`- rag_qa_chunks: ${(sqlResult.debug as any)?.qaChunkCount ?? 0}`,
					`- rag_qa_sql_chunks: ${(sqlResult.debug as any)?.qaChunkSqlCount ?? 0}`,
				].join('\n');

				appendStep('SQL AGENT DONE', sqlStepDetail);

				// Append SQL generation attempt vào processing log (đầy đủ theo log)
				// Giới hạn kết quả SQL để tránh quá lớn (chỉ lưu tối đa 20 rows đầu tiên)
				// Đảm bảo serialize lại để loại bỏ Decimal objects còn sót lại
				const MAX_RESULTS_ROWS = 20;
				const limitedResults = Array.isArray(sqlResult.results)
					? sqlResult.results.slice(0, MAX_RESULTS_ROWS)
					: sqlResult.results;
				// Serialize lại một lần nữa để đảm bảo không còn Decimal objects (defensive)
				// Vì có thể có Decimal objects còn sót lại sau serializeBigInt ban đầu
				const fullySerializedResults = serializeBigInt(limitedResults);
				if (sqlResult.debug?.attempts?.length) {
					// Cập nhật attempts với results từ attempt cuối cùng (thành công)
					const attemptsWithResults = sqlResult.debug.attempts.map((attempt: any, idx: number) => {
						// Chỉ thêm results vào attempt cuối cùng (thành công)
						if (idx === sqlResult.debug.attempts.length - 1 && sqlResult.sql) {
							return {
								...attempt,
								results: fullySerializedResults,
								count: sqlResult.count,
							};
						}
						return attempt;
					});
					processingLogData.sqlGenerationAttempts = attemptsWithResults;
				} else {
					processingLogData.sqlGenerationAttempts!.push({
						sql: sqlResult.sql,
						count: sqlResult.count,
						results: fullySerializedResults,
						tokenUsage: sqlResult.tokenUsage,
						error: (sqlResult as any).error,
						duration: sqlDuration,
					});
				}
				processingLogData.ragContext = {
					...(processingLogData.ragContext || {}),
					schemaContext: sqlResult.debug?.ragContext,
					schemaContextLength: sqlResult.debug?.ragContext?.length || 0,
					canonicalDecision: sqlResult.debug?.canonicalDecision,
					tablesHint: sqlResult.debug?.tablesHint ?? processingLogData.orchestratorData?.tablesHint,
					relationshipsHint:
						sqlResult.debug?.relationshipsHint ??
						processingLogData.orchestratorData?.relationshipsHint,
					filtersHint:
						sqlResult.debug?.filtersHint ?? processingLogData.orchestratorData?.filtersHint,
					intentAction: sqlResult.debug?.intentAction,
					recentMessages: sqlResult.debug?.recentMessages,
				};

				// Full SQL banner for debugging (only if SQL exists)
				if (sqlResult.sql) {
					try {
						const top = '-------------------- GENERATED SQL (BEGIN) --------------------';
						const bottom = '--------------------- GENERATED SQL (END) ---------------------';
						this.logger.log(this.formatStep('SQL_AGENT', top));
						this.logger.log(this.formatStep('SQL_AGENT', sqlResult.sql));
						this.logger.log(this.formatStep('SQL_AGENT', bottom));
					} catch (e) {
						this.logWarn('SQL_AGENT', 'Failed to log full generated SQL', e);
					}
				} else {
					this.logWarn(
						'SQL_AGENT',
						`No SQL generated - SQL generation failed${sqlError ? `: ${sqlError.message}` : ''}`,
					);
				}

				// Nếu SQL generation failed hoàn toàn, skip các bước tiếp theo và return error response
				if (sqlError || !sqlResult.sql) {
					const errorMessage = sqlError
						? `Xin lỗi, không thể tạo SQL query: ${sqlError.message}`
						: 'Xin lỗi, không thể tạo SQL query. Vui lòng thử lại với câu hỏi khác.';
					await this.addMessageToSession(session, 'assistant', errorMessage, {
						kind: 'CONTROL',
						payload: { mode: 'ERROR', details: sqlError?.message || 'SQL generation failed' },
					});
					const errorResponse: ChatResponse = {
						kind: 'CONTROL',
						sessionId: session.sessionId,
						timestamp: new Date().toISOString(),
						message: errorMessage,
						payload: { mode: 'ERROR', details: sqlError?.message || 'SQL generation failed' },
					};

					// Save processing log với error
					processingLogData.response = errorMessage;
					processingLogData.status = 'failed';
					processingLogData.error = sqlError?.message || 'SQL generation failed';
					processingLogData.tokenUsage = orchestratorResponse.tokenUsage;
					processingLogData.totalDuration = Date.now() - pipelineStartAt;
					appendStep('SUMMARY', {
						totalDurationMs: processingLogData.totalDuration,
						totalTokens: orchestratorResponse.tokenUsage?.totalTokens || 0,
					});
					processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
					await this.saveProcessingLogSafely(query, processingLogData);

					this.logPipelineEnd(session.sessionId, errorResponse.kind, pipelineStartAt);
					return errorResponse;
				}

				// ========================================
				// BƯỚC 4 & 5: Response Generator & Result Validator (PARALLEL)
				// ========================================
				// PARALLEL features:
				// - RESPONSE_GENERATOR: build final natural response with structured payloads
				// - VALIDATOR: evaluate result validity & severity
				this.logInfo('PARALLEL', 'START | response-generator + validator');
				const parallelStartTime = Date.now();
				const [responseText, validation] = await Promise.all([
					// Agent 3: Response Generator - Tạo câu trả lời thân thiện với structured data
					this.responseGenerator.generateFinalResponse(
						orchestratorResponse.message,
						sqlResult,
						session,
						this.AI_CONFIG,
						desiredMode,
						sessionSummary, // Pass session summary for long-term context
						query, // Pass original query to detect chart type
					),
					// Agent 4: Result Validator - Đánh giá tính hợp lệ của kết quả
					// Pass cả originalQuery và canonicalQuestion để validator hiểu context
					this.resultValidatorAgent.validateResult(
						query, // Original query (short, context-dependent)
						canonicalQuestion, // Canonical question (expanded, used for SQL generation)
						sqlResult.sql,
						sqlResult.results,
						orchestratorResponse.requestType,
						this.AI_CONFIG,
					),
				]);
				const parallelDuration = Date.now() - parallelStartTime;
				this.logInfo(
					'PARALLEL',
					`END | completed in ${parallelDuration}ms | validator.isValid=${validation.isValid} | severity=${validation.severity || 'N/A'}`,
				);
				this.logDebug(
					'VALIDATOR',
					`[STEP] Validator → isValid=${validation.isValid}, severity=${validation.severity || 'N/A'}, reason=${validation.reason || 'OK'}`,
				);

				// Parse responseText để tách message và structured data
				const parsedResponse = parseResponseText(responseText);

				appendStep('VALIDATOR + RESPONSE GEN', {
					validatorValid: validation.isValid,
					severity: validation.severity || 'N/A',
					reason: validation.reason || 'OK',
					responsePreview: parsedResponse.message.substring(0, 180),
				});

				// Update processing log với validator và response generator data
				processingLogData.validatorData = {
					isValid: validation.isValid,
					reason: validation.reason,
					severity: validation.severity,
					violations: validation.violations,
					evaluation: validation.evaluation, // Đánh giá chi tiết từ validator
					tokenUsage: validation.tokenUsage,
					duration: parallelDuration, // Parallel duration cho cả validator và response generator
				};
				processingLogData.responseGeneratorData = {
					tokenUsage: parsedResponse.meta?.tokenUsage,
					duration: parallelDuration, // Shared duration với validator
				};

				// Enrich TABLE rows with clickable path using entity-route map
				try {
					if (
						parsedResponse?.table &&
						Array.isArray(parsedResponse.table.rows) &&
						Array.isArray(parsedResponse.table.columns)
					) {
						const entity = orchestratorResponse.entityHint;
						if (entity) {
							const hasPathColumn = parsedResponse.table.columns.some(
								(c: { key: string }) => c.key === 'path',
							);
							if (!hasPathColumn) {
								parsedResponse.table.columns.push({ key: 'path', label: 'path', type: 'string' });
							}
							parsedResponse.table.rows = parsedResponse.table.rows.map(
								(row: Record<string, unknown>) => {
									const id = String(row.id || '');
									if (id) {
										const path = buildEntityPath(entity as any, id);
										return path ? { ...row, path } : row;
									}
									return row;
								},
							);
						}
					}
				} catch (error) {
					this.logError('ERROR', 'Error building entity path', error);
				}

				// Build data payload từ parsed structured data
				const dataPayload: DataPayload | undefined = this.buildDataPayloadFromParsed(
					parsedResponse,
					desiredMode,
					query, // Pass query to auto-convert TABLE to CHART if needed
				);

				// Lưu câu trả lời vào session (kèm envelope structured)
				// Include SQL query và canonical question trong metadata
				await this.addMessageToSession(
					session,
					'assistant',
					parsedResponse.message,
					{
						kind: 'DATA',
						payload: dataPayload,
					},
					true, // triggerJobs
					sqlResult.sql, // SQL query
					canonicalQuestion, // Canonical question (expanded if modification query)
				);

				// Tích lũy token usage từ tất cả các agent
				const totalTokenUsage = {
					promptTokens:
						(orchestratorResponse.tokenUsage?.promptTokens || 0) +
						(sqlResult.tokenUsage?.promptTokens || 0) +
						(validation.tokenUsage?.promptTokens || 0) +
						(parsedResponse.meta?.tokenUsage?.promptTokens || 0),
					completionTokens:
						(orchestratorResponse.tokenUsage?.completionTokens || 0) +
						(sqlResult.tokenUsage?.completionTokens || 0) +
						(validation.tokenUsage?.completionTokens || 0) +
						(parsedResponse.meta?.tokenUsage?.completionTokens || 0),
					totalTokens:
						(orchestratorResponse.tokenUsage?.totalTokens || 0) +
						(sqlResult.tokenUsage?.totalTokens || 0) +
						(validation.tokenUsage?.totalTokens || 0) +
						(parsedResponse.meta?.tokenUsage?.totalTokens || 0),
				};

				// Trả về response với payload structured cho UI
				const response: ChatResponse = {
					kind: 'DATA',
					sessionId: session.sessionId,
					timestamp: new Date().toISOString(),
					message: parsedResponse.message,
					payload: dataPayload,
				};

				// Persist Q&A - ƯU TIÊN LƯU: Chỉ skip nếu có ERROR severity rõ ràng
				// isValid=true hoặc WARN severity → lưu vào pending để admin review
				// CHỈ LƯU CÁC CÂU TRẢ LỜI ĐÚNG/CHẤT LƯỢNG:
				// - isValid=true (SQL đúng và kết quả hợp lý)
				// - severity !== 'ERROR' (không có lỗi nghiêm trọng)
				// - Có SQL và có kết quả (không lưu khi SQL fail hoặc không có kết quả)
				const shouldPersist =
					validation.isValid &&
					validation.severity !== 'ERROR' &&
					sqlResult.sql &&
					sqlResult.count >= 0; // Có thể là 0 (không có dữ liệu) nhưng vẫn hợp lệ
				if (shouldPersist) {
					try {
						this.logInfo(
							'PERSIST',
							`Đang lưu Q&A vào pending knowledge | originalQuery="${query}" | canonicalQuestion="${canonicalQuestion}"${canonicalQuestion !== query ? ' (EXPANDED)' : ' (SAME AS ORIGINAL)'} | isValid=${validation.isValid} | severity=${validation.severity || 'none'} | count=${sqlResult.count} | evaluation=${validation.evaluation ? 'yes' : 'no'}`,
						);
						const pendingResult = await this.pendingKnowledgeService.savePendingKnowledge({
							question: query, // Original question (để lưu vào validatorData)
							canonicalQuestion: canonicalQuestion, // Luôn pass canonical question (sẽ được dùng làm question chính)
							sql: sqlResult.sql,
							previousSql: previousSql || undefined, // Previous SQL if modification query
							previousCanonicalQuestion: previousCanonicalQuestion || undefined, // Previous canonical question if modification query
							response: responseText, // Lưu raw response từ response-generator (có đầy đủ structured data và metadata)
							evaluation: validation.evaluation,
							validatorData: validation,
							sessionId: session.sessionId,
							userId: session.userId,
							processingLogId: undefined, // Will be set after log is saved
						});
						this.logDebug(
							'PERSIST',
							`Đã lưu Q&A vào pending knowledge | id=${pendingResult.id} | status=${pendingResult.status}`,
						);
						appendStep('PERSIST PENDING KNOWLEDGE', {
							status: 'saved_to_pending',
							pendingId: pendingResult.id,
							count: sqlResult.count,
							severity: validation.severity || 'OK',
							hasEvaluation: !!validation.evaluation,
						});
					} catch (persistErr) {
						this.logWarn('PERSIST', 'Không thể lưu Q&A vào pending knowledge', persistErr);
						appendStep('PERSIST PENDING KNOWLEDGE FAILED', String(persistErr));
					}
				} else {
					// Skip khi có lỗi hoặc không hợp lệ
					const skipReason = !validation.isValid
						? `isValid=false`
						: validation.severity === 'ERROR'
							? `severity=ERROR`
							: !sqlResult.sql
								? `no SQL`
								: `unknown reason`;
					this.logWarn(
						'VALIDATOR',
						`Kết quả không đủ chất lượng, không lưu vào pending knowledge (${skipReason}): ${validation.reason || 'Unknown error'}`,
					);
					appendStep('PERSIST SKIPPED', skipReason);
				}

				// Save processing log SAU KHI tất cả các bước đã hoàn thành (bao gồm PERSIST)
				// Đảm bảo stepsLog có đầy đủ thông tin từ tất cả các bước
				processingLogData.response = parsedResponse.message;
				processingLogData.status = 'completed';
				processingLogData.tokenUsage = totalTokenUsage;
				processingLogData.totalDuration = Date.now() - pipelineStartAt;
				appendStep('SUMMARY', {
					totalDurationMs: processingLogData.totalDuration,
					totalTokens: totalTokenUsage.totalTokens || 0,
				});
				processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
				await this.saveProcessingLogSafely(query, processingLogData, canonicalQuestion);

				this.logPipelineEnd(session.sessionId, response.kind, pipelineStartAt, totalTokenUsage);
				return response;
			} else {
				// Edge case: requestType === QUERY nhưng readyForSql = false
				// (Không nên xảy ra thường xuyên, nhưng để an toàn)
				this.logWarn(
					'ORCHESTRATOR',
					`Edge case: QUERY but readyForSql=false | requestType=${orchestratorResponse.requestType}`,
				);
				appendStep('FLOW EXIT (READY=FALSE)', { requestType: orchestratorResponse.requestType });
				const cleanedMessage = this.cleanMessage(orchestratorResponse.message);
				await this.addMessageToSession(session, 'assistant', cleanedMessage, {
					kind: 'CONTENT',
					payload: { mode: 'CONTENT' },
				});
				const response: ChatResponse = {
					kind: 'CONTENT',
					sessionId: session.sessionId,
					timestamp: new Date().toISOString(),
					message: cleanedMessage,
					payload: { mode: 'CONTENT' },
				};

				// Save single log entry for edge case
				processingLogData.response = cleanedMessage;
				processingLogData.status = 'partial';
				processingLogData.error = 'QUERY but readyForSql=false';
				processingLogData.tokenUsage = orchestratorResponse.tokenUsage;
				processingLogData.totalDuration = Date.now() - pipelineStartAt;
				appendStep('SUMMARY', {
					totalDurationMs: processingLogData.totalDuration,
					totalTokens: processingLogData.tokenUsage?.totalTokens || 0,
				});
				processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
				await this.saveProcessingLogSafely(query, processingLogData);

				this.logPipelineEnd(
					session.sessionId,
					response.kind,
					pipelineStartAt,
					orchestratorResponse.tokenUsage,
				);
				return response;
			}
		} catch (error) {
			// ========================================
			// Xử lý lỗi
			// ========================================
			// Ghi log chi tiết để debug
			this.logError('ERROR', `Lỗi xử lý chat (session ${session.sessionId})`, error);
			appendStep('PIPELINE ERROR', error instanceof Error ? error.message : String(error));

			// Tạo message lỗi thân thiện cho người dùng
			const errorMessage = generateErrorResponse((error as Error).message);
			const messageText: string = `Xin lỗi, đã xảy ra lỗi: ${errorMessage}`;
			await this.addMessageToSession(session, 'assistant', messageText, {
				kind: 'CONTROL',
				payload: { mode: 'ERROR', details: (error as Error).message },
			});
			const response: ChatResponse = {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message: messageText,
				payload: { mode: 'ERROR', details: (error as Error).message },
			};

			// Save single log entry for error case
			processingLogData.response = messageText;
			processingLogData.status = 'failed';
			processingLogData.error = (error as Error).message || 'Unknown error';
			processingLogData.totalDuration = Date.now() - pipelineStartAt;
			appendStep('SUMMARY', {
				totalDurationMs: processingLogData.totalDuration,
				totalTokens: processingLogData.tokenUsage?.totalTokens || 0,
			});
			processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
			await this.saveProcessingLogSafely(query, processingLogData);

			this.logPipelineEnd(session.sessionId, response.kind, pipelineStartAt);
			return response;
		}
	}

	// Continue with the rest of chatWithAI logic here (from line ~1028 onwards)
	// This is the main processing pipeline that was previously in chatWithAI
	// Now extracted to processChatQueryWithSession so it can be reused

	/**
	 * Format clarification message with missingParams (MVP)
	 * @param baseMessage - Base message from orchestrator
	 * @param missingParams - Missing parameters
	 * @returns Formatted clarification message
	 */
	private formatClarificationMessage(
		baseMessage: string,
		missingParams: Array<{ name: string; reason: string; examples?: string[] }>,
	): string {
		if (!missingParams || missingParams.length === 0) {
			return this.cleanMessage(baseMessage);
		}
		// Clean base message first to remove any internal annotations
		const cleanedMessage = this.cleanMessage(baseMessage);
		const paramsList = missingParams.map((param) => {
			const examplesText =
				param.examples && param.examples.length > 0 ? ` (ví dụ: ${param.examples.join(', ')})` : '';
			return `• ${param.reason}${examplesText}`;
		});
		const paramsSection = paramsList.join('\n');
		return `${cleanedMessage}\n\n**Thông tin cần bổ sung:**\n${paramsSection}`;
	}

	/**
	 * Clean message from internal annotations and dev metadata
	 * @param message - Raw message that may contain internal annotations
	 * @returns Cleaned message without internal annotations
	 */
	private cleanMessage(message: string): string {
		if (!message) {
			return message;
		}
		return message
			.replace(/\n*INTENT_ACTION:\s*\w+\s*/gi, '')
			.replace(/\n*POLARITY:\s*\w+\s*/gi, '')
			.replace(/\n*CANONICAL_REUSE_OK:\s*\w+.*/gi, '')
			.replace(/\n*REQUEST_TYPE:\s*\w+\s*/gi, '')
			.replace(/\n*MODE_HINT:\s*\w+\s*/gi, '')
			.replace(/\n*ENTITY_HINT:\s*\w+\s*/gi, '')
			.replace(/\n*FILTERS_HINT:\s*.+?$/gim, '')
			.replace(/\n*TABLES_HINT:\s*.+?$/gim, '')
			.replace(/\n*RELATIONSHIPS_HINT:\s*.+?$/gim, '')
			.replace(/\n*MISSING_PARAMS:\s*.+?$/gim, '')
			.replace(/\[(LANDLORD|TENANT|GUEST)\]\s*/g, '')
			.replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
			.trim();
	}

	/**
	 * Build data payload from parsed response (with LIST/TABLE/CHART)
	 * @param parsedResponse - Parsed response from parseResponseText
	 * @param desiredMode - Desired output mode
	 * @returns Data payload for UI
	 */
	private buildDataPayloadFromParsed(
		parsedResponse: { list: any[] | null; table: any | null; chart: any | null },
		desiredMode?: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT',
		query?: string,
	): DataPayload | undefined {
		// INSIGHT mode không có structured data - nhưng vẫn check nếu có data thì return
		// Ưu tiên LIST > CHART > TABLE
		if (parsedResponse.list !== null && parsedResponse.list.length > 0) {
			return {
				mode: 'LIST',
				list: {
					items: parsedResponse.list,
					total: parsedResponse.list.length,
				},
			};
		}

		if (parsedResponse.chart !== null) {
			return {
				mode: 'CHART',
				chart: parsedResponse.chart,
			};
		}

		if (parsedResponse.table !== null) {
			// Check if table has valid structure (columns and rows)
			if (
				parsedResponse.table.columns &&
				Array.isArray(parsedResponse.table.columns) &&
				parsedResponse.table.rows &&
				Array.isArray(parsedResponse.table.rows)
			) {
				// Auto-convert TABLE to CHART if user requested chart and data is suitable
				if (desiredMode === 'CHART' && parsedResponse.table.rows.length > 0) {
					try {
						const chartData = tryBuildChart(
							parsedResponse.table.rows as Array<Record<string, unknown>>,
							undefined,
							query,
						);
						if (chartData) {
							return {
								mode: 'CHART' as const,
								chart: {
									mimeType: 'image/png' as const,
									url: chartData.url,
									width: chartData.width,
									height: chartData.height,
									alt: 'Chart',
									...(chartData.type
										? {
												type: chartData.type as
													| 'pie'
													| 'bar'
													| 'line'
													| 'doughnut'
													| 'radar'
													| 'polarArea'
													| 'area'
													| 'horizontalBar',
											}
										: {}),
								},
							};
						}
					} catch (error) {
						this.logger.warn('Failed to auto-convert TABLE to CHART', error);
					}
				}
				return {
					mode: 'TABLE',
					table: parsedResponse.table,
				};
			}
		}

		// INSIGHT mode hoặc không có structured data
		return undefined;
	}

	// removed buildMarkdownForData in favor of ResponseGenerator prompt-based control

	private buildDataPayload(
		results: unknown,
		_query: string,
		desiredMode?: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT',
	): DataPayload | undefined {
		// INSIGHT mode không có structured data
		if (desiredMode === 'INSIGHT') {
			return undefined;
		}
		if (!Array.isArray(results) || results.length === 0 || typeof results[0] !== 'object') {
			return undefined;
		}
		const rows = results as ReadonlyArray<Record<string, unknown>>;
		// Prefer LIST (either intent or data shape)
		if (desiredMode === 'LIST' || isListLike(rows)) {
			const items = toListItems(rows);
			return {
				mode: 'LIST',
				list: {
					items: items.slice(0, 50),
					total: items.length,
				},
			};
		}
		// Then try CHART for aggregate/statistics-like data, only when intent matches
		const chartIntent = desiredMode === 'CHART';
		const chartData = chartIntent ? tryBuildChart(rows) : null;
		if (chartData) {
			return {
				mode: 'CHART',
				chart: {
					mimeType: 'image/png',
					url: chartData.url,
					width: chartData.width,
					height: chartData.height,
					alt: 'Chart (Top 10)',
				},
			};
		}
		const inferred: TableColumn[] = inferColumns(rows);
		const columns: TableColumn[] = selectImportantColumns(inferred, rows);
		const normalized = normalizeRows(rows, columns);
		return {
			mode: 'TABLE',
			table: {
				columns,
				rows: normalized.slice(0, 50),
				previewLimit: 50,
			},
		};
	}

	// removed toVietnameseLabel - LLM/front-end handles localization

	/**
	 * Get chat history for a session - For frontend to display conversation
	 * @param context - User context (userId, clientIp)
	 * @returns Chat messages compatible with AI SDK Conversation component
	 */
	async getChatHistory(context: { userId?: string; clientIp?: string } = {}): Promise<{
		sessionId: string;
		messages: Array<{
			id: string;
			role: 'user' | 'assistant';
			content: string;
			timestamp: string;
			kind?: 'CONTENT' | 'DATA' | 'CONTROL';
			payload?: any;
		}>;
	}> {
		const { userId, clientIp } = context;
		const session = await this.getOrCreateSession(userId, clientIp);

		return {
			sessionId: session.sessionId,
			messages: session.messages
				.filter((m) => m.role !== 'system') // Don't show system messages to user
				.map((message, index) => ({
					id: `${session.sessionId}_${index}`,
					role: message.role as 'user' | 'assistant',
					content: message.content,
					timestamp: message.timestamp.toISOString(),
					kind: message.kind as 'CONTENT' | 'DATA' | 'CONTROL' | undefined,
					payload: message.payload,
				})),
		};
	}

	/**
	 * Clear chat history for a session
	 * @param context - User context (userId, clientIp)
	 */
	async clearChatHistory(
		context: { userId?: string; clientIp?: string } = {},
	): Promise<{ success: boolean }> {
		const { userId, clientIp } = context;
		const session = await this.chatSessionService.getOrCreateSession(userId, clientIp);
		await this.chatSessionService.clearMessages(session.id);
		return { success: true };
	}

	/**
	 * Legacy method for backward compatibility with retry logic and security
	 * @param query - User query
	 * @param userId - Optional user ID for authorization
	 * @returns SQL execution result
	 */
	async generateAndExecuteSql(query: string, userId?: string) {
		return await this.sqlGenerationAgent.generateAndExecuteSql(
			query,
			userId,
			this.prisma,
			this.AI_CONFIG,
		);
	}

	/**
	 * Simple one-for-all method for model evaluation
	 * No session, no history, no agents - just direct SQL generation
	 * @param query - User query
	 * @param userId - Optional user ID for authorization
	 * @returns SQL execution result
	 */
	async simpleText2Sql(
		query: string,
		userId?: string,
	): Promise<{
		sql: string;
		results: unknown;
		count: number;
		success: boolean;
		error?: string;
	}> {
		try {
			// Get complete database schema
			const schema = getCompleteDatabaseSchema();
			// Build system prompt with schema
			const systemPrompt = buildOneForAllPrompt(schema);
			// Build user prompt
			const userPrompt = `Câu hỏi: "${query}"\n\nSQL:`;
			// Call LLM
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: `${systemPrompt}\n\n${userPrompt}`,
				temperature: this.AI_CONFIG.temperature,
				maxOutputTokens: this.AI_CONFIG.maxTokens,
			});
			// Parse SQL from response
			let sql = text.trim();
			sql = sql
				.replace(/```sql\n?/g, '')
				.replace(/```\n?/g, '')
				.trim();
			if (!sql.endsWith(';')) {
				sql += ';';
			}
			// Replace USER_ID placeholder with actual userId if provided
			if (userId) {
				// Validate userId is UUID format for security
				if (!this.isUuid(userId)) {
					throw new Error(`Invalid userId format: ${userId} (must be UUID)`);
				}
				// Replace 'USER_ID' (with quotes) - prompt instructs model to use this format
				sql = sql.replace(/'USER_ID'/g, `'${userId}'`);
				// Also replace USER_ID without quotes in WHERE clauses (fallback for edge cases)
				sql = sql.replace(/(WHERE\s+[^=]+\s*=\s*)USER_ID(\s|;|$)/gi, `$1'${userId}'$2`);
				this.logDebug('SIMPLE_TEXT2SQL', `Replaced USER_ID placeholder with userId: ${userId}`);
			} else {
				// If userId is not provided but SQL contains USER_ID placeholder, log warning
				if (sql.includes('USER_ID')) {
					this.logWarn(
						'SIMPLE_TEXT2SQL',
						'SQL contains USER_ID placeholder but userId is not provided - query may fail',
					);
				}
			}
			// Validate SQL safety
			const sqlLower = sql.toLowerCase().trim();
			if (!sqlLower.startsWith('select')) {
				throw new Error('Only SELECT queries are allowed for security reasons');
			}
			const isAggregate = isAggregateQuery(sql);
			const safetyCheck = validateSqlSafety(sql, isAggregate);
			if (!safetyCheck.isValid) {
				throw new Error(`SQL safety validation failed: ${safetyCheck.violations.join(', ')}`);
			}
			const finalSql = safetyCheck.enforcedSql || sql;
			// Log SQL before execution
			const sqlBannerTop = '==================== GENERATED SQL (BASELINE) ====================';
			const sqlBannerBottom = '========================================================';
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', sqlBannerTop));
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', `Query: "${query}"`));
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', `SQL: ${finalSql}`));
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', sqlBannerBottom));
			// Execute SQL
			const results = await this.prisma.$queryRawUnsafe(finalSql);
			const serializedResults = serializeBigInt(results);
			const count = Array.isArray(serializedResults) ? serializedResults.length : 1;
			// Log results
			const resultsBannerTop = '==================== SQL RESULTS (BASELINE) ====================';
			const resultsBannerBottom = '========================================================';
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', resultsBannerTop));
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', `Count: ${count}`));
			this.logger.log(
				this.formatStep(
					'SIMPLE_TEXT2SQL',
					`Results: ${JSON.stringify(serializedResults, null, 2).substring(0, 1000)}${JSON.stringify(serializedResults).length > 1000 ? '...' : ''}`,
				),
			);
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', resultsBannerBottom));
			const response = {
				sql: finalSql,
				results: serializedResults,
				count,
				success: true,
			};
			// Log final response
			const responseBannerTop = '==================== RESPONSE (BASELINE) ====================';
			const responseBannerBottom = '========================================================';
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', responseBannerTop));
			this.logger.log(
				this.formatStep(
					'SIMPLE_TEXT2SQL',
					`Response: ${JSON.stringify(response, null, 2).substring(0, 1000)}${JSON.stringify(response).length > 1000 ? '...' : ''}`,
				),
			);
			this.logger.log(this.formatStep('SIMPLE_TEXT2SQL', responseBannerBottom));
			return response;
		} catch (error) {
			this.logError(
				'SIMPLE_TEXT2SQL',
				`Failed to generate or execute SQL: ${(error as Error).message}`,
				error,
			);
			return {
				sql: '',
				results: [],
				count: 0,
				success: false,
				error: (error as Error).message,
			};
		}
	}

	// ========================================
	// CONVERSATION API METHODS (New variant)
	// ========================================
	// These methods work with explicit conversation IDs
	// Keep backward compatibility with old /ai/chat endpoints

	/**
	 * List all conversations for a user
	 * @param userId - User ID
	 * @param limit - Maximum number of conversations to return
	 * @returns List of conversations
	 */
	async listConversations(userId: string, limit: number = 50) {
		return await this.chatSessionService.getUserSessions(userId, limit);
	}

	/**
	 * Create a new conversation
	 * @param options - Conversation creation options
	 * @returns Created conversation
	 */
	async createConversation(options: {
		userId?: string;
		clientIp?: string;
		title?: string;
		initialMessage?: string;
	}) {
		const { userId, clientIp, title } = options;
		// Create NEW session (not reuse existing via getOrCreateSession)
		const session = await this.chatSessionService.createNewConversationSession(userId, clientIp);
		// Update title if provided
		if (title && title !== 'New Chat') {
			await this.chatSessionService.updateSessionTitle(session.id, title);
			// Reload to get updated title
			const updated = await this.chatSessionService.getSession(session.id);
			return updated || session;
		}
		return session;
	}

	/**
	 * Get conversation details with messages
	 * @param conversationId - Conversation/Session ID
	 * @returns Conversation with messages (consistent format)
	 */
	async getConversation(conversationId: string) {
		const dbSession = await this.chatSessionService.getSession(conversationId);
		if (!dbSession) {
			return null;
		}
		// Return session with messages loaded (consistent with getSession)
		return dbSession;
	}

	/**
	 * Send a message in a conversation
	 * This is the main chat method for conversations
	 * @param conversationId - Conversation/Session ID
	 * @param message - User message
	 * @param context - Additional context
	 * @returns AI response
	 */
	async chatInConversation(
		conversationId: string,
		message: string,
		context: { userId?: string; clientIp?: string; currentPage?: string } = {},
	): Promise<ChatResponse> {
		const { userId, clientIp, currentPage } = context;
		// Get session by ID (verify it exists and belongs to user if authenticated)
		const dbSession = await this.chatSessionService.getSession(conversationId);
		if (!dbSession) {
			throw new Error(`Conversation not found: ${conversationId}`);
		}
		// Verify ownership if user is authenticated
		if (userId && dbSession.userId !== userId) {
			throw new Error(`Conversation ${conversationId} does not belong to user ${userId}`);
		}
		// Không lưu system prompt vào DB, chỉ dùng trong memory cho processing
		// Convert to ChatSession format and use it directly
		// Convert to ChatSession format and use it directly
		// This ensures we use the correct conversationId session, not create a new one
		const session = this.convertDbSessionToChatSession(dbSession, clientIp);
		const pipelineStartAt = this.logPipelineStart(message, session.sessionId);
		// Use processChatQueryWithSession to process with explicit session (avoid getOrCreateSession)
		return await this.processChatQueryWithSession(
			message,
			session,
			{ userId, clientIp, currentPage },
			pipelineStartAt,
		);
	}

	/**
	 * Get messages from a conversation
	 * Transform DB format to format compatible with old chat API for Frontend reuse
	 * @param conversationId - Conversation/Session ID
	 * @param limit - Maximum number of messages to return
	 * @returns List of messages in format compatible with old chat API
	 */
	async getConversationMessages(conversationId: string, limit: number = 100) {
		const dbMessages = await this.chatSessionService.getRecentMessages(conversationId, limit);
		// Transform DB format to format compatible with old chat API
		// Old API format: { id, role, content, timestamp, kind?, payload? }
		// DB format: { id, sessionId, role, content, metadata: { kind?, payload?, sql?, canonicalQuestion? }, sequenceNumber, createdAt }
		return dbMessages
			.filter((m) => m.role !== 'system') // Filter out system messages
			.map((msg) => {
				const metadata = (msg.metadata as any) || {};
				// Build response matching old chat API format for backward compatibility
				// Old API has: id, role, content, timestamp, kind?, payload?
				const transformed: any = {
					id: msg.id,
					sessionId: msg.sessionId,
					role: msg.role,
					content: msg.content,
					timestamp: msg.createdAt, // Old API uses 'timestamp'
					// Top-level fields for backward compatibility (old chat API format)
					kind: metadata.kind, // Top-level kind for compatibility
					payload: metadata.payload, // Top-level payload for compatibility
					// Keep metadata for new features (sql, canonicalQuestion, etc.)
					metadata: {
						kind: metadata.kind,
						payload: metadata.payload,
						sql: metadata.sql,
						canonicalQuestion: metadata.canonicalQuestion,
						meta: metadata.meta,
					},
					// Additional fields for new API
					sequenceNumber: msg.sequenceNumber,
					createdAt: msg.createdAt,
				};
				// Remove undefined fields to keep response clean
				if (!transformed.kind) delete transformed.kind;
				if (!transformed.payload) delete transformed.payload;
				return transformed;
			})
			.reverse(); // Reverse to get chronological order (oldest first)
	}

	/**
	 * Update conversation title
	 * @param conversationId - Conversation/Session ID
	 * @param title - New title
	 */
	async updateConversationTitle(conversationId: string, title: string) {
		await this.chatSessionService.updateSessionTitle(conversationId, title);
	}

	/**
	 * Delete a conversation
	 * @param conversationId - Conversation/Session ID
	 */
	async deleteConversation(conversationId: string) {
		await this.chatSessionService.deleteSession(conversationId);
	}

	/**
	 * Clear messages from a conversation
	 * @param conversationId - Conversation/Session ID
	 */
	async clearConversationMessages(conversationId: string) {
		await this.chatSessionService.clearMessages(conversationId);
	}
}
