/**
 * Prompt templates for ResponseGenerator
 */

export interface FinalResponsePromptParams {
	recentMessages?: string;
	conversationalMessage: string;
	count: number;
	dataPreview: string;
}

export function buildFinalResponsePrompt(params: FinalResponsePromptParams): string {
	const { recentMessages, conversationalMessage, count, dataPreview } = params;
	return `
Bạn là AI assistant của Trustay. Hãy tạo câu trả lời cuối cùng kết hợp thông tin từ cuộc trò chuyện và kết quả truy vấn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

THÔNG ĐIỆP TỪ AGENT HỘI THOẠI: "${conversationalMessage}"
SỐ KẾT QUẢ: ${count}
DỮ LIỆU (rút gọn): ${dataPreview}

YÊU CẦU ĐỊNH DẠNG:
- Viết bằng tiếng Việt tự nhiên, thân thiện, ấm áp (không cụt lủn).
- Mở đầu bằng 1-2 câu ngắn gọn, hữu ích (không dùng các từ đơn như "Tuyệt vời", "OK").
- Không dùng tiêu đề lớn hay ký tự #.
- Không hiển thị SQL query.
- Nếu không có kết quả, đưa ra gợi ý hữu ích.
- Trả về nội dung ở dạng Markdown an toàn (không HTML).

Câu trả lời cuối cùng:`;
}

export interface FriendlyResponsePromptParams {
	recentMessages?: string;
	query: string;
	count: number;
	dataPreview: string;
}

export function buildFriendlyResponsePrompt(params: FriendlyResponsePromptParams): string {
	const { recentMessages, query, count, dataPreview } = params;
	return `
Bạn là AI assistant thân thiện cho ứng dụng Trustay. Hãy tạo câu trả lời dễ hiểu cho người dùng.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

CÂU HỎI NGƯỜI DÙNG: "${query}"
SỐ KẾT QUẢ: ${count}
DỮ LIỆU (rút gọn): ${dataPreview}

YÊU CẦU ĐỊNH DẠNG:
- Viết bằng tiếng Việt tự nhiên, thân thiện, ấm áp (không cụt lủn).
- Mở đầu bằng 1-2 câu ngắn gọn, hữu ích; tránh các từ đơn như "Tuyệt vời", "OK".
- Không dùng tiêu đề lớn hay ký tự #.
- Không hiển thị SQL query.
- Nếu không có kết quả, đưa ra gợi ý hữu ích.
- Trả về nội dung ở dạng Markdown an toàn (không HTML).
- Tóm tắt mô tả về kết quả trả về, đưa ra các insights về kết quả trả về.

Câu trả lời:`;
}

export function getNoResultsMessage(query?: string): string {
	if (query) {
		return `Tôi không tìm thấy kết quả nào cho câu hỏi "${query}". Bạn có thể thử hỏi theo cách khác không?`;
	}
	return `Tôi đã tìm kiếm nhưng không thấy kết quả nào phù hợp. Bạn có thể thử hỏi theo cách khác không? 🤔`;
}

export function getSuccessMessage(count: number, query?: string): string {
	if (query) {
		return `Tôi đã tìm thấy ${count} kết quả cho câu hỏi của bạn về "${query}".`;
	}
	return `Tôi đã tìm thấy ${count} kết quả cho bạn! 😊`;
}
