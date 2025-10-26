import { google } from '@ai-sdk/google';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
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
	validation?: {
		isValid: boolean;
		reason?: string;
		needsClarification?: boolean;
		needsIntroduction?: boolean;
		clarificationQuestion?: string;
	};
	error?: string; // For debugging purposes
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

	// Logger for debugging
	private readonly logger = new Logger(AiService.name);

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
	 * @returns validation result with clarification questions if needed
	 */
	private async validateQueryIntent(query: string): Promise<{
		isValid: boolean;
		reason?: string;
		needsClarification?: boolean;
		needsIntroduction?: boolean;
		clarificationQuestion?: string;
	}> {
		const validationPrompt = `
Bạn là AI validator cho hệ thống Text-to-SQL của ứng dụng Trustay (quản lý thuê phòng).

Câu hỏi người dùng: "${query}"

Hãy đánh giá câu hỏi này và phân loại:

PHÂN LOẠI:
1. VALID - Câu hỏi có thể tạo SQL ngay (ƯU TIÊN CAO)
2. NEEDS_INTRODUCTION - Câu hỏi quá chung chung, cần giới thiệu tính năng AI
3. NEEDS_CLARIFICATION - CHỈ khi hoàn toàn không hiểu ý định
4. INVALID - Câu hỏi không liên quan hoặc không thể xử lý

DỮ LIỆU CÓ SẴN:
- users: thông tin người dùng (tenant/landlord, email, phone, tên, ngày tạo)
- buildings: tòa nhà (tên, địa chỉ, chủ sở hữu)
- rooms: phòng (tên, giá, diện tích, loại phòng, trạng thái)
- rentals: hợp đồng thuê (tenant, owner, trạng thái, ngày bắt đầu/kết thúc)
- bills: hóa đơn (số tiền, trạng thái thanh toán, hạn thanh toán)
- payments: thanh toán (số tiền, phương thức, trạng thái)
- room_bookings: đặt phòng (trạng thái: pending/approved/rejected)
- notifications: thông báo (tiêu đề, nội dung, đã đọc)

NGUYÊN TẮC QUAN TRỌNG:
- ƯU TIÊN VALID khi có thể suy đoán được ý định
- Với câu hỏi tìm phòng: "giá rẻ", "quận 1", "phòng trọ" → VALID ngay
- Với câu hỏi thống kê: "doanh thu", "thống kê" → VALID ngay
- CHỈ NEEDS_CLARIFICATION khi hoàn toàn không hiểu ý định

TIÊU CHÍ:
- VALID: Câu hỏi về dữ liệu, có thể suy đoán ý định
- NEEDS_INTRODUCTION: Câu hỏi quá chung chung như "help", "gì", "làm gì được", "tính năng"
- NEEDS_CLARIFICATION: CHỈ khi hoàn toàn không hiểu ý định
- INVALID: Chào hỏi, yêu cầu thao tác (tạo/sửa/xóa), không liên quan

Trả về CHÍNH XÁC theo format:
CLASSIFICATION: VALID/NEEDS_INTRODUCTION/NEEDS_CLARIFICATION/INVALID
CLARIFICATION_QUESTION: [nếu NEEDS_CLARIFICATION, đưa ra câu hỏi cụ thể để làm rõ]
REASON: [lý do nếu INVALID]`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: validationPrompt,
				temperature: 0.1,
				maxOutputTokens: 300,
			});

			const response = text.trim();

			if (response.includes('CLASSIFICATION: VALID')) {
				return { isValid: true };
			}

			if (response.includes('CLASSIFICATION: NEEDS_CLARIFICATION')) {
				const clarificationMatch = response.match(/CLARIFICATION_QUESTION: (.+)/);
				const clarificationQuestion = clarificationMatch
					? clarificationMatch[1].trim()
					: 'Bạn có thể cung cấp thêm thông tin cụ thể để tôi có thể giúp bạn tốt hơn?';

				return {
					isValid: false,
					needsClarification: true,
					clarificationQuestion,
				};
			}

			// INVALID case
			const reasonMatch = response.match(/REASON: (.+)/);
			const reason = reasonMatch ? reasonMatch[1].trim() : 'Câu hỏi không phù hợp';

			return {
				isValid: false,
				needsClarification: false,
				reason,
			};
		} catch {
			// If validation fails, default to allowing the query
			return { isValid: true };
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
			const conversationalResponse = await this.conversationalAgent(query, session);
			this.logger.debug(
				`Conversational agent response: readyForSql=${conversationalResponse.readyForSql}`,
			);

			// If conversational agent determines we have enough info for SQL
			if (conversationalResponse.readyForSql) {
				this.logger.debug('Generating SQL...');
				// Agent 2: SQL Generation Agent
				const sqlResult = await this.sqlGenerationAgent(query, session);
				this.logger.debug(`SQL generated successfully, results count: ${sqlResult.count}`);

				// Generate final response combining conversation + SQL results
				const finalResponse = await this.generateFinalResponse(
					conversationalResponse.message,
					sqlResult,
					session,
				);

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
			const errorMessage = await this.generateErrorResponse(error.message, session);
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
	 * Get complete database schema for AI context
	 * @returns Complete database schema string
	 */
	private getCompleteDatabaseSchema(): string {
		return `
DATABASE SCHEMA - Trustay App (PostgreSQL):

MAIN TABLES:
- users (id, email, phone, password_hash, first_name, last_name, role: tenant|landlord, created_at, updated_at)
- buildings (id, slug, owner_id -> users.id, name, address_line_1, address_line_2, district_id, province_id, latitude, longitude, is_active, created_at, updated_at)
- rooms (id, slug, building_id -> buildings.id, floor_number, name, description, room_type: boarding_house|dormitory|sleepbox|apartment|whole_house, area_sqm, max_occupancy, total_rooms, view_count, is_active, created_at, updated_at)
- room_instances (id, room_id -> rooms.id, room_number, status: available|occupied|maintenance|reserved|unavailable, is_active, created_at, updated_at)
- rentals (id, room_instance_id -> room_instances.id, tenant_id -> users.id, owner_id -> users.id, contract_start_date, contract_end_date, monthly_rent, deposit_paid, status: active|terminated|expired|pending_renewal, created_at, updated_at)
- bills (id, rental_id -> rentals.id, room_instance_id -> room_instances.id, billing_period, billing_month, billing_year, period_start, period_end, subtotal, discount_amount, tax_amount, total_amount, status: draft|pending|paid|overdue|cancelled, due_date, created_at, updated_at)
- bill_items (id, bill_id -> bills.id, item_type, item_name, description, quantity, unit_price, amount, currency, created_at)
- payments (id, rental_id -> rentals.id, bill_id -> bills.id, payer_id -> users.id, payment_type: rent|deposit|utility|fee|refund, amount, currency, payment_method: bank_transfer|cash|e_wallet|card, payment_status: pending|completed|failed|refunded, payment_date, created_at, updated_at)
- room_bookings (id, room_id -> rooms.id, tenant_id -> users.id, move_in_date, move_out_date, rental_months, monthly_rent, deposit_amount, status: pending|accepted|rejected|expired|cancelled|awaiting_confirmation, created_at, updated_at)
- room_invitations (id, room_id -> rooms.id, sender_id -> users.id, recipient_id -> users.id, monthly_rent, deposit_amount, move_in_date, rental_months, status: pending|accepted|rejected|expired|cancelled|awaiting_confirmation, created_at, updated_at)
- notifications (id, user_id -> users.id, notification_type, title, message, data, is_read, read_at, expires_at, created_at)

ROOM DETAILS:
- room_images (id, room_id -> rooms.id, image_url, alt_text, sort_order, is_primary, created_at)
- room_amenities (id, room_id -> rooms.id, amenity_id -> amenities.id, custom_value, notes, created_at)
- room_costs (id, room_id -> rooms.id, cost_type_template_id -> cost_type_templates.id, cost_type: fixed|per_person|metered, currency, fixed_amount, per_person_amount, unit_price, unit, meter_reading, last_meter_reading, billing_cycle, included_in_rent, is_optional, notes, created_at, updated_at)
- room_pricing (id, room_id -> rooms.id, base_price_monthly, currency, deposit_amount, deposit_months, utility_included, utility_cost_monthly, cleaning_fee, service_fee_percentage, minimum_stay_months, maximum_stay_months, price_negotiable, created_at, updated_at)
- room_rules (id, room_id -> rooms.id, rule_template_id -> room_rule_templates.id, custom_value, is_enforced, notes, created_at)

REFERENCE TABLES:
- amenities (id, name, name_en, category: basic|kitchen|bathroom|entertainment|safety|connectivity|building, description, is_active, sort_order, created_at, updated_at)
- cost_type_templates (id, name, name_en, category: utility|service|parking|maintenance, default_unit, description, is_active, sort_order, created_at, updated_at)
- room_rule_templates (id, name, name_en, category: smoking|pets|visitors|noise|cleanliness|security|usage|other, rule_type: allowed|forbidden|required|conditional, description, is_active, sort_order, created_at, updated_at)

LOCATION TABLES:
- provinces (id, province_code, province_name, province_name_en, created_at, updated_at)
- districts (id, district_code, district_name, district_name_en, province_id -> provinces.id, created_at, updated_at)
- wards (id, ward_code, ward_name, ward_name_en, ward_level, district_id -> districts.id, created_at, updated_at)

ENUMS:
- UserRole: tenant, landlord
- RoomType: boarding_house, dormitory, sleepbox, apartment, whole_house
- RoomStatus: available, occupied, maintenance, reserved, unavailable
- RentalStatus: active, terminated, expired, pending_renewal
- BillStatus: draft, pending, paid, overdue, cancelled
- PaymentStatus: pending, completed, failed, refunded
- PaymentType: rent, deposit, utility, fee, refund
- PaymentMethod: bank_transfer, cash, e_wallet, card
- RequestStatus: pending, accepted, rejected, expired, cancelled, awaiting_confirmation
- AmenityCategory: basic, kitchen, bathroom, entertainment, safety, connectivity, building
- CostCategory: utility, service, parking, maintenance
- RuleCategory: smoking, pets, visitors, noise, cleanliness, security, usage, other
- RuleType: allowed, forbidden, required, conditional
- CostType: fixed, per_person, metered
- BillingCycle: daily, weekly, monthly, quarterly, yearly, per_use

IMPORTANT NOTES:
- rooms table does NOT have 'price' column - use room_pricing.base_price_monthly instead
- Use room_instances for specific room instances, rooms for room types
- All foreign key relationships use snake_case column names
- All timestamps are in snake_case (created_at, updated_at)
- Use proper JOIN syntax for related tables
- Always include LIMIT to prevent large result sets
`;
	}

	/**
	 * Validate user access to sensitive data
	 * @param userId - User ID
	 * @param query - User query to analyze
	 * @returns Validation result with access restrictions
	 */
	private async validateUserAccess(
		userId: string | undefined,
		query: string,
	): Promise<{
		hasAccess: boolean;
		userRole?: string;
		restrictions: string[];
	}> {
		if (!userId) {
			return {
				hasAccess: false,
				restrictions: ['Authentication required for sensitive data queries'],
			};
		}

		// Get user role
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		if (!user) {
			throw new ForbiddenException('User not found');
		}

		const restrictions: string[] = [];
		const queryLower = query.toLowerCase();

		// Define sensitive data patterns
		const sensitivePatterns = {
			bills: ['hóa đơn', 'bill', 'thanh toán', 'tiền thuê', 'doanh thu'],
			payments: ['payment', 'thanh toán', 'tiền', 'chuyển khoản'],
			rentals: ['thuê', 'rental', 'hợp đồng', 'contract'],
			personal: ['thông tin cá nhân', 'personal', 'private', 'riêng tư'],
		};

		// Check for sensitive data access
		Object.entries(sensitivePatterns).forEach(([category, patterns]) => {
			if (patterns.some((pattern) => queryLower.includes(pattern))) {
				restrictions.push(`${category} data access requires proper authorization`);
			}
		});

		return {
			hasAccess: true,
			userRole: user.role,
			restrictions,
		};
	}

	/**
	 * Generate user-specific WHERE clauses for SQL queries
	 * @param userId - User ID
	 * @param userRole - User role (tenant/landlord)
	 * @param query - User query
	 * @returns WHERE clauses to restrict data access
	 */
	private generateUserWhereClauses(userId: string, userRole: string, query: string): string {
		const queryLower = query.toLowerCase();
		const clauses: string[] = [];

		// Bills access - user can only see their own bills
		if (queryLower.includes('bill') || queryLower.includes('hóa đơn')) {
			if (userRole === 'tenant') {
				clauses.push(`rentals.tenant_id = '${userId}'`);
			} else if (userRole === 'landlord') {
				clauses.push(`rentals.owner_id = '${userId}'`);
			}
		}

		// Payments access - user can only see their own payments
		if (queryLower.includes('payment') || queryLower.includes('thanh toán')) {
			clauses.push(`payments.payer_id = '${userId}'`);
		}

		// Rentals access - user can only see their own rentals
		if (queryLower.includes('rental') || queryLower.includes('thuê')) {
			if (userRole === 'tenant') {
				clauses.push(`rentals.tenant_id = '${userId}'`);
			} else if (userRole === 'landlord') {
				clauses.push(`rentals.owner_id = '${userId}'`);
			}
		}

		// Buildings access - landlords can only see their own buildings
		if (queryLower.includes('building') || queryLower.includes('tòa nhà')) {
			if (userRole === 'landlord') {
				clauses.push(`buildings.owner_id = '${userId}'`);
			}
		}

		// Room bookings access - user can only see their own bookings
		if (queryLower.includes('booking') || queryLower.includes('đặt phòng')) {
			clauses.push(`room_bookings.tenant_id = '${userId}'`);
		}

		return clauses.length > 0 ? clauses.join(' AND ') : '';
	}

	/**
	 * Enhanced SQL prompt with user context and security
	 * @param query - User query
	 * @param schema - Database schema
	 * @param userId - User ID
	 * @param userRole - User role
	 * @param lastError - Previous error
	 * @param attempt - Current attempt
	 * @returns Enhanced prompt with security context
	 */
	private buildSecureSqlPrompt(
		query: string,
		schema: string,
		userId: string,
		userRole: string,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax
- Include proper WHERE clauses for user authorization

`
			: '';

		const userWhereClauses = this.generateUserWhereClauses(userId, userRole, query);
		const securityContext = userWhereClauses
			? `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- MANDATORY WHERE clauses: ${userWhereClauses}
- ALWAYS include these WHERE clauses to ensure user can only access their own data
- For sensitive data (bills, payments, rentals), user can ONLY see their own records

`
			: '';

		return `
Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Dựa vào schema database, ngữ cảnh người dùng và câu hỏi, hãy tạo câu lệnh SQL chính xác và AN TOÀN.

${schema}

${securityContext}${errorContext}Câu hỏi người dùng: "${query}"

QUY TẮC BẢO MẬT:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${this.AI_CONFIG.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng
8. QUAN TRỌNG: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
9. Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role

SQL:`;
	}

	/**
	 * Build SQL generation prompt with error context (for anonymous users)
	 * @param query - User query
	 * @param schema - Database schema
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted prompt
	 */
	private buildSqlPrompt(
		query: string,
		schema: string,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax

`
			: '';

		return `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào schema database và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${schema}

${errorContext}Câu hỏi người dùng: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${this.AI_CONFIG.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng

SQL:`;
	}

	/**
	 * Legacy method for backward compatibility with retry logic and security
	 * @param query - User query
	 * @param userId - Optional user ID for authorization
	 * @returns SQL execution result
	 */
	async generateAndExecuteSql(query: string, userId?: string) {
		// Step 1: Validate query intent
		const validation = await this.validateQueryIntent(query);
		if (!validation.isValid) {
			throw new Error(
				`Query not suitable for database querying: ${validation.reason || 'Invalid query intent'}`,
			);
		}

		// Step 2: Validate user access for sensitive data
		const accessValidation = await this.validateUserAccess(userId, query);
		if (!accessValidation.hasAccess) {
			throw new ForbiddenException(accessValidation.restrictions.join('; '));
		}

		const dbSchema = this.getCompleteDatabaseSchema();
		let lastError: string = '';
		let attempts = 0;
		const maxAttempts = 5;

		while (attempts < maxAttempts) {
			attempts++;

			try {
				// Use secure prompt if user is authenticated
				const prompt =
					userId && accessValidation.userRole
						? this.buildSecureSqlPrompt(
								query,
								dbSchema,
								userId,
								accessValidation.userRole,
								lastError,
								attempts,
							)
						: this.buildSqlPrompt(query, dbSchema, lastError, attempts);

				// Step 3: Generate SQL using AI SDK
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

				// Additional security check - ensure user-specific WHERE clauses are present for sensitive data
				if (userId && accessValidation.restrictions.length > 0) {
					const hasUserRestriction = accessValidation.restrictions.some((restriction) => {
						if (restriction.includes('bills')) {
							return sqlLower.includes('tenant_id') || sqlLower.includes('owner_id');
						}
						if (restriction.includes('payments')) {
							return sqlLower.includes('payer_id');
						}
						if (restriction.includes('rentals')) {
							return sqlLower.includes('tenant_id') || sqlLower.includes('owner_id');
						}
						return false;
					});

					if (!hasUserRestriction) {
						throw new Error(
							'Security violation: Query must include user-specific WHERE clauses for sensitive data',
						);
					}
				}

				// Step 4: Execute the SQL query
				const results = await this.prisma.$queryRawUnsafe(sql);

				// Convert BigInt to string for JSON serialization
				const serializedResults = this.serializeBigInt(results);

				return {
					query,
					sql,
					results: serializedResults,
					count: Array.isArray(serializedResults) ? serializedResults.length : 1,
					config: this.AI_CONFIG,
					timestamp: new Date().toISOString(),
					validation: validation,
					attempts: attempts,
					userId: userId,
					userRole: accessValidation.userRole,
				};
			} catch (error) {
				lastError = error.message;
				this.logger.warn(`SQL generation attempt ${attempts} failed: ${lastError}`);

				if (attempts >= maxAttempts) {
					throw new Error(
						`Failed to generate valid SQL after ${maxAttempts} attempts. Last error: ${lastError}`,
					);
				}

				// Wait a bit before retry
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
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
	): Promise<{
		isValid: boolean;
		reason?: string;
		needsClarification?: boolean;
		needsIntroduction?: boolean;
		clarificationQuestion?: string;
	}> {
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

Hãy đánh giá câu hỏi này và phân loại:

PHÂN LOẠI:
1. VALID - Câu hỏi có thể tạo SQL ngay (ƯU TIÊN CAO)
2. NEEDS_CLARIFICATION - CHỈ khi hoàn toàn không hiểu ý định
3. INVALID - Câu hỏi không liên quan hoặc không thể xử lý

DỮ LIỆU CÓ SẴN:
- users: thông tin người dùng (tenant/landlord, email, phone, tên, ngày tạo)
- buildings: tòa nhà (tên, địa chỉ, chủ sở hữu)
- rooms: phòng (tên, giá, diện tích, loại phòng, trạng thái)
- rentals: hợp đồng thuê (tenant, owner, trạng thái, ngày bắt đầu/kết thúc)
- bills: hóa đơn (số tiền, trạng thái thanh toán, hạn thanh toán)
- payments: thanh toán (số tiền, phương thức, trạng thái)
- room_bookings: đặt phòng (trạng thái: pending/approved/rejected)
- notifications: thông báo (tiêu đề, nội dung, đã đọc)

NGUYÊN TẮC QUAN TRỌNG:
- ƯU TIÊN VALID khi có thể suy đoán được ý định
- Với ngữ cảnh hội thoại, câu hỏi tiếp theo như "còn gì khác?", "thế còn..." → VALID
- CHỈ NEEDS_CLARIFICATION khi hoàn toàn không hiểu ý định

TIÊU CHÍ:
- VALID: Câu hỏi về dữ liệu, có thể suy đoán ý định (kể cả với ngữ cảnh)
- NEEDS_CLARIFICATION: CHỈ khi hoàn toàn không hiểu ý định
- INVALID: Chào hỏi (trừ tin nhắn đầu tiên), yêu cầu thao tác (tạo/sửa/xóa), không liên quan

Trả về CHÍNH XÁC theo format:
CLASSIFICATION: VALID/NEEDS_CLARIFICATION/INVALID
CLARIFICATION_QUESTION: [nếu NEEDS_CLARIFICATION, đưa ra câu hỏi cụ thể để làm rõ]
REASON: [lý do nếu INVALID]`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: contextualPrompt,
				temperature: 0.1,
				maxOutputTokens: 300,
			});

			const response = text.trim();

			if (response.includes('CLASSIFICATION: VALID')) {
				return { isValid: true };
			}

			if (response.includes('CLASSIFICATION: NEEDS_INTRODUCTION')) {
				return {
					isValid: false,
					needsClarification: false,
					needsIntroduction: true,
				};
			}

			if (response.includes('CLASSIFICATION: NEEDS_CLARIFICATION')) {
				const clarificationMatch = response.match(/CLARIFICATION_QUESTION: (.+)/);
				const clarificationQuestion = clarificationMatch
					? clarificationMatch[1].trim()
					: 'Bạn có thể cung cấp thêm thông tin cụ thể để tôi có thể giúp bạn tốt hơn?';

				return {
					isValid: false,
					needsClarification: true,
					clarificationQuestion,
				};
			}

			// INVALID case
			const reasonMatch = response.match(/REASON: (.+)/);
			const reason = reasonMatch ? reasonMatch[1].trim() : 'Câu hỏi không phù hợp';

			return {
				isValid: false,
				needsClarification: false,
				reason,
			};
		} catch {
			// If validation fails, default to allowing the query
			return { isValid: true };
		}
	}

	/**
	 * Generate AI introduction and feature showcase for first-time or vague queries
	 * @param query - User query that triggered introduction
	 * @param session - Chat session for context
	 * @returns AI introduction with capabilities and examples
	 */
	private async generateAIIntroduction(query: string, session: ChatSession): Promise<string> {
		const isFirstMessage = session.messages.filter((m) => m.role === 'user').length <= 1;

		const introPrompt = `
Bạn là AI assistant thông minh cho hệ thống quản lý thuê phòng Trustay. Người dùng vừa hỏi một câu hỏi chung chung.

Câu hỏi: "${query}"
Là tin nhắn đầu tiên: ${isFirstMessage}

Hãy tạo lời giới thiệu về khả năng của AI:

1. CHÀO MỪNG (nếu là tin nhắn đầu tiên)
2. GIỚI THIỆU KHẢ NĂNG CỦA AI
3. CÁC LOẠI CÂU HỎI CÓ THỂ TRẢ LỜI
4. VÍ DỤ CÂU HỎI CỤ THỂ (3-4 ví dụ)
5. LỜI MỜI THÂN THIỆN

KHẢ NĂNG CỦA AI:
- Truy vấn và phân tích dữ liệu phòng trọ
- Thống kê và báo cáo theo yêu cầu
- Tìm kiếm thông tin cụ thể
- Phân tích xu hướng và so sánh

DỮ LIỆU CÓ SẴN:
- Phòng trọ: 245+ phòng với thông tin giá, diện tích, loại, trạng thái
- Người dùng: tenant, landlord, thông tin liên hệ
- Hóa đơn & thanh toán: trạng thái, số tiền, thời hạn
- Hợp đồng thuê: active, terminated, thời gian
- Đặt phòng: pending, approved, rejected

Tạo lời giới thiệu thân thiện, hấp dẫn, sử dụng tiếng Việt:`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: introPrompt,
				temperature: 0.4, // Slightly higher for more engaging tone
				maxOutputTokens: 400,
			});

			return text.trim();
		} catch {
			// Fallback introduction
			return this.getDefaultAIIntroduction(isFirstMessage);
		}
	}

	/**
	 * Get default AI introduction when generation fails
	 * @param isFirstMessage - Whether this is the first message
	 * @returns Default introduction text
	 */
	private getDefaultAIIntroduction(isFirstMessage: boolean): string {
		if (isFirstMessage) {
			return `Xin chào! 👋 Tôi là AI Assistant của Trustay, rất vui được hỗ trợ bạn!

Tôi có thể giúp bạn tìm hiểu và phân tích dữ liệu về:
• Phòng trọ và tình trạng cho thuê
• Thống kê doanh thu và thanh toán  
• Thông tin người dùng và chủ nhà
• Báo cáo và xu hướng thị trường

Ví dụ bạn có thể hỏi tôi:
"Có bao nhiêu phòng trống hiện tại?" hoặc "Thống kê doanh thu tháng này"

Bạn muốn tìm hiểu điều gì về dữ liệu Trustay? 😊`;
		} else {
			return `Tôi có thể giúp bạn phân tích dữ liệu Trustay! 

Hãy thử hỏi tôi về:
• Tình trạng phòng trọ
• Thống kê doanh thu
• Thông tin người dùng
• Báo cáo chi tiết

Bạn muốn xem thông tin gì cụ thể? 🤔`;
		}
	}

	/**
	 * Generate friendly rejection message for invalid queries
	 * @param query - User query that was invalid
	 * @param reason - Reason for rejection
	 * @param session - Chat session for context
	 * @returns Friendly rejection message
	 */
	private async generateFriendlyRejection(
		query: string,
		reason?: string,
		session?: ChatSession,
	): Promise<string> {
		const recentMessages = session?.messages
			.filter((m) => m.role !== 'system')
			.slice(-2)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const rejectionPrompt = `
Bạn là AI assistant thân thiện của Trustay. Người dùng vừa hỏi một câu hỏi không phù hợp với khả năng của bạn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

Câu hỏi: "${query}"
Lý do không phù hợp: ${reason || 'Không liên quan đến dữ liệu'}

Hãy tạo câu trả lời:
1. Thân thiện, lịch sự, không cứng nhắc
2. Giải thích nhẹ nhàng tại sao không thể trả lời
3. Hướng dẫn người dùng về những gì bạn có thể làm
4. Đưa ra 2-3 ví dụ câu hỏi cụ thể
5. Kết thúc bằng lời mời thân thiện

KHẢ NĂNG CỦA BẠN:
- Phân tích dữ liệu phòng trọ, người dùng, hóa đơn
- Thống kê và báo cáo
- Tìm kiếm thông tin cụ thể

Câu trả lời thân thiện:`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: rejectionPrompt,
				temperature: 0.4,
				maxOutputTokens: 250,
			});

			return text.trim();
		} catch {
			// Fallback friendly rejection
			return `Xin lỗi, tôi chưa thể trả lời câu hỏi này được. 😅

Tôi chuyên về phân tích dữ liệu Trustay như:
• Thông tin phòng trọ và tình trạng
• Thống kê doanh thu và thanh toán
• Báo cáo về người dùng

Bạn có thể thử hỏi: "Có bao nhiêu phòng trống?" hoặc "Doanh thu tháng này là bao nhiêu?"

Bạn muốn tìm hiểu điều gì khác không? 🤔`;
		}
	}

	/**
	 * Generate smart clarification questions based on query context
	 * @param query - User query that needs clarification
	 * @param session - Chat session for context
	 * @returns Smart clarification question
	 */
	private async generateSmartClarification(query: string, session: ChatSession): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const clarificationPrompt = `
Bạn là AI assistant thân thiện của Trustay. Người dùng hỏi câu hỏi liên quan đến dữ liệu nhưng cần làm rõ thêm.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

Câu hỏi cần làm rõ: "${query}"

Hãy tạo câu trả lời thân thiện:
1. Thể hiện sự hiểu biết về ý định của người dùng
2. Hỏi lại một cách tự nhiên, không cứng nhắc
3. Đưa ra 2-3 lựa chọn cụ thể với ví dụ
4. Sử dụng emoji phù hợp
5. Kết thúc bằng câu hỏi mở

Câu trả lời thân thiện:`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: clarificationPrompt,
				temperature: 0.3,
				maxOutputTokens: 150,
			});

			return text.trim();
		} catch {
			// Fallback clarification
			return `Tôi hiểu bạn muốn tìm hiểu thông tin, nhưng có thể bạn cụ thể hơn được không? 😊

Ví dụ bạn có thể hỏi về:
• Thống kê phòng trọ (số lượng, trạng thái, giá cả)
• Thông tin người dùng (tenant, landlord)  
• Dữ liệu hóa đơn và thanh toán

Bạn muốn xem thông tin gì cụ thể nhất? 🤔`;
		}
	}

	/**
	 * Build secure contextual SQL prompt with conversation history, user context and security
	 * @param query - User query
	 * @param schema - Database schema
	 * @param recentMessages - Recent conversation messages
	 * @param userId - User ID
	 * @param userRole - User role
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted secure contextual prompt
	 */
	private buildSecureContextualSqlPrompt(
		query: string,
		schema: string,
		recentMessages: string,
		userId: string,
		userRole: string,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax
- Include proper WHERE clauses for user authorization

`
			: '';

		const userWhereClauses = this.generateUserWhereClauses(userId, userRole, query);
		const securityContext = userWhereClauses
			? `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- MANDATORY WHERE clauses: ${userWhereClauses}
- ALWAYS include these WHERE clauses to ensure user can only access their own data
- For sensitive data (bills, payments, rentals), user can ONLY see their own records

`
			: '';

		return `
Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Dựa vào schema database, ngữ cảnh hội thoại, ngữ cảnh người dùng và câu hỏi, hãy tạo câu lệnh SQL chính xác và AN TOÀN.

${schema}

${securityContext}${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC BẢO MẬT:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${this.AI_CONFIG.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng
8. QUAN TRỌNG: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
9. Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role
10. Xem xét ngữ cảnh hội thoại để hiểu rõ ý định người dùng

SQL:`;
	}

	/**
	 * Build contextual SQL prompt with conversation history and error context
	 * @param query - User query
	 * @param schema - Database schema
	 * @param recentMessages - Recent conversation messages
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted contextual prompt
	 */
	private buildContextualSqlPrompt(
		query: string,
		schema: string,
		recentMessages: string,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax

`
			: '';

		return `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào schema database, ngữ cảnh hội thoại và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${schema}

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${this.AI_CONFIG.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng

SQL:`;
	}

	/**
	 * Generate and execute SQL with conversation context, retry logic and security
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

		// Extract user ID from session
		const userId = session.userId;

		// Validate user access for sensitive data
		const accessValidation = await this.validateUserAccess(userId, query);
		if (!accessValidation.hasAccess) {
			throw new ForbiddenException(accessValidation.restrictions.join('; '));
		}

		const dbSchema = this.getCompleteDatabaseSchema();
		let lastError: string = '';
		let attempts = 0;
		const maxAttempts = 5;

		while (attempts < maxAttempts) {
			attempts++;

			try {
				// Use secure contextual prompt if user is authenticated
				const contextualPrompt =
					userId && accessValidation.userRole
						? this.buildSecureContextualSqlPrompt(
								query,
								dbSchema,
								recentMessages,
								userId,
								accessValidation.userRole,
								lastError,
								attempts,
							)
						: this.buildContextualSqlPrompt(query, dbSchema, recentMessages, lastError, attempts);

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

				// Additional security check for authenticated users
				if (userId && accessValidation.restrictions.length > 0) {
					const hasUserRestriction = accessValidation.restrictions.some((restriction) => {
						if (restriction.includes('bills')) {
							return sqlLower.includes('tenant_id') || sqlLower.includes('owner_id');
						}
						if (restriction.includes('payments')) {
							return sqlLower.includes('payer_id');
						}
						if (restriction.includes('rentals')) {
							return sqlLower.includes('tenant_id') || sqlLower.includes('owner_id');
						}
						return false;
					});

					if (!hasUserRestriction) {
						throw new Error(
							'Security violation: Query must include user-specific WHERE clauses for sensitive data',
						);
					}
				}

				// Execute the SQL query
				const results = await this.prisma.$queryRawUnsafe(sql);

				// Convert BigInt to string for JSON serialization
				const serializedResults = this.serializeBigInt(results);

				return {
					sql,
					results: serializedResults,
					count: Array.isArray(serializedResults) ? serializedResults.length : 1,
					attempts: attempts,
					userId: userId,
					userRole: accessValidation.userRole,
				};
			} catch (error) {
				lastError = error.message;
				this.logger.warn(`Contextual SQL generation attempt ${attempts} failed: ${lastError}`);

				if (attempts >= maxAttempts) {
					throw new Error(
						`Failed to generate valid SQL after ${maxAttempts} attempts. Last error: ${lastError}`,
					);
				}

				// Wait a bit before retry
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
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

	// ===== MULTI-AGENT FLOW METHODS =====

	/**
	 * Agent 1: Conversational Agent - Handles natural conversation and determines readiness for SQL
	 * @param query - User query
	 * @param session - Chat session for context
	 * @returns Conversational response with readiness indicator
	 */
	private async conversationalAgent(
		query: string,
		session: ChatSession,
	): Promise<{
		message: string;
		readyForSql: boolean;
		needsClarification?: boolean;
		needsIntroduction?: boolean;
	}> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-4)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const isFirstMessage = session.messages.filter((m) => m.role === 'user').length <= 1;

		const conversationalPrompt = `
Bạn là AI Agent 1 - Conversational Agent của hệ thống Trustay. Nhiệm vụ của bạn là:
1. Trò chuyện tự nhiên với người dùng
2. Xác định xem có đủ thông tin để tạo SQL query không
3. CHỈ hỏi thông tin THỰC SỰ CẦN THIẾT - không hỏi quá nhiều

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

Câu hỏi hiện tại: "${query}"
Là tin nhắn đầu tiên: ${isFirstMessage}

DỮ LIỆU CÓ SẴN TRONG HỆ THỐNG:
- users: thông tin người dùng (tenant/landlord, email, phone, tên, ngày tạo)
- buildings: tòa nhà (tên, địa chỉ, chủ sở hữu)
- rooms: phòng (tên, giá, diện tích, loại phòng, trạng thái)
- rentals: hợp đồng thuê (tenant, owner, trạng thái, ngày bắt đầu/kết thúc)
- bills: hóa đơn (số tiền, trạng thái thanh toán, hạn thanh toán)
- payments: thanh toán (số tiền, phương thức, trạng thái)
- room_bookings: đặt phòng (trạng thái: pending/approved/rejected)
- notifications: thông báo (tiêu đề, nội dung, đã đọc)

NGUYÊN TẮC QUAN TRỌNG:
- ƯU TIÊN READY_FOR_SQL khi có thể suy đoán được ý định
- CHỈ hỏi thêm khi THỰC SỰ CẦN THIẾT để tạo SQL
- Với câu hỏi tìm phòng: "giá rẻ", "quận 1", "phòng trọ" → READY_FOR_SQL ngay
- Với câu hỏi thống kê: "doanh thu", "thống kê" → có thể READY_FOR_SQL
- CHỈ NEEDS_CLARIFICATION khi hoàn toàn không hiểu ý định

HÃY PHÂN TÍCH VÀ TRẢ LỜI:

1. PHÂN LOẠI TÌNH HUỐNG:
   - GREETING: Lời chào, giới thiệu (chỉ tin nhắn đầu tiên)
   - READY_FOR_SQL: Câu hỏi có thể tạo SQL ngay (ưu tiên cao)
   - NEEDS_CLARIFICATION: Chỉ khi hoàn toàn không hiểu ý định
   - GENERAL_CHAT: Trò chuyện chung, không liên quan dữ liệu

2. TẠO CÂU TRẢ LỜI TỰ NHIÊN:
   - Thân thiện, như đang trò chuyện
   - Không cứng nhắc hay mang tính kỹ thuật
   - Sử dụng emoji phù hợp
   - CHỈ hỏi thêm khi THỰC SỰ CẦN THIẾT

Trả về theo format:
SITUATION: GREETING/READY_FOR_SQL/NEEDS_CLARIFICATION/GENERAL_CHAT
RESPONSE: [câu trả lời tự nhiên của bạn]`;

		try {
			this.logger.debug(`Generating conversational response for query: "${query}"`);

			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: conversationalPrompt,
				temperature: 0.4, // Higher for more natural conversation
				maxOutputTokens: 400,
			});

			const response = text.trim();
			this.logger.debug(`AI response: ${response.substring(0, 200)}...`);

			// Parse response
			const situationMatch = response.match(
				/SITUATION: (GREETING|READY_FOR_SQL|NEEDS_CLARIFICATION|GENERAL_CHAT)/,
			);
			const responseMatch = response.match(/RESPONSE: (.+)/s);

			const situation = situationMatch ? situationMatch[1] : 'GENERAL_CHAT';
			const message = responseMatch
				? responseMatch[1].trim()
				: this.getDefaultConversationalResponse(query, isFirstMessage);

			this.logger.debug(
				`Parsed situation: ${situation}, readyForSql: ${situation === 'READY_FOR_SQL'}`,
			);

			return {
				message,
				readyForSql: situation === 'READY_FOR_SQL',
				needsClarification: situation === 'NEEDS_CLARIFICATION',
				needsIntroduction: situation === 'GREETING',
			};
		} catch (error) {
			this.logger.error('Conversational agent error:', error);
			// Fallback conversational response
			return {
				message: this.getDefaultConversationalResponse(query, isFirstMessage),
				readyForSql: false,
				needsClarification: true,
			};
		}
	}

	/**
	 * Agent 2: SQL Generation Agent - Generates and executes SQL when ready
	 * @param query - User query
	 * @param session - Chat session for context
	 * @returns SQL execution result
	 */
	private async sqlGenerationAgent(
		query: string,
		session: ChatSession,
	): Promise<{
		sql: string;
		results: any;
		count: number;
	}> {
		// Use existing SQL generation logic with context
		return await this.generateAndExecuteSqlWithContext(query, session);
	}

	/**
	 * Generate final response combining conversational context with SQL results
	 * @param conversationalMessage - Message from conversational agent
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @returns Final combined response
	 */
	private async generateFinalResponse(
		conversationalMessage: string,
		sqlResult: { sql: string; results: any; count: number },
		session: ChatSession,
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		const finalPrompt = `
Bạn là AI assistant của Trustay. Hãy tạo câu trả lời cuối cùng kết hợp thông tin từ cuộc trò chuyện và kết quả truy vấn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

Thông điệp từ Agent hội thoại: "${conversationalMessage}"
Số kết quả tìm được: ${sqlResult.count}
Dữ liệu kết quả: ${JSON.stringify(sqlResult.results).substring(0, 800)}...

Hãy tạo câu trả lời:
1. Tự nhiên, như đang trò chuyện
2. Tóm tắt kết quả một cách dễ hiểu
3. Không hiển thị SQL query
4. Sử dụng tiếng Việt và emoji phù hợp
5. Nếu không có kết quả, đưa ra gợi ý hữu ích

Câu trả lời cuối cùng:`;

		try {
			const { text } = await generateText({
				model: google(this.AI_CONFIG.model),
				prompt: finalPrompt,
				temperature: 0.3,
				maxOutputTokens: 350,
			});

			return text.trim();
		} catch {
			// Fallback response
			if (sqlResult.count === 0) {
				return `Tôi đã tìm kiếm nhưng không thấy kết quả nào phù hợp. Bạn có thể thử hỏi theo cách khác không? 🤔`;
			}
			return `Tôi đã tìm thấy ${sqlResult.count} kết quả cho bạn! 😊`;
		}
	}

	/**
	 * Serialize BigInt values to strings for JSON compatibility
	 * @param data - Data that may contain BigInt values
	 * @returns Serialized data with BigInt converted to strings
	 */
	private serializeBigInt(data: any): any {
		if (data === null || data === undefined) {
			return data;
		}

		if (typeof data === 'bigint') {
			return data.toString();
		}

		if (Array.isArray(data)) {
			return data.map((item) => this.serializeBigInt(item));
		}

		if (typeof data === 'object') {
			const serialized: any = {};
			for (const [key, value] of Object.entries(data)) {
				serialized[key] = this.serializeBigInt(value);
			}
			return serialized;
		}

		return data;
	}

	/**
	 * Generate error response in conversational style
	 * @param errorMessage - Technical error message
	 * @param session - Chat session for context
	 * @returns User-friendly error response
	 */
	private async generateErrorResponse(
		errorMessage: string,
		_session: ChatSession,
	): Promise<string> {
		// Simple, direct error response without AI generation to avoid loops
		if (errorMessage.includes('Authentication required')) {
			return `Bạn cần đăng nhập để truy cập thông tin này. Vui lòng đăng nhập và thử lại. 🔐`;
		}

		if (errorMessage.includes('Security violation')) {
			return `Tôi không thể truy cập thông tin này vì lý do bảo mật. Vui lòng kiểm tra quyền truy cập của bạn. 🛡️`;
		}

		if (errorMessage.includes('Failed to generate valid SQL')) {
			return `Tôi gặp khó khăn trong việc tìm kiếm thông tin. Bạn có thể thử hỏi theo cách khác không? 🔍`;
		}

		// Default error response
		return `Xin lỗi, tôi gặp một chút trục trặc. Bạn có thể thử hỏi lại được không? 😅`;
	}

	/**
	 * Get default conversational response when AI generation fails
	 * @param query - User query
	 * @param isFirstMessage - Whether this is the first message
	 * @returns Default conversational response
	 */
	private getDefaultConversationalResponse(_query: string, isFirstMessage: boolean): string {
		if (isFirstMessage) {
			return `Xin chào! 👋 Tôi là AI Assistant của Trustay, rất vui được trò chuyện với bạn!

Tôi có thể giúp bạn tìm hiểu về dữ liệu phòng trọ, thống kê doanh thu, thông tin người dùng và nhiều thứ khác.

Bạn muốn tìm hiểu điều gì? 😊`;
		}

		// Với tin nhắn tiếp theo, ưu tiên tạo SQL thay vì hỏi thêm
		return `Tôi sẽ tìm kiếm thông tin cho bạn ngay! 🔍`;
	}
}
