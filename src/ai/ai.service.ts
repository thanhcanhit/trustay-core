import { google } from '@ai-sdk/google';
import { Injectable } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Interface for chat message compatible with AI SDK
 */
interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

/**
 * Interface for chat session with conversation history
 */
interface ChatSession {
	sessionId: string;
	userId?: string;
	clientIp?: string;
	messages: ChatMessage[];
	lastActivity: Date;
	createdAt: Date;
}

/**
 * Interface for chat response
 */
export interface ChatResponse {
	sessionId: string;
	message: string;
	sql?: string;
	results?: any;
	count?: number;
	timestamp: string;
	validation?: { isValid: boolean; reason?: string };
}

@Injectable()
export class AiService {
	// AI Constants
	private readonly AI_CONFIG = {
		temperature: 0.1,
		maxTokens: 500,
		limit: 100,
		model: 'gemini-2.0-flash',
	};

	// Chat session management - similar to rooms.service.ts view cache pattern
	private chatSessions = new Map<string, ChatSession>();
	private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút
	private readonly MAX_MESSAGES_PER_SESSION = 20; // Giới hạn tin nhắn mỗi session
	private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 phút

	constructor(private readonly prisma: PrismaService) {
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
	 * Validates if the user query is appropriate for database querying
	 * @param query - User input query
	 * @returns boolean indicating if query is valid for SQL generation
	 */
	private async validateQueryIntent(query: string): Promise<{ isValid: boolean; reason?: string }> {
		const validationPrompt = `
Bạn là AI validator cho hệ thống Text-to-SQL của ứng dụng Trustay (quản lý thuê phòng).

Câu hỏi người dùng: "${query}"

Hãy đánh giá xem câu hỏi này có phù hợp để chuyển đổi thành SQL query không?

TIÊU CHÍ CHẤP NHẬN:
- Câu hỏi về dữ liệu: users, buildings, rooms, rentals, bills, payments, bookings, notifications
- Câu hỏi thống kê, báo cáo, tìm kiếm thông tin
- Câu hỏi về trạng thái, số lượng, danh sách

TIÊU CHÍ TỪ CHỐI:
- Chào hỏi đơn thuần: "hello", "hi", "xin chào"
- Câu hỏi không liên quan đến dữ liệu
- Yêu cầu thực hiện hành động (tạo, sửa, xóa)
- Câu hỏi mơ hồ không rõ ràng

Trả về CHÍNH XÁC theo format:
VALID: true/false
REASON: lý do (nếu false)`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: validationPrompt,
				temperature: 0.1,
				maxOutputTokens: 200,
			});

			const response = text.trim();
			const isValid = response.includes('VALID: true');
			const reasonMatch = response.match(/REASON: (.+)/);
			const reason = reasonMatch ? reasonMatch[1].trim() : undefined;

