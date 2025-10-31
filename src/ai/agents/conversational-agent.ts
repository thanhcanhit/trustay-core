import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { ChatSession, ConversationalAgentResponse } from '../types/chat.types';

/**
 * Agent 1: Conversational Agent - Handles natural conversation and determines readiness for SQL
 */
export class ConversationalAgent {
	private readonly logger = new Logger(ConversationalAgent.name);

	/**
	 * Process query and determine if ready for SQL generation
	 * @param query - User query
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Conversational response with readiness indicator
	 */
	async process(
		query: string,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<ConversationalAgentResponse> {
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

PHÂN LOẠI Ý ĐỊNH & QUY ĐỔI NGHIỆP VỤ:
- Nếu người dùng hỏi "có ai đang tìm phòng ...?" thì hiểu là tìm bài đăng tìm phòng (room seeking posts) từ phía chủ trọ, KHÔNG phải tìm danh sách phòng.
- Nếu người dùng hỏi "tìm phòng ..." thì hiểu là tìm rooms.
- Nếu người dùng hỏi "thống kê/hoá đơn/doanh thu..." thì hiểu là yêu cầu thống kê (aggregate). 

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
MODE_HINT: LIST/TABLE/CHART
ENTITY_HINT: room|post|room_seeking_post|none
FILTERS_HINT: [mô tả ngắn gọn filter nếu có, ví dụ: quận="gò vấp", giá<3tr]
RESPONSE: [câu trả lời tự nhiên của bạn]`;
		try {
			this.logger.debug(`Generating conversational response for query: "${query}"`);
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: conversationalPrompt,
				temperature: 0.4,
				maxOutputTokens: 400,
			});
			const response = text.trim();
			this.logger.debug(`AI response: ${response.substring(0, 200)}...`);
			const situationMatch = response.match(
				/SITUATION: (GREETING|READY_FOR_SQL|NEEDS_CLARIFICATION|GENERAL_CHAT)/,
			);
			const modeMatch = response.match(/MODE_HINT: (LIST|TABLE|CHART)/);
			const entityMatch = response.match(/ENTITY_HINT: (room|post|room_seeking_post|none)/);
			const filtersMatch = response.match(/FILTERS_HINT: (.+)/);
			const responseMatch = response.match(/RESPONSE: (.+)/s);
			const situation = situationMatch ? situationMatch[1] : 'GENERAL_CHAT';
			const message = responseMatch
				? responseMatch[1].trim()
				: this.getDefaultResponse(query, isFirstMessage);
			this.logger.debug(
				`Parsed situation: ${situation}, readyForSql: ${situation === 'READY_FOR_SQL'}`,
			);
			return {
				message,
				readyForSql: situation === 'READY_FOR_SQL',
				needsClarification: situation === 'NEEDS_CLARIFICATION',
				needsIntroduction: situation === 'GREETING',
				intentModeHint: modeMatch ? (modeMatch[1] as 'LIST' | 'TABLE' | 'CHART') : undefined,
				entityHint: entityMatch && entityMatch[1] !== 'none' ? (entityMatch[1] as any) : undefined,
				filtersHint: filtersMatch ? filtersMatch[1].trim() : undefined,
			};
		} catch (error) {
			this.logger.error('Conversational agent error:', error);
			return {
				message: this.getDefaultResponse(query, isFirstMessage),
				readyForSql: false,
				needsClarification: true,
			};
		}
	}

	/**
	 * Get default conversational response when AI generation fails
	 * @param query - User query
	 * @param isFirstMessage - Whether this is the first message
	 * @returns Default conversational response
	 */
	private getDefaultResponse(_query: string, isFirstMessage: boolean): string {
		if (isFirstMessage) {
			return `Xin chào! 👋 Tôi là AI Assistant của Trustay, rất vui được trò chuyện với bạn!

Tôi có thể giúp bạn tìm hiểu về dữ liệu phòng trọ, thống kê doanh thu, thông tin người dùng và nhiều thứ khác.

Bạn muốn tìm hiểu điều gì? 😊`;
		}
		return `Tôi sẽ tìm kiếm thông tin cho bạn ngay! 🔍`;
	}
}
