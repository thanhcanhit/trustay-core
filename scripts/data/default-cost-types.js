const defaultCostTypes = [
	// Utility costs - Chi phí tiện ích cơ bản
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

	// Service costs - Chi phí dịch vụ
	{
		name: 'Phí dịch vụ chung',
		nameEn: 'service_fee',
		category: 'service',
		defaultUnit: 'tháng',
		description: 'Phí dịch vụ tổng hợp (bao gồm vệ sinh, bảo trì khu vực chung)',
		sortOrder: 4,
	},
	{
		name: 'Thu gom rác',
		nameEn: 'garbage',
		category: 'service',
		defaultUnit: 'tháng',
		description: 'Phí thu gom rác',
		sortOrder: 5,
	},
	{
		name: 'Bảo vệ',
		nameEn: 'security',
		category: 'service',
		defaultUnit: 'tháng',
		description: 'Chi phí dịch vụ bảo vệ (nếu có)',
		sortOrder: 6,
	},

	// Parking costs - Chi phí gửi xe
	{
		name: 'Gửi xe máy',
		nameEn: 'motorbike_parking',
		category: 'parking',
		defaultUnit: 'tháng',
		description: 'Phí gửi xe máy hàng tháng',
		sortOrder: 7,
	},
	{
		name: 'Gửi xe ô tô',
		nameEn: 'car_parking',
		category: 'parking',
		defaultUnit: 'tháng',
		description: 'Phí gửi xe ô tô hàng tháng',
		sortOrder: 8,
	},
];

module.exports = { defaultCostTypes };
