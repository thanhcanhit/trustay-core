// Default room rules data for Vietnam rental market
const defaultRoomRules = [
	// SMOKING RULES
	{
		name: 'Không hút thuốc trong phòng',
		nameEn: 'no_smoking_indoor',
		category: 'smoking',
		ruleType: 'forbidden',
		description: 'Không được hút thuốc trong phòng và khu vực chung',
		sortOrder: 1,
	},
	{
		name: 'Chỉ hút thuốc ở ban công',
		nameEn: 'smoking_balcony_only',
		category: 'smoking',
		ruleType: 'conditional',
		description: 'Chỉ được hút thuốc tại ban công hoặc khu vực được chỉ định',
		sortOrder: 2,
	},
	{
		name: 'Hoàn toàn không hút thuốc',
		nameEn: 'no_smoking_anywhere',
		category: 'smoking',
		ruleType: 'forbidden',
		description: 'Không được hút thuốc trong toàn bộ khu vực',
		sortOrder: 3,
	},

	// PETS RULES
	{
		name: 'Không nuôi thú cưng',
		nameEn: 'no_pets',
		category: 'pets',
		ruleType: 'forbidden',
		description: 'Không được nuôi bất kỳ loại thú cưng nào',
		sortOrder: 4,
	},
	{
		name: 'Cho phép nuôi thú cưng nhỏ',
		nameEn: 'small_pets_allowed',
		category: 'pets',
		ruleType: 'allowed',
		description: 'Cho phép nuôi thú cưng nhỏ (cá, chim, hamster)',
		sortOrder: 5,
	},
	{
		name: 'Cho phép nuôi mèo',
		nameEn: 'cats_allowed',
		category: 'pets',
		ruleType: 'allowed',
		description: 'Cho phép nuôi mèo với điều kiện',
		sortOrder: 6,
	},
	{
		name: 'Cho phép nuôi chó nhỏ',
		nameEn: 'small_dogs_allowed',
		category: 'pets',
		ruleType: 'allowed',
		description: 'Cho phép nuôi chó dưới 10kg',
		sortOrder: 7,
	},

	// VISITORS RULES
	{
		name: 'Không qua đêm',
		nameEn: 'no_overnight_guests',
		category: 'visitors',
		ruleType: 'forbidden',
		description: 'Khách không được phép ở qua đêm',
		sortOrder: 8,
	},
	{
		name: 'Báo trước khi có khách',
		nameEn: 'notify_before_guests',
		category: 'visitors',
		ruleType: 'required',
		description: 'Phải thông báo trước khi có khách đến',
		sortOrder: 9,
	},
	{
		name: 'Khách chỉ đến giờ hành chính',
		nameEn: 'guests_office_hours_only',
		category: 'visitors',
		ruleType: 'conditional',
		description: 'Khách chỉ được đến từ 8h-22h',
		sortOrder: 10,
	},
	{
		name: 'Đăng ký khách qua đêm',
		nameEn: 'register_overnight_guests',
		category: 'visitors',
		ruleType: 'required',
		description: 'Phải đăng ký với chủ nhà nếu khách ở qua đêm',
		sortOrder: 11,
	},

	// NOISE RULES
	{
		name: 'Không gây ồn sau 22h',
		nameEn: 'quiet_after_10pm',
		category: 'noise',
		ruleType: 'required',
		description: 'Không được gây tiếng ồn sau 22h',
		sortOrder: 12,
	},
	{
		name: 'Không phát nhạc to',
		nameEn: 'no_loud_music',
		category: 'noise',
		ruleType: 'forbidden',
		description: 'Không được phát nhạc với âm lượng lớn',
		sortOrder: 13,
	},
	{
		name: 'Không tổ chức tiệc',
		nameEn: 'no_parties',
		category: 'noise',
		ruleType: 'forbidden',
		description: 'Không được tổ chức tiệc tùng trong phòng',
		sortOrder: 14,
	},

	// CLEANLINESS RULES
	{
		name: 'Giữ vệ sinh chung',
		nameEn: 'maintain_common_cleanliness',
		category: 'cleanliness',
		ruleType: 'required',
		description: 'Phải giữ vệ sinh khu vực chung sau khi sử dụng',
		sortOrder: 15,
	},
	{
		name: 'Không để rác bừa bãi',
		nameEn: 'no_littering',
		category: 'cleanliness',
		ruleType: 'forbidden',
		description: 'Không được để rác bừa bãi trong nhà',
		sortOrder: 16,
	},
	{
		name: 'Dọn phòng định kỳ',
		nameEn: 'regular_room_cleaning',
		category: 'cleanliness',
		ruleType: 'required',
		description: 'Phải dọn dẹp phòng ít nhất 1 tuần/lần',
		sortOrder: 17,
	},

	// SECURITY RULES
	{
		name: 'Khóa cửa khi ra ngoài',
		nameEn: 'lock_door_when_out',
		category: 'security',
		ruleType: 'required',
		description: 'Phải khóa cửa phòng và cửa chính khi ra ngoài',
		sortOrder: 18,
	},
	{
		name: 'Không sao chép chìa khóa',
		nameEn: 'no_key_duplication',
		category: 'security',
		ruleType: 'forbidden',
		description: 'Không được sao chép chìa khóa mà không xin phép',
		sortOrder: 19,
	},
	{
		name: 'Báo ngay khi mất chìa khóa',
		nameEn: 'report_lost_keys',
		category: 'security',
		ruleType: 'required',
		description: 'Phải báo ngay với chủ nhà khi mất chìa khóa',
		sortOrder: 20,
	},

	// USAGE RULES
	{
		name: 'Không nấu ăn trong phòng ngủ',
		nameEn: 'no_cooking_in_bedroom',
		category: 'usage',
		ruleType: 'forbidden',
		description: 'Không được nấu ăn trong phòng ngủ',
		sortOrder: 21,
	},
	{
		name: 'Sử dụng điện tiết kiệm',
		nameEn: 'save_electricity',
		category: 'usage',
		ruleType: 'required',
		description: 'Tắt điện, nước khi không sử dụng',
		sortOrder: 22,
	},
	{
		name: 'Không sử dụng thiết bị công suất cao',
		nameEn: 'no_high_power_devices',
		category: 'usage',
		ruleType: 'forbidden',
		description: 'Không sử dụng máy sưởi, bếp điện công suất lớn',
		sortOrder: 23,
	},
	{
		name: 'Không thay đổi cấu trúc phòng',
		nameEn: 'no_room_modifications',
		category: 'usage',
		ruleType: 'forbidden',
		description: 'Không được thay đổi cấu trúc, sơn tường, đóng đinh',
		sortOrder: 24,
	},

	// OTHER RULES
	{
		name: 'Thanh toán đúng hạn',
		nameEn: 'pay_on_time',
		category: 'other',
		ruleType: 'required',
		description: 'Thanh toán tiền thuê đúng hạn mỗi tháng',
		sortOrder: 25,
	},
	{
		name: 'Thông báo trước khi chuyển đi',
		nameEn: 'notice_before_moving',
		category: 'other',
		ruleType: 'required',
		description: 'Thông báo trước 1 tháng khi muốn chuyển đi',
		sortOrder: 26,
	},
	{
		name: 'Tôn trọng hàng xóm',
		nameEn: 'respect_neighbors',
		category: 'other',
		ruleType: 'required',
		description: 'Tôn trọng và giữ quan hệ tốt với hàng xóm',
		sortOrder: 27,
	},
	{
		name: 'Không hoạt động kinh doanh',
		nameEn: 'no_business_activities',
		category: 'other',
		ruleType: 'forbidden',
		description: 'Không được sử dụng phòng để kinh doanh',
		sortOrder: 28,
	},
];

module.exports = {
	defaultRoomRules,
};
