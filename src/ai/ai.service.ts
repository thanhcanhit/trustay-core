import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorAgent } from './agents/orchestrator-agent';
import { ResponseGenerator } from './agents/response-generator';
import { ResultValidatorAgent } from './agents/result-validator-agent';
import { SqlGenerationAgent } from './agents/sql-generation-agent';
import { KnowledgeService } from './knowledge/knowledge.service';
import { VIETNAMESE_LOCALE_SYSTEM_PROMPT } from './prompts/system.prompt';
import { generateErrorResponse } from './services/error-handler.service';
import {
	ChatMessage,
	ChatResponse,
	ChatSession,
	DataPayload,
	RequestType,
	TableColumn,
} from './types/chat.types';
import {
	inferColumns,
	isListLike,
	normalizeRows,
	selectImportantColumns,
	toListItems,
	tryBuildChart,
} from './utils/data-utils';
import { parseResponseText } from './utils/response-parser';
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
	private readonly MAX_MESSAGES_PER_SESSION = 20; // Giới hạn tin nhắn mỗi session
	private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 phút

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
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
	): void {
		const message: ChatMessage = {
			role,
			content,
			timestamp: new Date(),
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
	 * @param context - Ngữ cảnh người dùng (userId, clientIp)
	 * @returns Phản hồi chat với lịch sử hội thoại
	 */
	async chatWithAI(
		query: string,
		context: { userId?: string; clientIp?: string } = {},
	): Promise<ChatResponse> {
		const { userId, clientIp } = context;

		// Bước 1: Quản lý session - Lấy hoặc tạo session chat
		// Session tự động có system prompt tiếng Việt khi tạo mới
		const session = this.getOrCreateSession(userId, clientIp);

		// Lưu câu hỏi của người dùng vào session
		this.addMessageToSession(session, 'user', query);

		try {
			this.logDebug('SESSION', `Đang xử lý câu hỏi: "${query}" (session: ${session.sessionId})`);

			// ========================================
			// BƯỚC 2: Agent 1 - Orchestrator Agent
			// ========================================
			// Agent này có nhiệm vụ:
			// - Đánh nhãn user role và phân loại request type
			// - Đọc và hiểu business context từ RAG để nắm vững nghiệp vụ hệ thống
			// - Quyết định xem có đủ thông tin để tạo SQL query không
			// - Gợi ý mode response (LIST/TABLE/CHART) dựa trên ý định
			// MVP: Basic telemetry - timing logs
			const startTime = Date.now();
			this.logInfo(
				'ORCHESTRATOR',
				'Agent 1: Đang phân tích câu hỏi, đánh nhãn user role và request type...',
			);
			const orchestratorResponse = await this.orchestratorAgent.process(
				query,
				session,
				this.AI_CONFIG,
			);
			const orchestratorTime = Date.now() - startTime;
			this.logDebug(
				'ORCHESTRATOR',
				`[STEP] Orchestrator → readyForSql=${orchestratorResponse.readyForSql}, took=${orchestratorTime}ms (requestType=${orchestratorResponse.requestType}, userRole=${orchestratorResponse.userRole})`,
			);

			// Xác định mode response dựa trên ý định người dùng (LIST/TABLE/CHART)
			const desiredMode: 'LIST' | 'TABLE' | 'CHART' =
				orchestratorResponse.intentModeHint ?? 'TABLE';

			// Lưu hints từ agent vào session để agent SQL hiểu rõ hơn
			if (orchestratorResponse.entityHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] ENTITY=${orchestratorResponse.entityHint.toUpperCase()}`,
				);
			}
			if (orchestratorResponse.filtersHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] FILTERS=${orchestratorResponse.filtersHint}`,
				);
			}
			if (desiredMode === 'CHART') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=CHART');
			} else if (desiredMode === 'LIST') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=LIST');
			} else {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=TABLE');
			}

			// MVP: Handle clarification when missingParams are present
			if (
				orchestratorResponse.requestType === RequestType.QUERY &&
				orchestratorResponse.missingParams &&
				orchestratorResponse.missingParams.length > 0
			) {
				// Return clarification response with missingParams
				const clarificationMessage = this.formatClarificationMessage(
					orchestratorResponse.message,
					orchestratorResponse.missingParams,
				);
				return {
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
			}

			// Kiểm tra: Agent 1 đã xác định đủ thông tin để tạo SQL chưa?
			if (
				orchestratorResponse.requestType === RequestType.QUERY &&
				orchestratorResponse.readyForSql
			) {
				// ========================================
				// BƯỚC 3: Agent 2 - SQL Generation Agent
				// ========================================
				// Agent này có nhiệm vụ:
				// - Tái sử dụng canonical SQL nếu có, hoặc tạo SQL mới dựa trên context
				// - Sử dụng RAG để lấy schema context liên quan
				// - Tạo SQL query dựa trên câu hỏi, business context và hints từ Agent 1
				// - Thực thi SQL query an toàn (read-only)
				// - Trả về kết quả đã được serialize
				// MVP: Basic telemetry - SQL generation timing
				const sqlStartTime = Date.now();
				this.logInfo('SQL_AGENT', 'Agent 2: Đang tạo và thực thi SQL query...');
				const sqlResult = await this.sqlGenerationAgent.process(
					query,
					session,
					this.prisma,
					this.AI_CONFIG,
					orchestratorResponse.businessContext,
				);
				const sqlTime = Date.now() - sqlStartTime;
				this.logInfo(
					'SQL_AGENT',
					`[STEP] SQL Generation → query=${sqlResult.sql.substring(0, 50)}..., results=${sqlResult.count}, took=${sqlTime}ms`,
				);

				// ========================================
				// BƯỚC 4 & 5: Response Generator & Result Validator (PARALLEL)
				// ========================================
				// Hai agent này chạy SONG SONG để tối ưu latency:
				// - Agent 3 (Response Generator): Biến đổi Result thành phản hồi có cấu trúc
				// - Agent 4 (Result Validator): Đánh giá tính hợp lệ của kết quả
				// MVP: Parallel execution để giảm latency ~30-50%
				this.logInfo(
					'PARALLEL',
					'Agent 3 & 4: Đang xử lý song song (Response Generator + Result Validator)...',
				);
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
				const parallelTime = Date.now() - parallelStartTime;
				this.logInfo(
					'PARALLEL',
					`[STEP] Parallel execution → Response Generator & Validator completed in ${parallelTime}ms (vs sequential ~${Math.round(parallelTime * 1.5)}ms estimated)`,
				);
				this.logDebug(
					'VALIDATOR',
					`[STEP] Validator → isValid=${validation.isValid}, severity=${validation.severity || 'N/A'}, reason=${validation.reason || 'OK'}`,
				);

				// Parse responseText để tách message và structured data
				const parsedResponse = parseResponseText(responseText);

				// MVP: Persist Q&A - Chỉ skip nếu có ERROR severity
				// WARN severity vẫn cho phép persist để có thể học hỏi
				if (validation.isValid || validation.severity === 'WARN') {
					try {
						this.logDebug(
							'PERSIST',
							`Đang lưu Q&A vào knowledge store (isValid=${validation.isValid}, severity=${validation.severity})...`,
						);
						await this.knowledge.saveQAInteraction({
							question: query,
							sql: sqlResult.sql,
							sessionId: session.sessionId,
							userId: session.userId,
							context: { count: sqlResult.count },
						});
						this.logDebug('PERSIST', 'Đã lưu Q&A thành công vào knowledge store');
					} catch (persistErr) {
						this.logWarn('PERSIST', 'Không thể lưu Q&A vào knowledge store', persistErr);
					}
				} else {
					this.logWarn(
						'VALIDATOR',
						`Kết quả không hợp lệ (ERROR), không lưu vào knowledge store: ${validation.reason || 'Unknown error'}`,
					);
				}

				// Build data payload từ parsed structured data
				const dataPayload: DataPayload | undefined = this.buildDataPayloadFromParsed(
					parsedResponse,
					desiredMode,
				);

				// Lưu câu trả lời vào session (chỉ phần message, không có structured data)
				this.addMessageToSession(session, 'assistant', parsedResponse.message);

				// Trả về response với payload structured cho UI
				return {
					kind: 'DATA',
					sessionId: session.sessionId,
					timestamp: new Date().toISOString(),
					message: parsedResponse.message,
					payload: dataPayload,
				};
			} else {
				// ========================================
				// Trường hợp: Chưa đủ thông tin hoặc không phải QUERY
				// ========================================
				// Agent 1 xác định cần làm rõ thêm trước khi có thể tạo SQL
				// Trả về response yêu cầu clarification hoặc general chat
				if (orchestratorResponse.requestType === RequestType.CLARIFICATION) {
					this.logInfo('ORCHESTRATOR', 'Cần thêm thông tin - trả về response yêu cầu làm rõ');
					const messageText: string = `Mình cần thêm chút thông tin để trả lời chính xác: ${orchestratorResponse.message}`;
					this.addMessageToSession(session, 'assistant', messageText);

					return {
						kind: 'CONTROL',
						sessionId: session.sessionId,
						timestamp: new Date().toISOString(),
						message: messageText,
						payload: { mode: 'CLARIFY', questions: [] },
					};
				} else {
					// General chat or greeting
					this.logInfo('ORCHESTRATOR', `Request type: ${orchestratorResponse.requestType}`);
					this.addMessageToSession(session, 'assistant', orchestratorResponse.message);

					return {
						kind: 'CONTENT',
						sessionId: session.sessionId,
						timestamp: new Date().toISOString(),
						message: orchestratorResponse.message,
						payload: { mode: 'CONTENT' },
					};
				}
			}
		} catch (error) {
			// ========================================
			// Xử lý lỗi
			// ========================================
			// Ghi log chi tiết để debug
			this.logError('ERROR', `Lỗi xử lý chat (session ${session.sessionId})`, error);

			// Tạo message lỗi thân thiện cho người dùng
			const errorMessage = generateErrorResponse((error as Error).message);
			const messageText: string = `Xin lỗi, đã xảy ra lỗi: ${errorMessage}`;
			this.addMessageToSession(session, 'assistant', messageText);

			return {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message: messageText,
				payload: { mode: 'ERROR', details: (error as Error).message },
			};
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
			return baseMessage;
		}
		const paramsList = missingParams.map((param) => {
			const examplesText =
				param.examples && param.examples.length > 0 ? ` (ví dụ: ${param.examples.join(', ')})` : '';
			return `• ${param.reason}${examplesText}`;
		});
		const paramsSection = paramsList.join('\n');
		return `${baseMessage}\n\n**Thông tin cần bổ sung:**\n${paramsSection}`;
	}

	/**
	 * Build data payload from parsed response (with LIST/TABLE/CHART)
	 * @param parsedResponse - Parsed response from parseResponseText
	 * @param desiredMode - Desired output mode
	 * @returns Data payload for UI
	 */
	private buildDataPayloadFromParsed(
		parsedResponse: { list: any[] | null; table: any | null; chart: any | null },
		_desiredMode?: 'LIST' | 'TABLE' | 'CHART',
	): DataPayload | undefined {
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
		desiredMode?: 'LIST' | 'TABLE' | 'CHART',
	): DataPayload | undefined {
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
}
