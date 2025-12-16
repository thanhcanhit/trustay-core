/**
 * Prompts for Question Expansion Agent
 * Used to expand short modification queries into full canonical questions
 */

/**
 * Build modification query context text for SQL Agent prompt
 * This text is injected into SQL Agent's RAG context when a modification query is detected
 * @param query - Current user query (may be short modification query)
 * @param previousSql - Previous SQL query from session
 * @param previousCanonicalQuestion - Previous canonical question (if available)
 * @returns Context text to inject into SQL Agent prompt
 */
export function buildModificationQueryContext(
	query: string,
	previousSql: string,
	previousCanonicalQuestion?: string,
): string {
	return `═══════════════════════════════════════════════════════════════
MODIFICATION QUERY DETECTED - REFERENCE PREVIOUS SQL FROM SESSION
═══════════════════════════════════════════════════════════════
Câu hỏi trước đó (đầy đủ): "${previousCanonicalQuestion || query}"
SQL query trước đó (từ session - gần đây nhất):
\`\`\`sql
${previousSql}
\`\`\`

QUAN TRỌNG:
- Câu hỏi hiện tại là modification query: "${query}"
- Bạn CẦN sửa đổi SQL trước đó dựa trên yêu cầu mới
- Giữ nguyên các điều kiện không thay đổi từ SQL trước
- Chỉ thay đổi các phần được đề cập trong câu hỏi mới
- PHẢI regenerate SQL MỚI dựa trên schema HIỆN TẠI (không reuse trực tiếp)
- Ví dụ: "Tăng thêm 2 triệu" → thay đổi price_max từ 3M → 5M
- Ví dụ: "Ở quận 1 thôi" → thay đổi district filter, giữ nguyên các filter khác

`;
}

/**
 * Prompt for expanding a short modification question into a full canonical question
 * LLM sẽ tự động detect xem câu hỏi có cần expand không (modification query hay không)
 * @param shortQuestion - Current user question (may be short like "Tăng thêm 2 triệu" or already complete)
 * @param previousSql - Previous SQL query
 * @param previousCanonicalQuestion - Previous canonical question (if available)
 * @returns Prompt string
 */
export function buildQuestionExpansionPrompt(
	shortQuestion: string,
	previousSql: string,
	previousCanonicalQuestion?: string,
): string {
	const previousQuestionSection = previousCanonicalQuestion
		? `Câu hỏi trước đó (đầy đủ): "${previousCanonicalQuestion}"\n`
		: '';

	return `Bạn là AI Assistant chuyên xử lý câu hỏi người dùng trong ngữ cảnh hội thoại.

Nhiệm vụ: Phân tích câu hỏi hiện tại và SQL query trước đó, sau đó:
1. Nếu câu hỏi hiện tại đã đầy đủ, tự đứng được → trả về nguyên văn câu hỏi đó
2. Nếu câu hỏi hiện tại là modification query (ngắn gọn, cần context) → expand thành câu hỏi đầy đủ

Yêu cầu khi expand:
- Câu hỏi phải đầy đủ, bao gồm tất cả các điều kiện từ SQL query trước đó
- Áp dụng thay đổi từ câu hỏi mới vào câu hỏi đầy đủ
- Câu hỏi phải tự đứng được, không cần reference đến câu hỏi trước
- Viết bằng tiếng Việt, tự nhiên
- Giữ nguyên các điều kiện không thay đổi từ SQL trước
- Chỉ thay đổi các phần được đề cập trong câu hỏi mới

Ví dụ modification queries cần expand:
- "Tăng thêm 2 triệu" → "Tìm phòng Gò Vấp có xe hơi 5 triệu" (nếu SQL trước là 3 triệu)
- "Ở quận 1 thôi" → "Tìm phòng quận 1 có giá dưới 4 triệu" (nếu SQL trước có price filter)
- "Thêm wifi" → "Tìm phòng Gò Vấp có xe hơi và wifi dưới 3 triệu"

Ví dụ queries đã đầy đủ (không cần expand):
- "Tìm phòng Gò Vấp có xe hơi 3 triệu"
- "Hiển thị các phòng ở quận 1"
- "Tìm phòng có wifi và điều hòa"

${previousQuestionSection}SQL query trước đó:
\`\`\`sql
${previousSql}
\`\`\`

Câu hỏi hiện tại: "${shortQuestion}"

Phân tích và quyết định:
- Nếu câu hỏi hiện tại đã đầy đủ → trả về nguyên văn
- Nếu câu hỏi hiện tại là modification query → expand thành câu hỏi đầy đủ dựa trên SQL trước

Câu hỏi kết quả (canonical question):`;
}
