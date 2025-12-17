import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Service để quản lý AI Chat Sessions và Messages
 * Lưu trữ persistent sessions thay vì in-memory Map
 */
@Injectable()
export class ChatSessionService {
	private readonly logger = new Logger(ChatSessionService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Generate session ID based on user context
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
	 * Create a new chat session
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Created session
	 */
	async createSession(userId?: string, clientIp?: string) {
		try {
			const sessionId = this.generateSessionId(userId, clientIp);
			const session = await (this.prisma as any).aiChatSession.create({
				data: {
					id: sessionId,
					userId: userId || null,
					title: 'New Chat',
					summary: null,
					messageCount: 0,
					lastMessageAt: null,
				},
			});
			this.logger.debug(`Created chat session | id=${sessionId} | userId=${userId || 'anonymous'}`);
			return session;
		} catch (error) {
			this.logger.error('Failed to create chat session', error);
			throw error;
		}
	}

	/**
	 * Create a new conversation session with UUID (for explicit conversation management)
	 * This creates a truly new session, unlike getOrCreateSession which reuses existing
	 * @param userId - User ID if authenticated
	 * @param _clientIp - Client IP address (optional, for anonymous users - currently unused but kept for API consistency)
	 * @returns Created session with UUID
	 */
	async createNewConversationSession(userId?: string, _clientIp?: string) {
		try {
			// Use UUID for new conversations (Prisma will generate it)
			const session = await (this.prisma as any).aiChatSession.create({
				data: {
					userId: userId || null,
					title: 'New Chat',
					summary: null,
					messageCount: 0,
					lastMessageAt: null,
				},
			});
			this.logger.debug(
				`Created new conversation session | id=${session.id} | userId=${userId || 'anonymous'}`,
			);
			return session;
		} catch (error) {
			this.logger.error('Failed to create new conversation session', error);
			throw error;
		}
	}

	/**
	 * Get session by ID
	 * @param sessionId - Session ID
	 * @returns Session or null
	 */
	async getSession(sessionId: string) {
		try {
			return await (this.prisma as any).aiChatSession.findUnique({
				where: { id: sessionId },
				include: {
					messages: {
						orderBy: { sequenceNumber: 'asc' },
					},
				},
			});
		} catch (error) {
			this.logger.error(`Failed to get chat session: ${sessionId}`, error);
			return null;
		}
	}

	/**
	 * Get or create session (similar to in-memory pattern)
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Session
	 */
	async getOrCreateSession(userId?: string, clientIp?: string) {
		const sessionId = this.generateSessionId(userId, clientIp);
		const existing = await this.getSession(sessionId);
		if (existing) {
			return existing;
		}
		return await this.createSession(userId, clientIp);
	}

	/**
	 * Get recent messages for a session (for building prompt context)
	 * @param sessionId - Session ID
	 * @param limit - Number of messages to retrieve (default: 10)
	 * @returns Array of recent messages
	 */
	async getRecentMessages(sessionId: string, limit: number = 10) {
		try {
			return await (this.prisma as any).aiChatMessage.findMany({
				where: { sessionId },
				orderBy: { sequenceNumber: 'desc' },
				take: limit,
			});
		} catch (error) {
			this.logger.error(`Failed to get recent messages for session: ${sessionId}`, error);
			return [];
		}
	}

	/**
	 * Get old messages that haven't been summarized yet
	 * Used for rolling summary generation
	 * @param sessionId - Session ID
	 * @param limit - Number of old messages to retrieve (default: 5)
	 * @returns Array of old messages
	 */
	async getOldMessages(sessionId: string, limit: number = 5) {
		try {
			// Get messages that are not in the recent set (for summary)
			// We'll get messages sorted by sequenceNumber ascending, excluding the most recent ones
			const totalMessages = await (this.prisma as any).aiChatMessage.count({
				where: { sessionId },
			});
			if (totalMessages <= limit) {
				return [];
			}
			const skipCount = totalMessages - limit;
			return await (this.prisma as any).aiChatMessage.findMany({
				where: { sessionId },
				orderBy: { sequenceNumber: 'asc' },
				take: limit,
				skip: skipCount > 0 ? skipCount : 0,
			});
		} catch (error) {
			this.logger.error(`Failed to get old messages for session: ${sessionId}`, error);
			return [];
		}
	}

	/**
	 * Add message to session
	 * @param sessionId - Session ID
	 * @param role - Message role ('user', 'assistant', 'system')
	 * @param content - Message content
	 * @param metadata - Optional metadata (SQL query, execution time, token usage)
	 * @returns Created message
	 */
	async addMessage(
		sessionId: string,
		role: 'user' | 'assistant' | 'system',
		content: string,
		metadata?: Record<string, unknown>,
	) {
		try {
			// Get current message count to set sequenceNumber
			const currentCount = await (this.prisma as any).aiChatMessage.count({
				where: { sessionId },
			});
			const sequenceNumber = currentCount + 1;
			// Create message
			const message = await (this.prisma as any).aiChatMessage.create({
				data: {
					sessionId,
					role,
					content,
					metadata: metadata || null,
					sequenceNumber,
				},
			});
			// Update session: increment messageCount and update lastMessageAt
			await (this.prisma as any).aiChatSession.update({
				where: { id: sessionId },
				data: {
					messageCount: { increment: 1 },
					lastMessageAt: new Date(),
				},
			});
			this.logger.debug(
				`Added message to session | sessionId=${sessionId} | role=${role} | sequenceNumber=${sequenceNumber}`,
			);
			return message;
		} catch (error) {
			this.logger.error(`Failed to add message to session: ${sessionId}`, error);
			throw error;
		}
	}

	/**
	 * Update session summary (for rolling summary mechanism)
	 * @param sessionId - Session ID
	 * @param summary - New summary text
	 */
	async updateSessionSummary(sessionId: string, summary: string) {
		try {
			await (this.prisma as any).aiChatSession.update({
				where: { id: sessionId },
				data: { summary },
			});
			this.logger.debug(`Updated session summary | sessionId=${sessionId}`);
		} catch (error) {
			this.logger.error(`Failed to update session summary: ${sessionId}`, error);
			throw error;
		}
	}

	/**
	 * Update session title (for auto-titling)
	 * @param sessionId - Session ID
	 * @param title - New title
	 */
	async updateSessionTitle(sessionId: string, title: string) {
		try {
			await (this.prisma as any).aiChatSession.update({
				where: { id: sessionId },
				data: { title },
			});
			this.logger.debug(`Updated session title | sessionId=${sessionId} | title=${title}`);
		} catch (error) {
			this.logger.error(`Failed to update session title: ${sessionId}`, error);
			throw error;
		}
	}

	/**
	 * Get user sessions (for listing in sidebar)
	 * @param userId - User ID
	 * @param limit - Maximum number of sessions to retrieve (default: 50)
	 * @returns Array of sessions
	 */
	async getUserSessions(userId: string, limit: number = 50) {
		try {
			return await (this.prisma as any).aiChatSession.findMany({
				where: { userId },
				orderBy: { lastMessageAt: 'desc' },
				take: limit,
				select: {
					id: true,
					title: true,
					summary: true,
					lastMessageAt: true,
					messageCount: true,
					createdAt: true,
					updatedAt: true,
				},
			});
		} catch (error) {
			this.logger.error(`Failed to get user sessions: ${userId}`, error);
			return [];
		}
	}

	/**
	 * Delete session and all its messages
	 * @param sessionId - Session ID
	 */
	async deleteSession(sessionId: string) {
		try {
			// Messages will be deleted automatically due to CASCADE
			await (this.prisma as any).aiChatSession.delete({
				where: { id: sessionId },
			});
			this.logger.debug(`Deleted session | sessionId=${sessionId}`);
		} catch (error) {
			this.logger.error(`Failed to delete session: ${sessionId}`, error);
			throw error;
		}
	}

	/**
	 * Clear all messages from a session (keep session, reset messageCount)
	 * @param sessionId - Session ID
	 */
	async clearMessages(sessionId: string) {
		try {
			// Delete all messages
			await (this.prisma as any).aiChatMessage.deleteMany({
				where: { sessionId },
			});
			// Reset session
			await (this.prisma as any).aiChatSession.update({
				where: { id: sessionId },
				data: {
					messageCount: 0,
					lastMessageAt: null,
					summary: null,
				},
			});
			this.logger.debug(`Cleared messages from session | sessionId=${sessionId}`);
		} catch (error) {
			this.logger.error(`Failed to clear messages from session: ${sessionId}`, error);
			throw error;
		}
	}
}
