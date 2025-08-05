const defaultCostTypes = [
	// Utility costs - Chi phí tiện ích
	{
		name: 'Tiền điện',
		nameEn: 'electricity',
		category: 'utility',
		defaultUnit: 'kWh',
		description: 'Chi phí điện hàng tháng',
		sortOrder: 1,
	},
	{
		name: 'Tiền nước',
		nameEn: 'water',
		category: 'utility',
		defaultUnit: 'm³',
		description: 'Chi phí nước hàng tháng',
		sortOrder: 2,
	},
	{
		name: 'Internet',
		nameEn: 'internet',
		category: 'utility',
		defaultUnit: 'tháng',
		description: 'Chi phí internet hàng tháng',
		sortOrder: 3,
	},
	{
		name: 'Truyền hình cáp',
		nameEn: 'cable_tv',
		category: 'utility',
		defaultUnit: 'tháng',
		description: 'Chi phí truyền hình cáp',
		sortOrder: 4,
	},

	// Service costs - Chi phí dịch vụ
	{
		name: 'Dọn dẹp',
		nameEn: 'cleaning',
		category: 'service',
		defaultUnit: 'lần',
		description: 'Chi phí dịch vụ dọn dẹp',
		sortOrder: 5,
	},
	{
		name: 'Giặt ủi',
		nameEn: 'laundry',
		category: 'service',
		defaultUnit: 'kg',
		description: 'Chi phí giặt ủi',
		sortOrder: 6,
	},
	{
		name: 'Bảo vệ',
		nameEn: 'security',
		category: 'service',
		defaultUnit: 'tháng',
		description: 'Chi phí dịch vụ bảo vệ',
		sortOrder: 7,
	},
	{
		name: 'Quản lý chung',
		nameEn: 'management_fee',
		category: 'service',
		defaultUnit: 'tháng',
		description: 'Phí quản lý chung tòa nhà',
		sortOrder: 8,
	},
	{
		name: 'Thu gom rác',
		nameEn: 'garbage',
		category: 'service',
		defaultUnit: 'tháng',
		description: 'Phí thu gom rác',
		sortOrder: 9,
	},

	// Parking costs - Chi phí gửi xe
	{
		name: 'Gửi xe máy',
		nameEn: 'motorbike_parking',
		category: 'parking',
		defaultUnit: 'tháng',
		description: 'Phí gửi xe máy hàng tháng',
		sortOrder: 10,
	},
	{
		name: 'Gửi xe ô tô',
		nameEn: 'car_parking',
		category: 'parking',
		defaultUnit: 'tháng',
		description: 'Phí gửi xe ô tô hàng tháng',
		sortOrder: 11,
	},

	// Maintenance costs - Chi phí bảo trì
	{
		name: 'Sửa chữa điện nước',
		nameEn: 'electrical_plumbing',
		category: 'maintenance',
		defaultUnit: 'lần',
		description: 'Chi phí sửa chữa hệ thống điện nước',
		sortOrder: 12,
	},
	{
		name: 'Bảo trì điều hòa',
		nameEn: 'ac_maintenance',
		category: 'maintenance',
		defaultUnit: 'lần',
		description: 'Chi phí bảo trì điều hòa',
		sortOrder: 13,
	},
	{
		name: 'Sửa chữa thiết bị',
		nameEn: 'equipment_repair',
		category: 'maintenance',
		defaultUnit: 'lần',
		description: 'Chi phí sửa chữa thiết bị',
		sortOrder: 14,
	},
];

module.exports = { defaultCostTypes };
