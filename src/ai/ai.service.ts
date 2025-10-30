import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationalAgent } from './agents/conversational-agent';
import { ErrorHandler } from './agents/error-handler';
import { ResponseGenerator } from './agents/response-generator';
import { SqlGenerationAgent } from './agents/sql-generation-agent';
import { KnowledgeService } from './knowledge/knowledge.service';
import { ChatMessage, ChatResponse, ChatSession } from './types/chat.types';
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
	private readonly conversationalAgent = new ConversationalAgent();
	private sqlGenerationAgent: SqlGenerationAgent;
	private readonly responseGenerator = new ResponseGenerator();

	// Chat session management - similar to rooms.service.ts view cache pattern
	private chatSessions = new Map<string, ChatSession>();
	private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút
	private readonly MAX_MESSAGES_PER_SESSION = 20; // Giới hạn tin nhắn mỗi session
	private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 phút

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
	) {
		// Initialize SQL generation agent with knowledge service for RAG
		this.sqlGenerationAgent = new SqlGenerationAgent(this.knowledge);
		// Dọn dẹp session cũ định kỳ - similar to rooms.service.ts cleanup pattern
		setInterval(() => {
			this.cleanupExpiredSessions();
		}, this.CLEANUP_INTERVAL_MS);
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

		// Tạo session mới
		const newSession: ChatSession = {
			sessionId,
			userId,
			clientIp,
			messages: [],
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
	 * Chat with AI for database queries - Multi-agent flow implementation
	 * @param query - User query
	 * @param context - User context (userId, clientIp)
	 * @returns Chat response with conversation history
	 */
	async chatWithAI(
		query: string,
		context: { userId?: string; clientIp?: string } = {},
	): Promise<ChatResponse> {
		const { userId, clientIp } = context;

		// Step 1: Get or create chat session
		const session = this.getOrCreateSession(userId, clientIp);

		// Add user message to session
		this.addMessageToSession(session, 'user', query);

		try {
			this.logger.debug(`Processing chat query: "${query}" for session: ${session.sessionId}`);

			// MULTI-AGENT FLOW:
			// Agent 1: Conversational Agent - Always responds naturally
			const conversationalResponse = await this.conversationalAgent.process(
				query,
				session,
				this.AI_CONFIG,
			);
			this.logger.debug(
				`Conversational agent response: readyForSql=${conversationalResponse.readyForSql}`,
			);

			// If conversational agent determines we have enough info for SQL
			if (conversationalResponse.readyForSql) {
				this.logger.debug('Generating SQL...');
				// Agent 2: SQL Generation Agent
				const sqlResult = await this.sqlGenerationAgent.process(
					query,
					session,
					this.prisma,
					this.AI_CONFIG,
				);
				this.logger.debug(`SQL generated successfully, results count: ${sqlResult.count}`);

				// Generate final response combining conversation + SQL results
				const finalResponse = await this.responseGenerator.generateFinalResponse(
					conversationalResponse.message,
					sqlResult,
					session,
					this.AI_CONFIG,
				);

				// Persist Q&A with SQL canonical for self-learning
				try {
					await this.knowledge.saveQAInteraction({
						question: query,
						answer: finalResponse,
						sql: sqlResult.sql,
						sessionId: session.sessionId,
						userId: session.userId,
						context: { count: sqlResult.count },
					});
				} catch (persistErr) {
					this.logger.warn('Failed to persist Q&A to knowledge store', persistErr);
				}

				this.addMessageToSession(session, 'assistant', finalResponse);

				return {
					sessionId: session.sessionId,
					message: finalResponse,
					sql: sqlResult.sql,
					results: sqlResult.results,
					count: sqlResult.count,
					timestamp: new Date().toISOString(),
					validation: { isValid: true },
				};
			} else {
				// Agent 1 needs more info - return conversational response
				this.logger.debug('Returning conversational response (not ready for SQL)');
				this.addMessageToSession(session, 'assistant', conversationalResponse.message);

				return {
					sessionId: session.sessionId,
					message: conversationalResponse.message,
					timestamp: new Date().toISOString(),
					validation: {
						isValid: false,
						needsClarification: conversationalResponse.needsClarification,
						needsIntroduction: conversationalResponse.needsIntroduction,
					},
				};
			}
		} catch (error) {
			// Log detailed error for debugging
			this.logger.error(`Chat error for session ${session.sessionId}:`, error);

			// Generate user-friendly error message
			const errorMessage = ErrorHandler.generateErrorResponse(error.message);
			this.addMessageToSession(session, 'assistant', errorMessage);

			return {
				sessionId: session.sessionId,
				message: errorMessage,
				timestamp: new Date().toISOString(),
				error: error.message, // Include error for debugging
			};
		}
	}

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
