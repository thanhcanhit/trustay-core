import { google } from '@ai-sdk/google';
import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { BuildingsService } from '../api/buildings/buildings.service';
import { AddressService } from '../api/provinces/address/address.service';
import { RoomsService } from '../api/rooms/rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorAgent } from './agents/orchestrator-agent';
import { ResponseGenerator } from './agents/response-generator';
import { ResultValidatorAgent } from './agents/result-validator-agent';
import { SqlGenerationAgent } from './agents/sql-generation-agent';
import { KnowledgeService } from './knowledge/knowledge.service';
import { buildOneForAllPrompt } from './prompts/simple-system-one-for-all';
import { VIETNAMESE_LOCALE_SYSTEM_PROMPT } from './prompts/system.prompt';
import { AiProcessingLogService } from './services/ai-processing-log.service';
import { generateErrorResponse } from './services/error-handler.service';
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

	// Chat session management - similar to rooms.service.ts view cache pattern
	private chatSessions = new Map<string, ChatSession>();
	private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút
	private readonly MAX_MESSAGES_PER_SESSION = 10; // Giới hạn tin nhắn mỗi session
	private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 phút

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
		private readonly roomPublishingService: RoomPublishingService,
		private readonly buildingsService: BuildingsService,
		private readonly roomsService: RoomsService,
		private readonly addressService: AddressService,
		private readonly processingLogService: AiProcessingLogService,
	) {
		// Initialize orchestrator agent with Prisma and KnowledgeService
		this.orchestratorAgent = new OrchestratorAgent(this.prisma, this.knowledge);
		// Initialize SQL generation agent with knowledge service for RAG
		this.sqlGenerationAgent = new SqlGenerationAgent(this.knowledge);
		// Dọn dẹp session cũ định kỳ - similar to rooms.service.ts cleanup pattern
		setInterval(() => {
			this.cleanupExpiredSessions();
		}, this.CLEANUP_INTERVAL_MS);
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
	 * Generate session ID based on user context - similar to rooms.service.ts cache key generation
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Session ID
	 */
	private generateSessionId(userId?: string, clientIp?: string): string {
		if (userId) {
			return `user_${userId}`;
		}
		if (clientIp) {
			return `ip_${clientIp.replace(/[:.]/g, '_')}`;
		}
		// Fallback to random session (không khuyến khích)
		return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get or create chat session - pattern similar to rooms.service.ts shouldIncrementView
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Chat session
	 */
	private getOrCreateSession(userId?: string, clientIp?: string): ChatSession {
		const sessionId = this.generateSessionId(userId, clientIp);

		if (this.chatSessions.has(sessionId)) {
			const session = this.chatSessions.get(sessionId)!;
			session.lastActivity = new Date();
			return session;
		}

		// Tạo session mới với system prompt tiếng Việt
		const newSession: ChatSession = {
			sessionId,
			userId,
			clientIp,
			messages: [
				{ role: 'system', content: VIETNAMESE_LOCALE_SYSTEM_PROMPT, timestamp: new Date() },
			],
			lastActivity: new Date(),
			createdAt: new Date(),
		};

		this.chatSessions.set(sessionId, newSession);
		return newSession;
	}

	/**
	 * Add message to session with AI SDK CoreMessage format
	 * @param session - Chat session
	 * @param role - Message role
	 * @param content - Message content
	 */
	private addMessageToSession(
		session: ChatSession,
		role: 'user' | 'assistant' | 'system',
		content: string,
		envelope?: {
			kind?: 'CONTENT' | 'DATA' | 'CONTROL';
			payload?: any;
			meta?: Record<string, unknown>;
		},
	): void {
		const message: ChatMessage = {
			role,
			content,
			timestamp: new Date(),
			kind: envelope?.kind,
			payload: envelope?.payload as any,
			meta: envelope?.meta as Record<string, string | number | boolean> | undefined,
		};

		session.messages.push(message);
		session.lastActivity = new Date();

		// Giới hạn số lượng tin nhắn để tránh memory leak
		if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
			// Giữ lại system message đầu tiên (nếu có) và tin nhắn gần đây nhất
			const systemMessages = session.messages.filter((m) => m.role === 'system');
			const recentMessages = session.messages
				.filter((m) => m.role !== 'system')
				.slice(-this.MAX_MESSAGES_PER_SESSION + systemMessages.length);
			session.messages = [...systemMessages, ...recentMessages];
		}
	}

	/**
	 * Clean up expired sessions - similar to rooms.service.ts cleanupViewCache
	 */
	private cleanupExpiredSessions(): void {
		const now = Date.now();
		const expiredSessions: string[] = [];

		for (const [sessionId, session] of this.chatSessions.entries()) {
			if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT_MS) {
				expiredSessions.push(sessionId);
			}
		}

		for (const sessionId of expiredSessions) {
			this.chatSessions.delete(sessionId);
		}

		if (expiredSessions.length > 0) {
			// Log cleanup for monitoring purposes
			// console.log(`Cleaned up ${expiredSessions.length} expired chat sessions`);
		}
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

		const session = this.getOrCreateSession(userId, clientIp);
		const pipelineStartAt = this.logPipelineStart(message, session.sessionId);

		this.logDebug('ROOM_PUBLISH', `Starting room publishing flow for user ${userId}`);
		if (buildingId) {
			this.logDebug('ROOM_PUBLISH', `Building ID provided: ${buildingId}`);
		}

		// Lưu câu hỏi của người dùng vào session
		this.addMessageToSession(session, 'user', message);

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
			this.addMessageToSession(session, 'assistant', messageText, {
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
			const session = this.getOrCreateSession(userId);
			this.logDebug(
				'ROOM_PUBLISH',
				'[TOOL CALL] addMessageToSession() - Saving success message to session',
			);
			this.addMessageToSession(session, 'assistant', successMessage, {
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
		const session = this.getOrCreateSession(userId, clientIp);
		const pipelineStartAt = this.logPipelineStart(query, session.sessionId);

		// Parse và thêm thông tin trang hiện tại vào context nếu có
		if (currentPage) {
			this.logDebug('CONTEXT', `Current page received: ${currentPage}`);
			// Parse entity và identifier từ URL path
			const contextInfo = this.parsePageContext(currentPage);
			if (contextInfo) {
				const contextMessage = `[CONTEXT] User is currently viewing: ${currentPage}\n[CONTEXT] Entity: ${contextInfo.entity}, Identifier: ${contextInfo.identifier}${contextInfo.type ? `, Type: ${contextInfo.type}` : ''}`;
				this.addMessageToSession(session, 'system', contextMessage);
				this.logInfo(
					'CONTEXT',
					`Parsed page context: entity=${contextInfo.entity}, identifier=${contextInfo.identifier}, type=${contextInfo.type || 'unknown'}`,
				);
			} else {
				// Fallback: chỉ ghi lại URL nếu không parse được
				this.addMessageToSession(
					session,
					'system',
					`[CONTEXT] User is currently viewing: ${currentPage}`,
				);
				this.logWarn('CONTEXT', `Could not parse page context from: ${currentPage}`);
			}
		} else {
			this.logDebug('CONTEXT', 'No currentPage provided');
		}

		// Lưu câu hỏi của người dùng vào session
		this.addMessageToSession(session, 'user', query);

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
			this.logDebug(
				'SESSION',
				`BẮT ĐẦU XỬ LÝ | session=${session.sessionId}${currentPage ? ` | page=${currentPage}` : ''}`,
			);
			appendStep('SESSION START', {
				session: session.sessionId,
				page: currentPage || 'none',
				userId: session.userId || 'anonymous',
			});

			// ========================================
			// BƯỚC 2: Agent 1 - Orchestrator Agent
			// ========================================
			// ORCHESTRATOR features:
			// - Classify user role & request type
			// - Read business context via RAG (limit=8, threshold=0.6)
			// - Decide readiness for SQL
			// - Derive intent hints: ENTITY/FILTERS/MODE
			const orchestratorStartTime = Date.now();
			this.logInfo(
				'ORCHESTRATOR',
				'START | classify role & type | read business RAG | derive intents',
			);
			const orchestratorResponse = await this.orchestratorAgent.process(
				query,
				session,
				this.AI_CONFIG,
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
					this.addMessageToSession(session, 'assistant', messageText, {
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
					await this.processingLogService.saveProcessingLog({
						question: query,
						...processingLogData,
					});

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
					this.addMessageToSession(session, 'assistant', cleanedMessage, {
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
					await this.processingLogService.saveProcessingLog({
						question: query,
						...processingLogData,
					});

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
				this.addMessageToSession(session, 'assistant', clarificationMessage, {
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
				await this.processingLogService.saveProcessingLog({
					question: query,
					...processingLogData,
				});

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

			// Lưu hints từ agent vào session để agent SQL hiểu rõ hơn
			if (orchestratorResponse.entityHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] ENTITY=${orchestratorResponse.entityHint.toUpperCase()}`,
				);
				this.logDebug('ORCHESTRATOR', `Added ENTITY hint: ${orchestratorResponse.entityHint}`);
			}
			if (orchestratorResponse.filtersHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] FILTERS=${orchestratorResponse.filtersHint}`,
				);
				this.logDebug(
					'ORCHESTRATOR',
					`Added FILTERS hint: ${orchestratorResponse.filtersHint.substring(0, 50)}`,
				);
			}
			if (orchestratorResponse.tablesHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] TABLES=${orchestratorResponse.tablesHint}`,
				);
				this.logDebug(
					'ORCHESTRATOR',
					`Added TABLES hint: ${orchestratorResponse.tablesHint} (will enhance RAG query)`,
				);
			}
			if (orchestratorResponse.relationshipsHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] RELATIONSHIPS=${orchestratorResponse.relationshipsHint}`,
				);
				this.logDebug(
					'ORCHESTRATOR',
					`Added RELATIONSHIPS hint: ${orchestratorResponse.relationshipsHint}`,
				);
			}
			if (desiredMode === 'INSIGHT') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=INSIGHT');
			} else if (desiredMode === 'CHART') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=CHART');
			} else if (desiredMode === 'LIST') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=LIST');
			} else {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=TABLE');
			}
			if (orchestratorResponse.intentAction) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] ACTION=${orchestratorResponse.intentAction.toUpperCase()}`,
				);
				this.logDebug(
					'ORCHESTRATOR',
					`Added INTENT_ACTION hint: ${orchestratorResponse.intentAction}`,
				);
			}

			// Kiểm tra: Agent 1 đã xác định đủ thông tin để tạo SQL chưa?
			if (orchestratorResponse.readyForSql) {
				// ========================================
				// BƯỚC 3: Agent 2 - SQL Generation Agent
				// ========================================
				// SQL_AGENT features:
				// - Canonical reuse decision (hard=0.92, soft=0.8)
				// - Retrieve schema context via RAG (limit=8, threshold=0.6)
				// - Generate SQL (use business + intent hints)
				// - Execute read-only & serialize results
				const sqlStartTime = Date.now();
				this.logInfo(
					'SQL_AGENT',
					'START | canonical decision | schema RAG | generate SQL | execute',
				);
				const sqlResult = await this.sqlGenerationAgent.process(
					query,
					session,
					this.prisma,
					this.AI_CONFIG,
					orchestratorResponse.businessContext,
				);
				const sqlDuration = Date.now() - sqlStartTime;
				this.logInfo(
					'SQL_AGENT',
					`END | sqlPreview=${sqlResult.sql.substring(0, 50)}... | results=${sqlResult.count} | took=${sqlDuration}ms`,
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
				if (sqlResult.debug?.attempts?.length) {
					processingLogData.sqlGenerationAttempts = sqlResult.debug.attempts;
				} else {
					processingLogData.sqlGenerationAttempts!.push({
						sql: sqlResult.sql,
						count: sqlResult.count,
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

				// Full SQL banner for debugging
				try {
					const top = '-------------------- GENERATED SQL (BEGIN) --------------------';
					const bottom = '--------------------- GENERATED SQL (END) ---------------------';
					this.logger.log(this.formatStep('SQL_AGENT', top));
					this.logger.log(this.formatStep('SQL_AGENT', sqlResult.sql));
					this.logger.log(this.formatStep('SQL_AGENT', bottom));
				} catch (e) {
					this.logWarn('SQL_AGENT', 'Failed to log full generated SQL', e);
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
					),
					// Agent 4: Result Validator - Đánh giá tính hợp lệ của kết quả
					this.resultValidatorAgent.validateResult(
						query,
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

				// Persist Q&A - ƯU TIÊN LƯU: Chỉ skip nếu có ERROR severity rõ ràng
				// isValid=true hoặc WARN severity → lưu để có thể cải thiện sau
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
						this.logDebug(
							'PERSIST',
							`Đang lưu Q&A vào knowledge store (isValid=${validation.isValid}, severity=${validation.severity || 'none'}, count=${sqlResult.count})...`,
						);
						await this.knowledge.saveQAInteraction({
							question: query,
							sql: sqlResult.sql,
							sessionId: session.sessionId,
							userId: session.userId,
							context: { count: sqlResult.count, severity: validation.severity || 'OK' },
						});
						this.logDebug('PERSIST', 'Đã lưu Q&A thành công vào knowledge store');
						appendStep('PERSIST KNOWLEDGE', {
							status: 'saved',
							count: sqlResult.count,
							severity: validation.severity || 'OK',
						});
					} catch (persistErr) {
						this.logWarn('PERSIST', 'Không thể lưu Q&A vào knowledge store', persistErr);
						appendStep('PERSIST KNOWLEDGE FAILED', String(persistErr));
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
						`Kết quả không đủ chất lượng, không lưu vào knowledge store (${skipReason}): ${validation.reason || 'Unknown error'}`,
					);
					appendStep('PERSIST SKIPPED', skipReason);
				}

				// Build data payload từ parsed structured data
				const dataPayload: DataPayload | undefined = this.buildDataPayloadFromParsed(
					parsedResponse,
					desiredMode,
				);

				// Lưu câu trả lời vào session (kèm envelope structured)
				this.addMessageToSession(session, 'assistant', parsedResponse.message, {
					kind: 'DATA',
					payload: dataPayload,
				});

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

				// Save single log entry với tất cả data đã được append ở từng bước
				processingLogData.response = parsedResponse.message;
				processingLogData.status = 'completed';
				processingLogData.tokenUsage = totalTokenUsage;
				processingLogData.totalDuration = Date.now() - pipelineStartAt;
				appendStep('SUMMARY', {
					totalDurationMs: processingLogData.totalDuration,
					totalTokens: totalTokenUsage.totalTokens || 0,
				});
				processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
				await this.processingLogService.saveProcessingLog({
					question: query,
					...processingLogData,
				});

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
				this.addMessageToSession(session, 'assistant', cleanedMessage, {
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
				await this.processingLogService.saveProcessingLog({
					question: query,
					...processingLogData,
				});

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
			this.addMessageToSession(session, 'assistant', messageText, {
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
			processingLogData.stepsLog = formatStepLogsToMarkdown(stepLogs);
			await this.processingLogService.saveProcessingLog({
				question: query,
				...processingLogData,
			});

			this.logPipelineEnd(session.sessionId, response.kind, pipelineStartAt);
			return response;
		}
	}

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
	): DataPayload | undefined {
		// INSIGHT mode không có structured data
		if (desiredMode === 'INSIGHT') {
			return undefined;
		}
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
			return {
				mode: 'TABLE',
				table: parsedResponse.table,
			};
		}

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
		const session = this.getOrCreateSession(userId, clientIp);

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
		const sessionId = this.generateSessionId(userId, clientIp);

		if (this.chatSessions.has(sessionId)) {
			this.chatSessions.delete(sessionId);
		}

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
}
