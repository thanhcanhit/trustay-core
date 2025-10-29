/**
 * Error Handler - Generates user-friendly error responses
 */
export class ErrorHandler {
	/**
	 * Generate error response in conversational style
	 * @param errorMessage - Technical error message
	 * @returns User-friendly error response
	 */
	static generateErrorResponse(errorMessage: string): string {
		if (errorMessage.includes('Authentication required')) {
			return `Bạn cần đăng nhập để truy cập thông tin này. Vui lòng đăng nhập và thử lại. 🔐`;
		}
		if (errorMessage.includes('Security violation')) {
			return `Tôi không thể truy cập thông tin này vì lý do bảo mật. Vui lòng kiểm tra quyền truy cập của bạn. 🛡️`;
		}
		if (errorMessage.includes('Failed to generate valid SQL')) {
			return `Tôi gặp khó khăn trong việc tìm kiếm thông tin. Bạn có thể thử hỏi theo cách khác không? 🔍`;
		}
		return `Xin lỗi, tôi gặp một chút trục trặc. Bạn có thể thử hỏi lại được không? 😅`;
	}
}
