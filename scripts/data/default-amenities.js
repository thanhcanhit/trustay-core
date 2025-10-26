const defaultAmenities = [
	// Tiện ích cơ bản - Basic amenities
	{
		name: 'Đầy đủ nội thất',
		nameEn: 'fully_furnished',
		category: 'basic',
		description: 'Phòng có đầy đủ nội thất cần thiết',
		sortOrder: 1,
	},
	{
		name: 'Có gác',
		nameEn: 'has_loft',
		category: 'basic',
		description: 'Có gác lửng/gác xép',
		sortOrder: 2,
	},
	{
		name: 'Có máy lạnh',
		nameEn: 'has_air_conditioning',
		category: 'basic',
		description: 'Có điều hòa/máy lạnh',
		sortOrder: 3,
	},
	{
		name: 'Có tủ lạnh',
		nameEn: 'has_refrigerator',
		category: 'basic',
		description: 'Có tủ lạnh',
		sortOrder: 4,
	},

	// Tiện ích bếp - Kitchen amenities
	{
		name: 'Có kệ bếp',
		nameEn: 'has_kitchen_shelf',
		category: 'kitchen',
		description: 'Có kệ bếp/khu vực nấu ăn',
		sortOrder: 5,
	},

	// Tiện ích vệ sinh - Bathroom amenities
	{
		name: 'Vệ sinh riêng',
		nameEn: 'private_bathroom',
		category: 'bathroom',
		description: 'Nhà vệ sinh riêng',
		sortOrder: 6,
	},
	{
		name: 'Có nước nóng',
		nameEn: 'has_hot_water',
		category: 'bathroom',
		description: 'Có hệ thống nước nóng',
		sortOrder: 7,
	},

	// Tiện ích tòa nhà - Building amenities
	{
		name: 'Có máy giặt',
		nameEn: 'has_washing_machine',
		category: 'building',
		description: 'Có máy giặt (riêng hoặc chung)',
		sortOrder: 8,
	},
	{
		name: 'Có thang máy',
		nameEn: 'has_elevator',
		category: 'building',
		description: 'Có thang máy',
		sortOrder: 9,
	},
	{
		name: 'Có hầm để xe',
		nameEn: 'has_parking_garage',
		category: 'building',
		description: 'Có hầm để xe/bãi đỗ xe',
		sortOrder: 10,
	},

	// Tiện ích kết nối - Connectivity
	{
		name: 'Có WiFi',
		nameEn: 'has_wifi',
		category: 'connectivity',
		description: 'Có WiFi miễn phí',
		sortOrder: 11,
	},

	// An ninh - Security
	{
		name: 'Có bảo vệ 24/24',
		nameEn: 'has_security_24_7',
		category: 'safety',
		description: 'Có bảo vệ 24/24',
		sortOrder: 12,
	},
	{
		name: 'Camera an ninh',
		nameEn: 'security_camera',
		category: 'safety',
		description: 'Có camera an ninh',
		sortOrder: 13,
	},

	// Đặc điểm đặc biệt - Special features
	{
		name: 'Không chung chủ',
		nameEn: 'no_shared_landlord',
		category: 'basic',
		description: 'Không ở chung với chủ nhà',
		sortOrder: 14,
	},
	{
		name: 'Giờ giấc tự do',
		nameEn: 'flexible_hours',
		category: 'basic',
		description: 'Tự do về giờ giấc ra vào',
		sortOrder: 15,
	},

	// Vị trí - Location (chỉ những vị trí quan trọng nhất)
	{
		name: 'Gần trường học',
		nameEn: 'near_school',
		category: 'basic',
		description: 'Gần trường học/đại học',
		sortOrder: 16,
	},
	{
		name: 'Gần chợ/siêu thị',
		nameEn: 'near_market',
		category: 'basic',
		description: 'Gần chợ/siêu thị',
		sortOrder: 17,
	},
	{
		name: 'Gần khu công nghiệp',
		nameEn: 'near_industrial_area',
		category: 'basic',
		description: 'Gần khu công nghiệp',
		sortOrder: 18,
	},

	// Tiện ích bổ sung - Additional amenities
	{
		name: 'Ban công',
		nameEn: 'balcony',
		category: 'building',
		description: 'Có ban công',
		sortOrder: 19,
	},
	{
		name: 'Sân phơi',
		nameEn: 'drying_area',
		category: 'building',
		description: 'Có sân phơi đồ',
		sortOrder: 20,
	},
];

module.exports = { defaultAmenities };