			return { isValid, reason };
		} catch {
			// If validation fails, default to allowing the query
			return { isValid: true };
		}
	}

	/**
	 * Chat with AI for database queries - Main method for frontend integration
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
			// Step 2: Validate query intent with conversation context
			const validation = await this.validateQueryIntentWithContext(query, session);
			if (!validation.isValid) {
				const errorMessage = `Câu hỏi không phù hợp để truy vấn dữ liệu: ${validation.reason || 'Câu hỏi không hợp lệ'}`;
				this.addMessageToSession(session, 'assistant', errorMessage);

				return {
					sessionId: session.sessionId,
					message: errorMessage,
					timestamp: new Date().toISOString(),
					validation,
				};
			}

			// Step 3: Generate and execute SQL with conversation context
			const sqlResult = await this.generateAndExecuteSqlWithContext(query, session);

			// Step 4: Generate human-friendly response
			const friendlyResponse = await this.generateFriendlyResponse(query, sqlResult, session);

			// Add assistant response to session
			this.addMessageToSession(session, 'assistant', friendlyResponse);

			return {
				sessionId: session.sessionId,
				message: friendlyResponse,
				sql: sqlResult.sql,
				results: sqlResult.results,
				count: sqlResult.count,
				timestamp: new Date().toISOString(),
				validation,
			};
		} catch (error) {
			const errorMessage = `Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn: ${error.message}`;
			this.addMessageToSession(session, 'assistant', errorMessage);

			return {
				sessionId: session.sessionId,
				message: errorMessage,
				timestamp: new Date().toISOString(),
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
	 * Legacy method for backward compatibility
	 * @param query - User query
	 * @returns SQL execution result
	 */
	async generateAndExecuteSql(query: string) {
		// Step 1: Validate query intent
		const validation = await this.validateQueryIntent(query);
		if (!validation.isValid) {
			throw new Error(
				`Query not suitable for database querying: ${validation.reason || 'Invalid query intent'}`,
			);
		}

		const dbSchema = `
DATABASE SCHEMA - Trustay App:

MAIN TABLES:
- users (id, email, phone, first_name, last_name, role: tenant|landlord, created_at)
- buildings (id, name, address, owner_id -> users.id, created_at)
- rooms (id, building_id -> buildings.id, name, price, area_sqm, room_type, is_available)
- rentals (id, room_id -> rooms.id, tenant_id -> users.id, owner_id -> users.id, status: active|terminated, start_date, end_date)
- bills (id, rental_id -> rentals.id, amount, status: pending|paid|overdue, due_date, created_at)
- payments (id, bill_id -> bills.id, amount, payment_method, status: pending|completed, created_at)
- room_bookings (id, room_id -> rooms.id, user_id -> users.id, status: pending|approved|rejected, created_at)
- notifications (id, user_id -> users.id, title, message, is_read, created_at)

ENUMS:
- UserRole: tenant, landlord
- RoomType: boarding_house, dormitory, sleepbox, apartment, whole_house
- BillStatus: draft, pending, paid, overdue, cancelled
- PaymentStatus: pending, completed, failed, refunded
`;

		const prompt = `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào schema database và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${dbSchema}

Câu hỏi người dùng: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${this.AI_CONFIG.limit} để tránh quá nhiều kết quả

SQL:`;

		try {
			// Step 2: Generate SQL using AI SDK
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt,
				temperature: this.AI_CONFIG.temperature,
				maxOutputTokens: this.AI_CONFIG.maxTokens,
			});

			let sql = text.trim();

			// Clean up SQL response
			sql = sql
				.replace(/```sql\n?/g, '')
				.replace(/```\n?/g, '')
				.trim();
			if (!sql.endsWith(';')) {
				sql += ';';
			}

			// Basic safety check - only allow SELECT queries
			const sqlLower = sql.toLowerCase().trim();
			if (!sqlLower.startsWith('select')) {
				throw new Error('Only SELECT queries are allowed for security reasons');
			}

			// Step 3: Execute the SQL query
			const results = await this.prisma.$queryRawUnsafe(sql);

			return {
				query,
				sql,
				results,
				count: Array.isArray(results) ? results.length : 1,
				config: this.AI_CONFIG,
				timestamp: new Date().toISOString(),
				validation: validation,
			};
		} catch (error) {
			throw new Error(`Failed to generate or execute SQL: ${error.message}`);
		}
	}

	/**
	 * Validate query intent with conversation context
	 * @param query - User query
	 * @param session - Chat session for context
	 * @returns Validation result
	 */
	private async validateQueryIntentWithContext(
		query: string,
		session: ChatSession,
	): Promise<{ isValid: boolean; reason?: string }> {
		// Get recent conversation context
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3) // Last 3 messages for context
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const contextualPrompt = `
Bạn là AI validator cho hệ thống Text-to-SQL của ứng dụng Trustay (quản lý thuê phòng).

${recentMessages ? `NGỮ CẢNH HỘI THOẠI GẦN ĐÂY:\n${recentMessages}\n\n` : ''}

Câu hỏi hiện tại: "${query}"

Hãy đánh giá xem câu hỏi này có phù hợp để chuyển đổi thành SQL query không?

TIÊU CHÍ CHẤP NHẬN:
- Câu hỏi về dữ liệu: users, buildings, rooms, rentals, bills, payments, bookings, notifications
- Câu hỏi thống kê, báo cáo, tìm kiếm thông tin
- Câu hỏi về trạng thái, số lượng, danh sách
- Câu hỏi tiếp theo liên quan đến chủ đề đang thảo luận

TIÊU CHÍ TỪ CHỐI:
- Chào hỏi đơn thuần: "hello", "hi", "xin chào" (trừ khi là tin nhắn đầu tiên)
- Câu hỏi không liên quan đến dữ liệu
- Yêu cầu thực hiện hành động (tạo, sửa, xóa)
- Câu hỏi mơ hồ không rõ ràng

Trả về CHÍNH XÁC theo format:
VALID: true/false
REASON: lý do (nếu false)`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: contextualPrompt,
				temperature: 0.1,
				maxOutputTokens: 200,
			});

			const response = text.trim();
			const isValid = response.includes('VALID: true');
			const reasonMatch = response.match(/REASON: (.+)/);
			const reason = reasonMatch ? reasonMatch[1].trim() : undefined;

			return { isValid, reason };
		} catch {
			// If validation fails, default to allowing the query
			return { isValid: true };
		}
	}

	/**
	 * Generate and execute SQL with conversation context
	 * @param query - User query
	 * @param session - Chat session for context
	 * @returns SQL execution result
	 */
	private async generateAndExecuteSqlWithContext(query: string, session: ChatSession) {
		// Get conversation context
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-5) // Last 5 messages for context
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const dbSchema = `
DATABASE SCHEMA - Trustay App:

MAIN TABLES:
- users (id, email, phone, first_name, last_name, role: tenant|landlord, created_at)
- buildings (id, name, address, owner_id -> users.id, created_at)
- rooms (id, building_id -> buildings.id, name, price, area_sqm, room_type, is_available)
- rentals (id, room_id -> rooms.id, tenant_id -> users.id, owner_id -> users.id, status: active|terminated, start_date, end_date)
- bills (id, rental_id -> rentals.id, amount, status: pending|paid|overdue, due_date, created_at)
- payments (id, bill_id -> bills.id, amount, payment_method, status: pending|completed, created_at)
- room_bookings (id, room_id -> rooms.id, user_id -> users.id, status: pending|approved|rejected, created_at)
- notifications (id, user_id -> users.id, title, message, is_read, created_at)

ENUMS:
- UserRole: tenant, landlord
- RoomType: boarding_house, dormitory, sleepbox, apartment, whole_house
- BillStatus: draft, pending, paid, overdue, cancelled
- PaymentStatus: pending, completed, failed, refunded
`;

		const contextualPrompt = `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào schema database, ngữ cảnh hội thoại và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${dbSchema}

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

Câu hỏi hiện tại: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${this.AI_CONFIG.limit} để tránh quá nhiều kết quả
6. Xem xét ngữ cảnh hội thoại để hiểu rõ ý định người dùng

SQL:`;

		try {
			// Generate SQL using AI SDK
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: contextualPrompt,
				temperature: this.AI_CONFIG.temperature,
				maxOutputTokens: this.AI_CONFIG.maxTokens,
			});

			let sql = text.trim();

			// Clean up SQL response
			sql = sql
				.replace(/```sql\n?/g, '')
				.replace(/```\n?/g, '')
				.trim();
			if (!sql.endsWith(';')) {
				sql += ';';
			}

			// Basic safety check - only allow SELECT queries
			const sqlLower = sql.toLowerCase().trim();
			if (!sqlLower.startsWith('select')) {
				throw new Error('Only SELECT queries are allowed for security reasons');
			}

			// Execute the SQL query
			const results = await this.prisma.$queryRawUnsafe(sql);

			return {
				sql,
				results,
				count: Array.isArray(results) ? results.length : 1,
			};
		} catch (error) {
			throw new Error(`Failed to generate or execute SQL: ${error.message}`);
		}
	}

	/**
	 * Generate human-friendly response from SQL results
	 * @param query - Original user query
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @returns Human-friendly response
	 */
	private async generateFriendlyResponse(
		query: string,
		sqlResult: { sql: string; results: any; count: number },
		session: ChatSession,
	): Promise<string> {
		// Get recent conversation context
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const responsePrompt = `
Bạn là AI assistant thân thiện cho ứng dụng Trustay. Hãy tạo câu trả lời dễ hiểu cho người dùng.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

Câu hỏi người dùng: "${query}"
SQL đã thực thi: ${sqlResult.sql}
Số kết quả: ${sqlResult.count}
Dữ liệu kết quả: ${JSON.stringify(sqlResult.results).substring(0, 1000)}...

Hãy tạo câu trả lời:
1. Thân thiện, dễ hiểu
2. Tóm tắt kết quả chính
3. Đề cập số lượng kết quả
4. Không hiển thị SQL query
5. Sử dụng tiếng Việt
6. Nếu không có kết quả, đưa ra gợi ý hữu ích

Câu trả lời:`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: responsePrompt,
				temperature: 0.3, // Slightly higher for more natural responses
				maxOutputTokens: 300,
			});

			return text.trim();
		} catch {
			// Fallback response
			if (sqlResult.count === 0) {
				return `Tôi không tìm thấy kết quả nào cho câu hỏi "${query}". Bạn có thể thử hỏi theo cách khác không?`;
			}

			return `Tôi đã tìm thấy ${sqlResult.count} kết quả cho câu hỏi của bạn về "${query}".`;
		}
	}
}
