import { QueryType, QueryValidationResult } from '../types/chat.types';

/**
 * Validates if the user query is appropriate for database querying
 */
export class QueryValidator {
	/**
	 * Validates query intent
	 * @param query - User input query
	 * @returns Validation result with clarification questions if needed
	 */
	static async validateQueryIntent(query: string): Promise<QueryValidationResult> {
		const queryLower = query.toLowerCase().trim();
		const invalidPatterns = [
			'chào',
			'hello',
			'hi',
			'xin chào',
			'cảm ơn',
			'thank',
			'thanks',
			'tạm biệt',
			'bye',
			'goodbye',
			'làm gì',
			'làm sao',
			'như thế nào',
			'help',
			'giúp',
			'hướng dẫn',
			'đăng nhập',
			'login',
			'đăng ký',
			'register',
			'thông tin cá nhân',
			'profile',
			'account',
		];
		for (const pattern of invalidPatterns) {
			if (queryLower.includes(pattern)) {
				return {
					isValid: false,
					reason: `Câu hỏi "${pattern}" không được hỗ trợ`,
					queryType: 'INVALID',
				};
			}
		}
		const statisticsPatterns = [
			'thống kê',
			'doanh thu',
			'revenue',
			'income',
			'tổng quan',
			'overview',
			'báo cáo',
			'report',
			'phân tích',
			'analysis',
			'dashboard',
			'tiền thuê',
			'rental income',
			'profit',
			'khách thuê',
			'tenants',
			'occupancy',
			'tỷ lệ',
			'rate',
			'percentage',
			'bao nhiêu',
			'how many',
			'count',
			'tổng',
			'total',
			'sum',
		];
		const roomSearchPatterns = [
			'tìm phòng',
			'tìm trọ',
			'phòng trọ',
			'room',
			'giá',
			'price',
			'cost',
			'tiền thuê',
			'địa chỉ',
			'address',
			'location',
			'vị trí',
			'quận',
			'district',
			'huyện',
			'ward',
			'thuê',
			'rent',
			'booking',
			'đặt phòng',
			'phù hợp',
			'suitable',
			'available',
			'gần',
			'near',
			'close to',
			'tiện nghi',
			'amenities',
			'facilities',
			'có',
			'còn',
			'exist',
			'ở đâu',
			'where',
		];
		const roomCreationPatterns = [
			'tạo phòng',
			'thêm phòng',
			'đăng phòng',
			'create room',
			'add room',
			'list room',
			'đăng tin',
			'post listing',
			'advertise',
			'quản lý phòng',
			'manage room',
			'room management',
			'cập nhật phòng',
			'update room',
			'edit room',
			'giá phòng',
			'room price',
			'pricing',
			'mô tả phòng',
			'room description',
			'hình ảnh phòng',
			'room images',
			'photos',
			'thiết lập',
			'setup',
			'configure',
		];
		let queryType: QueryType = 'INVALID';
		if (statisticsPatterns.some((pattern) => queryLower.includes(pattern))) {
			queryType = 'STATISTICS';
		} else if (roomSearchPatterns.some((pattern) => queryLower.includes(pattern))) {
			queryType = 'ROOM_SEARCH';
		} else if (roomCreationPatterns.some((pattern) => queryLower.includes(pattern))) {
			queryType = 'ROOM_CREATION';
		}
		if (queryType === 'INVALID') {
			const generalDataPatterns = [
				'có',
				'còn',
				'available',
				'exist',
				'bao nhiêu',
				'how many',
				'count',
				'ở đâu',
				'where',
				'location',
				'như thế nào',
				'how',
				'what',
			];
			if (generalDataPatterns.some((pattern) => queryLower.includes(pattern))) {
				queryType = 'ROOM_SEARCH';
			}
		}
		return {
			isValid: queryType !== 'INVALID',
			reason: queryType === 'INVALID' ? 'Loại câu hỏi không được hỗ trợ' : undefined,
			queryType,
		};
	}
}
