/**
 * Prompts for Summary Agent
 * Used for generating chat session titles and rolling summaries
 */

/**
 * Prompt for generating a short title from first user message
 * @param firstUserMessage - First user message in the conversation
 * @returns Prompt string
 */
export function buildTitleGenerationPrompt(firstUserMessage: string): string {
	return `Bạn là một AI Assistant chuyên tạo tiêu đề mô tả cho các cuộc hội thoại.

Nhiệm vụ: Tạo một tiêu đề có ý nghĩa và đủ ngữ cảnh (8-15 từ hoặc 50-100 ký tự) mô tả nội dung chính của câu hỏi đầu tiên của người dùng.

Yêu cầu:
- Tiêu đề phải có đủ ngữ cảnh và ý nghĩa, không quá ngắn
- Độ dài: 8-15 từ hoặc 50-100 ký tự
- Viết bằng tiếng Việt
- Không có dấu chấm câu ở cuối
- Tập trung vào ý chính của câu hỏi nhưng phải đủ chi tiết để hiểu được ngữ cảnh
- Nếu có entity cụ thể (phòng, tòa nhà, địa điểm, v.v.), hãy bao gồm vào tiêu đề
- Nếu có action cụ thể (tìm kiếm, đăng phòng, xem thống kê, v.v.), hãy thể hiện rõ
- Nếu có điều kiện quan trọng (giá, địa điểm, loại phòng, v.v.), có thể đề cập ngắn gọn
- QUAN TRỌNG: Tiêu đề phải đầy đủ và hoàn chỉnh, KHÔNG được kết thúc bằng các từ không đầy đủ như "của", "và", "hoặc", "với", "cho", "từ", "đến", "trong", "ngoài", "theo", "về" mà không có object đi kèm
- Tiêu đề phải là một câu hoặc cụm từ hoàn chỉnh, có thể đứng độc lập và hiểu được nghĩa

Ví dụ tiêu đề tốt:
- "Tìm phòng trọ giá rẻ tại quận Gò Vấp"
- "Thống kê số lượng phòng trống theo quận"
- "Đăng phòng cho thuê tại tòa nhà ABC"
- "Xem danh sách phòng đang cho thuê ở Hà Nội"

Ví dụ tiêu đề quá ngắn hoặc không đầy đủ (KHÔNG NÊN):
- "Tìm phòng"
- "Thống kê"
- "Đăng phòng"
- "Hiển thị tỉ lệ nam nữ của" (thiếu object - của ai? của cái gì?)
- "Xem danh sách phòng tại" (thiếu địa điểm)
- "Thống kê số lượng phòng theo" (thiếu tiêu chí phân loại)

Câu hỏi đầu tiên của người dùng:
"${firstUserMessage}"

Tiêu đề:`;
}

/**
 * Prompt for generating rolling summary
 * Combines existing summary with new messages to create updated summary
 * @param existingSummary - Current summary (null if none exists)
 * @param oldMessages - Old messages that haven't been summarized yet
 * @returns Prompt string
 */
export function buildRollingSummaryPrompt(
	existingSummary: string | null,
	oldMessages: Array<{ role: string; content: string }>,
): string {
	const messagesText = oldMessages
		.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
		.join('\n\n');

	const summarySection = existingSummary
		? `Tóm tắt hiện tại của cuộc hội thoại:
"${existingSummary}"

`
		: '';

	return `Bạn là một AI Assistant chuyên tóm tắt các cuộc hội thoại dài để duy trì context.

Nhiệm vụ: Dựa trên tóm tắt hiện tại (nếu có) và đoạn hội thoại mới, hãy cập nhật lại bản tóm tắt các ý chính, entity, và intent của người dùng.

Yêu cầu:
- Giữ lại các thông tin quan trọng từ tóm tắt cũ (nếu có)
- Bổ sung thông tin mới từ đoạn hội thoại
- Tóm tắt phải súc tích, tập trung vào:
  * Ý định chính của người dùng
  * Các entity được đề cập (phòng, tòa nhà, người dùng, v.v.)
  * Các filter/điều kiện quan trọng (giá, địa điểm, v.v.)
  * SQL queries đã được sử dụng (nếu có trong metadata)
- Độ dài tối đa 200 từ
- Viết bằng tiếng Việt

${summarySection}Đoạn hội thoại mới cần được tóm tắt:
${messagesText}

Tóm tắt cập nhật:`;
}
