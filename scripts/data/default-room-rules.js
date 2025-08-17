// Nội quy phòng trọ cần thiết nhất tại Việt Nam
const defaultRoomRules = [
	{
		name: 'Không gây ồn sau 22h',
		nameEn: 'quiet_after_10pm',
		category: 'noise',
		ruleType: 'forbidden',
		description: 'Không gây ồn ào, mất trật tự sau 22h',
		sortOrder: 1,
	},
	{
		name: 'Không cho khách qua đêm',
		nameEn: 'no_overnight_guests',
		category: 'visitors',
		ruleType: 'forbidden',
		description: 'Không cho bạn bè, người thân ở qua đêm',
		sortOrder: 2,
	},
	{
		name: 'Không nuôi thú cưng',
		nameEn: 'no_pets',
		category: 'pets',
		ruleType: 'forbidden',
		description: 'Không được nuôi thú cưng',
		sortOrder: 3,
	},
	{
		name: 'Không sạc xe điện',
		nameEn: 'no_electric_vehicle_charging',
		category: 'safety',
		ruleType: 'forbidden',
		description: 'Không được sạc xe điện',
		sortOrder: 4,
	},
	{
		name: 'Không hút thuốc trong phòng',
		nameEn: 'no_smoking_indoor',
		category: 'smoking',
		ruleType: 'forbidden',
		description: 'Không được hút thuốc trong phòng',
		sortOrder: 5,
	},
	{
		name: 'Không nấu ăn trong phòng',
		nameEn: 'no_cooking_in_room',
		category: 'usage',
		ruleType: 'forbidden',
		description: 'Không được nấu ăn trong phòng',
		sortOrder: 6,
	},
	{
		name: 'Không sửa chữa phòng',
		nameEn: 'no_room_modifications',
		category: 'usage',
		ruleType: 'forbidden',
		description: 'Không được sửa chữa, đóng đinh, sơn tường',
		sortOrder: 7,
	},
	{
		name: 'Không ở chung nam nữ',
		nameEn: 'no_mixed_gender_sharing',
		category: 'visitors',
		ruleType: 'forbidden',
		description: 'Nam và nữ không được ở chung',
		sortOrder: 8,
	},
];

module.exports = {
	defaultRoomRules,
};
