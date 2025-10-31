import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { ChatSession, SqlGenerationResult } from '../types/chat.types';

/**
 * Response Generator - Generates human-friendly responses from SQL results
 */
export class ResponseGenerator {
	private readonly logger = new Logger(ResponseGenerator.name);

	/**
	 * Generate final response combining conversational context with SQL results
	 * @param conversationalMessage - Message from conversational agent
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Final combined response
	 */
	async generateFinalResponse(
		conversationalMessage: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const finalPrompt = `
Bạn là AI assistant của Trustay. Hãy tạo câu trả lời cuối cùng kết hợp thông tin từ cuộc trò chuyện và kết quả truy vấn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

THÔNG ĐIỆP TỪ AGENT HỘI THOẠI: "${conversationalMessage}"
SỐ KẾT QUẢ: ${sqlResult.count}
DỮ LIỆU (rút gọn): ${JSON.stringify(sqlResult.results).substring(0, 800)}...

YÊU CẦU ĐỊNH DẠNG:
- Viết bằng tiếng Việt tự nhiên, thân thiện, ấm áp (không cụt lủn).
- Mở đầu bằng 1-2 câu ngắn gọn, hữu ích (không dùng các từ đơn như "Tuyệt vời", "OK").
- Không dùng tiêu đề lớn hay ký tự #.
- Không hiển thị SQL query.
- Nếu không có kết quả, đưa ra gợi ý hữu ích.
- Trả về nội dung ở dạng Markdown an toàn (không HTML).

Câu trả lời cuối cùng:`;
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: finalPrompt,
				temperature: 0.3,
				maxOutputTokens: 350,
			});
			return text.trim();
		} catch {
			if (sqlResult.count === 0) {
				return `Tôi đã tìm kiếm nhưng không thấy kết quả nào phù hợp. Bạn có thể thử hỏi theo cách khác không? 🤔`;
			}
			return `Tôi đã tìm thấy ${sqlResult.count} kết quả cho bạn! 😊`;
		}
	}

	/**
	 * Generate friendly response from SQL results
	 * @param query - Original user query
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Human-friendly response
	 */
	async generateFriendlyResponse(
		query: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const responsePrompt = `
Bạn là AI assistant thân thiện cho ứng dụng Trustay. Hãy tạo câu trả lời dễ hiểu cho người dùng.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

CÂU HỎI NGƯỜI DÙNG: "${query}"
SỐ KẾT QUẢ: ${sqlResult.count}
DỮ LIỆU (rút gọn): ${JSON.stringify(sqlResult.results).substring(0, 1000)}...

YÊU CẦU ĐỊNH DẠNG:
- Viết bằng tiếng Việt tự nhiên, thân thiện, ấm áp (không cụt lủn).
- Mở đầu bằng 1-2 câu ngắn gọn, hữu ích; tránh các từ đơn như "Tuyệt vời", "OK".
- Không dùng tiêu đề lớn hay ký tự #.
- Không hiển thị SQL query.
- Nếu không có kết quả, đưa ra gợi ý hữu ích.
- Trả về nội dung ở dạng Markdown an toàn (không HTML).
- Tóm tắt mô tả về kết quả trả về, đưa ra các insights về kết quả trả về.

Câu trả lời:`;
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: responsePrompt,
				temperature: 0.3,
				maxOutputTokens: 300,
			});
			return text.trim();
		} catch {
			if (sqlResult.count === 0) {
				return `Tôi không tìm thấy kết quả nào cho câu hỏi "${query}". Bạn có thể thử hỏi theo cách khác không?`;
			}
			return `Tôi đã tìm thấy ${sqlResult.count} kết quả cho câu hỏi của bạn về "${query}".`;
		}
	}
}
