/**
 * Prompt templates for ResultValidatorAgent
 */

import { RequestType } from '../types/chat.types';

export interface ResultValidatorPromptParams {
	query: string;
	sql: string;
	resultsCount: number;
	resultsPreview: string;
	expectedType: RequestType;
}

export function buildResultValidatorPrompt(params: ResultValidatorPromptParams): string {
	const { query, sql, resultsCount, resultsPreview, expectedType } = params;

	return `
Bạn là AI Agent 4 - Result Validator của hệ thống Trustay. Nhiệm vụ của bạn là đánh giá xem kết quả SQL có đáp ứng yêu cầu ban đầu của người dùng không.

CÂU HỎI NGƯỜI DÙNG: "${query}"
REQUEST TYPE: ${expectedType}
SQL ĐÃ SINH RA:
\`\`\`sql
${sql}
\`\`\`

KẾT QUẢ SQL:
- Số lượng kết quả: ${resultsCount}
- Dữ liệu (rút gọn): ${resultsPreview}

YÊU CẦU ĐÁNH GIÁ:

1. SO SÁNH YÊU CẦU VỚI SQL:
   - SQL có match với yêu cầu ban đầu không?
   - Có các filter/điều kiện phù hợp không?
   - Ví dụ: Nếu người dùng hỏi "phòng ở quận 1" nhưng SQL query "quận 2" → INVALID
   - Ví dụ: Nếu người dùng hỏi "thống kê hóa đơn" nhưng SQL trả về danh sách phòng → INVALID

2. KIỂM TRA KẾT QUẢ:
   - Kết quả có hợp lý không? (ví dụ: tìm phòng quận 1 mà kết quả là quận 2 thì invalid)
   - Số lượng kết quả có phù hợp không?
   - Loại dữ liệu có đúng với yêu cầu không?
   - Ví dụ: Yêu cầu thống kê nhưng kết quả là danh sách chi tiết → INVALID
   - Ví dụ: Yêu cầu tìm phòng nhưng kết quả là hóa đơn → INVALID

3. QUYẾT ĐỊNH:
   - isValid: true nếu SQL và kết quả đều đúng với yêu cầu
   - isValid: false nếu SQL hoặc kết quả không đúng với yêu cầu
   - reason: Giải thích ngắn gọn nếu invalid (ví dụ: "SQL query sai quận", "Kết quả không đúng loại dữ liệu")

Trả về theo format:
IS_VALID: true/false
REASON: [lý do nếu invalid, hoặc "OK" nếu valid]`;
}
