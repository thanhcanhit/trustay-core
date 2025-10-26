import { google } from '@ai-sdk/google';
import { Injectable } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
	// AI Constants
	private readonly AI_CONFIG = {
		temperature: 0.1,
		maxTokens: 500,
		limit: 100,
		model: 'gemini-2.0-flash',
	};

	constructor(private readonly prisma: PrismaService) {}

	async generateAndExecuteSql(query: string) {
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
			// Generate SQL using AI SDK
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

			// Execute the SQL query
			const results = await this.prisma.$queryRawUnsafe(sql);

			return {
				query,
				sql,
				results,
				count: Array.isArray(results) ? results.length : 1,
				config: this.AI_CONFIG,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			throw new Error(`Failed to generate or execute SQL: ${error.message}`);
		}
	}
}
