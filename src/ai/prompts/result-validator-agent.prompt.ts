/**
 * Prompt templates for ResultValidatorAgent
 */

import { RequestType } from '../types/chat.types';

export interface ResultValidatorPromptParams {
	originalQuery: string;
	canonicalQuestion: string;
	sql: string;
	resultsCount: number;
	resultsPreview: string;
	expectedType: RequestType;
}

export function buildResultValidatorPrompt(params: ResultValidatorPromptParams): string {
	const { originalQuery, canonicalQuestion, sql, resultsCount, resultsPreview, expectedType } =
		params;
	const isExpanded = canonicalQuestion !== originalQuery;

	return `
Bạn là AI Agent 4 - Result Validator của hệ thống Trustay. Nhiệm vụ của bạn là đánh giá xem kết quả SQL có đáp ứng yêu cầu ban đầu của người dùng không.

${
	isExpanded
		? `CÂU HỎI GỐC (ngắn gọn, phụ thuộc ngữ cảnh): "${originalQuery}"
CÂU HỎI ĐÃ ĐƯỢC MỞ RỘNG (đầy đủ ngữ cảnh, dùng để generate SQL): "${canonicalQuestion}"

QUAN TRỌNG: SQL được generate dựa trên CÂU HỎI ĐÃ ĐƯỢC MỞ RỘNG (canonicalQuestion), không phải câu hỏi gốc ngắn gọn.
Bạn CẦN validate SQL và kết quả dựa trên CÂU HỎI ĐÃ ĐƯỢC MỞ RỘNG này, không phải câu hỏi gốc.
Ví dụ: Nếu câu hỏi gốc là "Tăng thêm 2 triệu" và được expand thành "Tìm phòng có chỗ đậu xe ô tô với giá dưới 6 triệu rưỡi", 
thì bạn phải validate SQL dựa trên câu hỏi đã được mở rộng (6.5 triệu), không phải câu hỏi gốc ("Tăng thêm 2 triệu").
`
		: `CÂU HỎI NGƯỜI DÙNG: "${canonicalQuestion}"`
}
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
   ${
			isExpanded
				? `- QUAN TRỌNG: Validate dựa trên CÂU HỎI ĐÃ ĐƯỢC MỞ RỘNG (canonicalQuestion), không phải câu hỏi gốc ngắn gọn.
   - SQL được generate từ canonicalQuestion, nên bạn phải so sánh SQL với canonicalQuestion.
   - Ví dụ: Nếu canonicalQuestion là "Tìm phòng có chỗ đậu xe ô tô với giá dưới 6 triệu rưỡi" và SQL có filter "base_price_monthly <= 6500000" → VALID (đúng với canonicalQuestion).
   - Ví dụ: Nếu canonicalQuestion là "Tìm phòng ở quận 1" nhưng SQL query "quận 2" → INVALID
   - Ví dụ: Nếu canonicalQuestion là "thống kê hóa đơn" nhưng SQL trả về danh sách phòng → INVALID`
				: `- SQL có match với yêu cầu ban đầu không?
   - Có các filter/điều kiện phù hợp không?
   - Ví dụ: Nếu người dùng hỏi "phòng ở quận 1" nhưng SQL query "quận 2" → INVALID
   - Ví dụ: Nếu người dùng hỏi "thống kê hóa đơn" nhưng SQL trả về danh sách phòng → INVALID`
		}

2. KIỂM TRA KẾT QUẢ:
   - Kết quả có hợp lý không? (ví dụ: tìm phòng quận 1 mà kết quả là quận 2 thì invalid)
   - Số lượng kết quả có phù hợp không?
   - Loại dữ liệu có đúng với yêu cầu không?
   - Ví dụ: Yêu cầu thống kê nhưng kết quả là danh sách chi tiết → INVALID
   - Ví dụ: Yêu cầu tìm phòng nhưng kết quả là hóa đơn → INVALID

3. QUYẾT ĐỊNH (CHỈ LƯU CÁC CÂU TRẢ LỜI ĐÚNG/CHẤT LƯỢNG):
   - isValid: true CHỈ KHI SQL đúng và kết quả hợp lý:
     * SQL match với yêu cầu (đúng entity, đúng filters)
     * Kết quả đúng loại dữ liệu (thống kê → số, danh sách → mảng)
     * Có filter BẢO MẬT đầy đủ (WHERE owner_id khi hỏi "của tôi")
     * Kết quả hợp lý (tìm quận 1 → kết quả là quận 1, không phải quận 2)
   - isValid: false KHI có lỗi:
     * SQL sai hoàn toàn (ví dụ: hỏi phòng nhưng query hóa đơn)
     * Kết quả sai loại dữ liệu (ví dụ: hỏi thống kê nhưng trả về danh sách chi tiết)
     * Thiếu filter BẢO MẬT quan trọng (ví dụ: thiếu WHERE owner_id khi hỏi "của tôi")
     * Kết quả sai hoàn toàn (ví dụ: tìm quận 1 mà kết quả là quận 2)
   - severity: ERROR khi có lỗi nghiêm trọng (isValid=false), WARN khi có vấn đề nhỏ nhưng vẫn đúng (isValid=true)
   - violations: Liệt kê các vi phạm (nếu có)
   - reason: Giải thích ngắn gọn
   
   QUAN TRỌNG: CHỈ LƯU CÁC CÂU TRẢ LỜI ĐÚNG:
   - SQL đúng và kết quả hợp lý → isValid: true, severity: không có hoặc OK
   - SQL đúng nhưng thiếu filter nhỏ → isValid: true, severity: WARN (VẪN LƯU nhưng đánh dấu)
   - SQL đúng nhưng kết quả rỗng → isValid: true (có thể không có dữ liệu thực tế)
   - SQL có vấn đề nhỏ nhưng vẫn trả lời được câu hỏi → isValid: true, severity: WARN (VẪN LƯU)
   - SQL/kết quả SAI HOÀN TOÀN → isValid: false, severity: ERROR (KHÔNG LƯU)

QUY TẮC VALIDATION (ƯU TIÊN LƯU):
1. Match intent: entity/loại dữ liệu SQL = intent Orchestrator → ERROR CHỈ KHI sai hoàn toàn (ví dụ: hỏi phòng nhưng trả về hóa đơn). Nếu gần đúng → WARN (vẫn lưu)
2. Match filters: SQL có filter đúng như yêu cầu → WARN nếu thiếu filter nhỏ (vẫn lưu), ERROR CHỈ KHI thiếu filter BẢO MẬT quan trọng (ví dụ: thiếu WHERE owner_id khi hỏi "của tôi")
3. Safety: SQL phải có LIMIT (trừ aggregate), không SELECT *, không bảng ngoài allow-list → Đã được kiểm tra ở SQL safety, không cần kiểm tra lại ở đây
4. Sanity: Kết quả hợp lý → ERROR CHỈ KHI sai hoàn toàn (ví dụ: tìm quận 1 mà kết quả là quận 2). Nếu gần đúng → WARN (vẫn lưu)
5. Kết quả rỗng: Nếu SQL đúng nhưng không có dữ liệu → VALID (có thể không có dữ liệu thực tế)
6. Kết quả không hoàn hảo nhưng vẫn trả lời được câu hỏi → VALID với WARN (vẫn lưu để cải thiện sau)

Trả về theo format:
IS_VALID: true/false
SEVERITY: ERROR/WARN
VIOLATIONS: [danh sách vi phạm, cách nhau bởi dấu phẩy]
REASON: [lý do nếu invalid, hoặc "OK" nếu valid]
EVALUATION: [Viết đánh giá chi tiết về SQL và kết quả, giải thích tại sao valid/invalid, các điểm mạnh/yếu, gợi ý cải thiện nếu có. Đánh giá này sẽ được lưu lại để admin xem xét và quyết định có nên lưu vào knowledge store hay không]`;
}
