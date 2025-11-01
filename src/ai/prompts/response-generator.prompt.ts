/**
 * Prompt templates for ResponseGenerator
 */

export interface FinalResponsePromptParams {
	recentMessages?: string;
	conversationalMessage: string;
	count: number;
	dataPreview: string;
	structuredData?: {
		list: any[] | null;
		table: any | null;
		chart: any | null;
	};
}

export function buildFinalResponsePrompt(params: FinalResponsePromptParams): string {
	const { recentMessages, conversationalMessage, count, dataPreview, structuredData } = params;

	const structuredDataSection = structuredData
		? `
DỮ LIỆU ĐÃ ĐƯỢC XỬ LÝ:
- LIST: ${structuredData.list !== null ? `${structuredData.list.length} items` : 'null'}
- TABLE: ${structuredData.table !== null ? 'có dữ liệu' : 'null'}
- CHART: ${structuredData.chart !== null ? 'có dữ liệu' : 'null'}

`
		: '';

	return `
Bạn là AI assistant của Trustay. Hãy tạo câu trả lời cuối cùng kết hợp thông tin từ cuộc trò chuyện và kết quả truy vấn.

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

THÔNG ĐIỆP TỪ ORCHESTRATOR AGENT: "${conversationalMessage}"
SỐ KẾT QUẢ: ${count}
DỮ LIỆU (rút gọn): ${dataPreview}
${structuredDataSection}

YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
1. Viết câu trả lời thân thiện bằng tiếng Việt tự nhiên, ấm áp (không cụt lủn).
2. Mở đầu bằng 1-2 câu ngắn gọn, hữu ích (không dùng các từ đơn như "Tuyệt vời", "OK").
3. Không dùng tiêu đề lớn hay ký tự #.
4. Không hiển thị SQL query.
5. Nếu không có kết quả, đưa ra gợi ý hữu ích.
6. Trả về nội dung ở dạng Markdown an toàn (không HTML).

7. SAU KHI VIẾT XONG CÂU TRẢ LỜI, BẮT BUỘC PHẢI:
   - Xuống dòng và viết: ---END
   - Xuống dòng tiếp theo và viết: LIST: ${structuredData?.list !== null ? JSON.stringify(structuredData.list) : 'null'}
   - Xuống dòng tiếp theo và viết: TABLE: ${structuredData?.table !== null ? JSON.stringify(structuredData.table) : 'null'}
   - Xuống dòng tiếp theo và viết: CHART: ${structuredData?.chart !== null ? JSON.stringify(structuredData.chart) : 'null'}

VÍ DỤ FORMAT ĐÚNG:
Đây là 5 phòng mới nhất ở gò vấp, tôi thấy căn Phòng trọ Lan Anh là phù hợp nhất đó
---END
LIST: [{"id":"123","title":"Phòng trọ Lan Anh","path":"/rooms/123",...}]
TABLE: null
CHART: null

Câu trả lời cuối cùng (NHỚ THÊM ---END VÀ DỮ LIỆU CUỐI):`;
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
