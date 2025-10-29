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
