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
		// Completely remove strict invalidPatterns rejection.
		// Only pattern-categorize below, let all queries be considered ROOM_SEARCH/statistics/creation or INVALID by matching meaningful patterns

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
		const createBuildingPatterns = [
			'tạo toà',
			'tạo tòa',
			'tạo building',
			'thêm building',
			'add building',
			'create building',
			'đăng toà',
			'đăng tòa',
			'create apartment building',
		];
		const createRoomPatterns = [
			'tạo phòng',
			'thêm phòng',
			'đăng phòng',
			'create room',
			'add room',
			'post listing',
		];
		const updateBuildingPatterns = [
			'cập nhật toà',
			'cập nhật tòa',
			'update building',
			'sửa building',
			'chỉnh building',
		];
		const updateRoomPatterns = [
			'cập nhật phòng',
			'update room',
			'edit room',
			'sửa phòng',
			'chỉnh phòng',
		];
		// Default to ROOM_SEARCH so free-form inputs (e.g., mô tả phòng) are not rejected
		let queryType: QueryType = 'ROOM_SEARCH';
		if (createBuildingPatterns.some((p) => queryLower.includes(p))) {
			queryType = 'CREATE_BUILDING';
		} else if (createRoomPatterns.some((p) => queryLower.includes(p))) {
			queryType = 'CREATE_ROOM';
		} else if (updateBuildingPatterns.some((p) => queryLower.includes(p))) {
			queryType = 'UPDATE_BUILDING';
		} else if (updateRoomPatterns.some((p) => queryLower.includes(p))) {
			queryType = 'UPDATE_ROOM';
		} else if (statisticsPatterns.some((pattern) => queryLower.includes(pattern))) {
			queryType = 'STATISTICS';
		} else if (roomSearchPatterns.some((pattern) => queryLower.includes(pattern))) {
			queryType = 'ROOM_SEARCH';
		}
		return {
			isValid: true,
			reason: undefined,
			queryType,
		};
	}
}
