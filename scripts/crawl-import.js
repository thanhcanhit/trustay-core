const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

// Enhanced intelligent reference mapping functions
async function applyIntelligentReferences(roomId, itemData, roomPrice) {
	const description = (
		itemData.description +
		' ' +
		itemData.detailed_description +
		' ' +
		itemData.title
	).toLowerCase();
	const amenities = itemData.amenities || [];

	// Apply amenities based on price tier and description
	await applyIntelligentAmenities(roomId, description, amenities, roomPrice);

	// Apply cost types based on pricing and amenities
	await applyIntelligentCostTypes(roomId, description, roomPrice, amenities);

	// Apply room rules based on price tier and amenities
	await applyIntelligentRoomRules(roomId, description, roomPrice, amenities);
}

// Pricing tiers for intelligent mapping
const PRICING_TIERS = {
	BUDGET: { min: 0, max: 2000000 }, // < 2M VND
	ECONOMY: { min: 2000000, max: 4000000 }, // 2M - 4M VND
	STANDARD: { min: 4000000, max: 6000000 }, // 4M - 6M VND
	PREMIUM: { min: 6000000, max: 10000000 }, // 6M - 10M VND
	LUXURY: { min: 10000000, max: Infinity }, // > 10M VND
};

function getPriceTier(price) {
	for (const [tier, range] of Object.entries(PRICING_TIERS)) {
		if (price >= range.min && price < range.max) {
			return tier;
		}
	}
	return 'BUDGET';
}

// Enhanced amenities mapping with price-based intelligence
async function applyIntelligentAmenities(roomId, description, existingAmenities, price) {
	const priceTier = getPriceTier(price);
	const amenityMappings = getAmenityMappingsByTier(priceTier);

	// Parse existing amenities if they're in array format
	let parsedAmenities = [];
	if (Array.isArray(existingAmenities)) {
		parsedAmenities = existingAmenities;
	} else if (typeof existingAmenities === 'string') {
		try {
			parsedAmenities = JSON.parse(existingAmenities) || [];
		} catch (e) {
			parsedAmenities = [];
		}
	}

	// Combine description and existing amenities for analysis
	const combinedText = description + ' ' + parsedAmenities.join(' ').toLowerCase();

	const detectedAmenities = [];

	for (const mapping of amenityMappings) {
		let hasAmenity = false;

		// Check keywords in combined text
		if (mapping.keywords.some((keyword) => combinedText.includes(keyword))) {
			hasAmenity = true;
		}

		// Price-based inference for high-value amenities
		if (mapping.priceInference && priceTier === mapping.priceInference) {
			hasAmenity = true;
		}

		if (hasAmenity) {
			try {
				// Find or create system amenity
				let systemAmenity = await prisma.systemAmenity.findUnique({
					where: { nameEn: mapping.nameEn },
				});

				if (!systemAmenity) {
					systemAmenity = await prisma.systemAmenity.create({
						data: {
							name: mapping.name,
							nameEn: mapping.nameEn,
							category: mapping.category,
							isActive: true,
							sortOrder: mapping.sortOrder || 999,
						},
					});
				}

				// Add to room
				await prisma.roomAmenity
					.create({
						data: {
							roomId: roomId,
							systemAmenityId: systemAmenity.id,
						},
					})
					.catch(() => {}); // Ignore if already exists

				detectedAmenities.push(mapping.nameEn);
			} catch (error) {
				console.error(`Error adding amenity ${mapping.nameEn}:`, error);
			}
		}
	}

	console.log(`🏠 Applied ${detectedAmenities.length} amenities for ${priceTier} tier room`);
}

function getAmenityMappingsByTier(priceTier) {
	const baseAmenities = [
		// Basic amenities - common across all tiers
		{ keywords: ['giường'], name: 'Giường', nameEn: 'bed', category: 'basic', sortOrder: 1 },
		{
			keywords: ['tủ quần áo', 'tủ đồ'],
			name: 'Tủ quần áo',
			nameEn: 'wardrobe',
			category: 'basic',
			sortOrder: 2,
		},
		{
			keywords: ['bàn học', 'bàn làm việc'],
			name: 'Bàn học',
			nameEn: 'desk',
			category: 'basic',
			sortOrder: 3,
		},
		{ keywords: ['cửa sổ'], name: 'Cửa sổ', nameEn: 'window', category: 'basic', sortOrder: 4 },

		// Kitchen amenities
		{
			keywords: ['bếp', 'nấu ăn', 'có kệ bếp'],
			name: 'Bếp gas',
			nameEn: 'gas_stove',
			category: 'kitchen',
			sortOrder: 10,
		},
		{
			keywords: ['tủ lạnh'],
			name: 'Tủ lạnh',
			nameEn: 'refrigerator',
			category: 'kitchen',
			sortOrder: 11,
		},
		{
			keywords: ['nồi cơm điện'],
			name: 'Nồi cơm điện',
			nameEn: 'rice_cooker',
			category: 'kitchen',
			sortOrder: 12,
		},

		// Bathroom amenities
		{
			keywords: ['vòi sen', 'tắm'],
			name: 'Vòi sen',
			nameEn: 'shower',
			category: 'bathroom',
			sortOrder: 15,
		},
		{
			keywords: ['nước nóng', 'bình nóng lạnh'],
			name: 'Nước nóng',
			nameEn: 'hot_water',
			category: 'bathroom',
			sortOrder: 16,
		},
		{
			keywords: ['máy giặt', 'có máy giặt'],
			name: 'Máy giặt',
			nameEn: 'washing_machine',
			category: 'bathroom',
			sortOrder: 17,
		},

		// Connectivity
		{
			keywords: ['wifi', 'internet', 'mạng'],
			name: 'Internet',
			nameEn: 'wifi',
			category: 'connectivity',
			sortOrder: 20,
		},

		// Building amenities
		{
			keywords: ['thang máy', 'có thang máy'],
			name: 'Thang máy',
			nameEn: 'elevator',
			category: 'building',
			sortOrder: 25,
		},
		{
			keywords: ['có hầm để xe', 'chỗ để xe', 'gửi xe'],
			name: 'Bãi đỗ xe',
			nameEn: 'parking',
			category: 'building',
			sortOrder: 26,
		},
		{
			keywords: ['có bảo vệ', 'bảo vệ 24/24', 'an ninh'],
			name: 'Camera an ninh',
			nameEn: 'security_camera',
			category: 'safety',
			sortOrder: 30,
		},
	];

	// Add tier-specific amenities
	if (priceTier === 'BUDGET') {
		return baseAmenities.concat([
			{
				keywords: ['quạt trần', 'quạt'],
				name: 'Quạt trần',
				nameEn: 'ceiling_fan',
				category: 'basic',
				sortOrder: 5,
			},
		]);
	} else if (priceTier === 'ECONOMY') {
		return baseAmenities.concat([
			{
				keywords: ['quạt trần', 'quạt'],
				name: 'Quạt trần',
				nameEn: 'ceiling_fan',
				category: 'basic',
				sortOrder: 5,
			},
			{
				keywords: ['máy lạnh', 'điều hòa', 'có máy lạnh'],
				name: 'Điều hòa',
				nameEn: 'air_conditioning',
				category: 'basic',
				sortOrder: 6,
			},
			{
				keywords: ['tv', 'tivi', 'tê vi'],
				name: 'TV',
				nameEn: 'television',
				category: 'entertainment',
				sortOrder: 31,
			},
		]);
	} else if (priceTier === 'STANDARD') {
		return baseAmenities.concat([
			{
				keywords: ['máy lạnh', 'điều hòa', 'có máy lạnh'],
				name: 'Điều hòa',
				nameEn: 'air_conditioning',
				category: 'basic',
				sortOrder: 6,
			},
			{
				keywords: ['ban công'],
				name: 'Ban công',
				nameEn: 'balcony',
				category: 'basic',
				sortOrder: 7,
			},
			{
				keywords: ['tv', 'tivi', 'tê vi'],
				name: 'TV',
				nameEn: 'television',
				category: 'entertainment',
				sortOrder: 31,
			},
			{
				keywords: ['lò vi sóng'],
				name: 'Lò vi sóng',
				nameEn: 'microwave',
				category: 'kitchen',
				sortOrder: 13,
			},
			{
				keywords: ['có gác', 'gác xép'],
				name: 'Sân thượng',
				nameEn: 'rooftop',
				category: 'building',
				sortOrder: 27,
			},
		]);
	} else if (priceTier === 'PREMIUM') {
		return baseAmenities.concat([
			{
				keywords: ['máy lạnh', 'điều hòa', 'có máy lạnh'],
				name: 'Điều hòa',
				nameEn: 'air_conditioning',
				category: 'basic',
				sortOrder: 6,
			},
			{
				keywords: ['ban công'],
				name: 'Ban công',
				nameEn: 'balcony',
				category: 'basic',
				sortOrder: 7,
			},
			{
				keywords: ['tv', 'tivi', 'tê vi'],
				name: 'TV',
				nameEn: 'television',
				category: 'entertainment',
				sortOrder: 31,
			},
			{
				keywords: ['lò vi sóng'],
				name: 'Lò vi sóng',
				nameEn: 'microwave',
				category: 'kitchen',
				sortOrder: 13,
			},
			{
				keywords: ['có gác', 'gác xép'],
				name: 'Sân thượng',
				nameEn: 'rooftop',
				category: 'building',
				sortOrder: 27,
			},
			{
				keywords: ['khóa vân tay', 'khóa từ'],
				name: 'Khóa vân tay',
				nameEn: 'fingerprint_lock',
				category: 'safety',
				sortOrder: 32,
			},
			// Price-based inference for premium amenities
			{
				keywords: [],
				name: 'Internet cáp quang',
				nameEn: 'fiber_internet',
				category: 'connectivity',
				priceInference: 'PREMIUM',
				sortOrder: 21,
			},
		]);
	} else if (priceTier === 'LUXURY') {
		return baseAmenities.concat([
			{
				keywords: ['máy lạnh', 'điều hòa', 'có máy lạnh'],
				name: 'Điều hòa',
				nameEn: 'air_conditioning',
				category: 'basic',
				sortOrder: 6,
			},
			{
				keywords: ['ban công'],
				name: 'Ban công',
				nameEn: 'balcony',
				category: 'basic',
				sortOrder: 7,
			},
			{
				keywords: ['tv', 'tivi', 'tê vi'],
				name: 'TV',
				nameEn: 'television',
				category: 'entertainment',
				sortOrder: 31,
			},
			{
				keywords: ['lò vi sóng'],
				name: 'Lò vi sóng',
				nameEn: 'microwave',
				category: 'kitchen',
				sortOrder: 13,
			},
			{
				keywords: ['có gác', 'gác xép'],
				name: 'Sân thượng',
				nameEn: 'rooftop',
				category: 'building',
				sortOrder: 27,
			},
			{
				keywords: ['khóa vân tay', 'khóa từ'],
				name: 'Khóa vân tay',
				nameEn: 'fingerprint_lock',
				category: 'safety',
				sortOrder: 32,
			},
			// Luxury amenities with price inference
			{
				keywords: [],
				name: 'Internet cáp quang',
				nameEn: 'fiber_internet',
				category: 'connectivity',
				priceInference: 'LUXURY',
				sortOrder: 21,
			},
			{
				keywords: [],
				name: 'Báo cháy',
				nameEn: 'fire_alarm',
				category: 'safety',
				priceInference: 'LUXURY',
				sortOrder: 33,
			},
			{
				keywords: [],
				name: 'Khu giặt chung',
				nameEn: 'laundry_area',
				category: 'building',
				priceInference: 'LUXURY',
				sortOrder: 28,
			},
		]);
	}

	return baseAmenities;
}

// Apply intelligent cost types based on amenities and price tier
async function applyIntelligentCostTypes(roomId, description, price, amenities) {
	const priceTier = getPriceTier(price);
	const costTypeMappings = getCostTypeMappingsByTier(priceTier);

	for (const costMapping of costTypeMappings) {
		try {
			// Find system cost type
			const systemCostType = await prisma.systemCostType.findUnique({
				where: { nameEn: costMapping.nameEn },
			});

			if (systemCostType) {
				// Create room cost
				await prisma.roomCost
					.create({
						data: {
							roomId: roomId,
							systemCostTypeId: systemCostType.id,
							costType: costMapping.costType,
							baseRate: costMapping.baseRate,
							billingCycle: costMapping.billingCycle,
							isActive: true,
						},
					})
					.catch(() => {}); // Ignore if already exists
			}
		} catch (error) {
			console.error(`Error adding cost type ${costMapping.nameEn}:`, error);
		}
	}

	console.log(`💰 Applied ${costTypeMappings.length} cost types for ${priceTier} tier room`);
}

function getCostTypeMappingsByTier(priceTier) {
	const baseCosts = [
		{ nameEn: 'electricity', costType: 'per_unit', baseRate: '3500', billingCycle: 'monthly' },
		{ nameEn: 'water', costType: 'per_unit', baseRate: '25000', billingCycle: 'monthly' },
	];

	if (priceTier === 'BUDGET') {
		return baseCosts.concat([
			{ nameEn: 'internet', costType: 'fixed', baseRate: '100000', billingCycle: 'monthly' },
		]);
	} else if (priceTier === 'ECONOMY') {
		return baseCosts.concat([
			{ nameEn: 'internet', costType: 'fixed', baseRate: '150000', billingCycle: 'monthly' },
			{
				nameEn: 'motorbike_parking',
				costType: 'fixed',
				baseRate: '50000',
				billingCycle: 'monthly',
			},
		]);
	} else if (priceTier === 'STANDARD' || priceTier === 'PREMIUM') {
		return baseCosts.concat([
			{ nameEn: 'internet', costType: 'fixed', baseRate: '200000', billingCycle: 'monthly' },
			{
				nameEn: 'motorbike_parking',
				costType: 'fixed',
				baseRate: '80000',
				billingCycle: 'monthly',
			},
			{ nameEn: 'cleaning', costType: 'fixed', baseRate: '150000', billingCycle: 'monthly' },
		]);
	} else if (priceTier === 'LUXURY') {
		return baseCosts.concat([
			{ nameEn: 'internet', costType: 'fixed', baseRate: '300000', billingCycle: 'monthly' },
			{
				nameEn: 'motorbike_parking',
				costType: 'fixed',
				baseRate: '100000',
				billingCycle: 'monthly',
			},
			{ nameEn: 'cleaning', costType: 'fixed', baseRate: '300000', billingCycle: 'monthly' },
			{ nameEn: 'security', costType: 'fixed', baseRate: '200000', billingCycle: 'monthly' },
			{ nameEn: 'management', costType: 'fixed', baseRate: '150000', billingCycle: 'monthly' },
		]);
	}

	return baseCosts;
}

// Apply intelligent room rules based on price tier and property characteristics
async function applyIntelligentRoomRules(roomId, description, price, amenities) {
	const priceTier = getPriceTier(price);
	const ruleMappings = getRuleMappingsByTier(priceTier, description);

	for (const ruleMapping of ruleMappings) {
		try {
			// Find system room rule
			const systemRoomRule = await prisma.systemRoomRule.findUnique({
				where: { nameEn: ruleMapping.nameEn },
			});

			if (systemRoomRule) {
				// Add rule to room
				await prisma.roomRule
					.create({
						data: {
							roomId: roomId,
							systemRuleId: systemRoomRule.id,
							isEnforced: true,
						},
					})
					.catch(() => {}); // Ignore if already exists
			}
		} catch (error) {
			console.error(`Error adding room rule ${ruleMapping.nameEn}:`, error);
		}
	}

	console.log(`📋 Applied ${ruleMappings.length} room rules for ${priceTier} tier room`);
}

function getRuleMappingsByTier(priceTier, description) {
	const baseRules = [
		{ nameEn: 'pay_on_time' },
		{ nameEn: 'maintain_common_cleanliness' },
		{ nameEn: 'lock_door_when_out' },
		{ nameEn: 'save_electricity' },
		{ nameEn: 'no_littering' },
		{ nameEn: 'no_key_duplication' },
		{ nameEn: 'respect_neighbors' },
	];

	// Detect shared landlord situation
	const hasSharedLandlord = description.includes('chung chủ') || description.includes('ở chung');
	const hasNoSharedLandlord = description.includes('không chung chủ');
	const hasFlexibleHours =
		description.includes('giờ giấc tự do') || description.includes('tự do giờ giấc');

	// Add conditional rules based on description
	const conditionalRules = [];
	if (hasSharedLandlord) {
		conditionalRules.push({ nameEn: 'shared_with_landlord' });
		conditionalRules.push({ nameEn: 'quiet_after_10pm' });
		conditionalRules.push({ nameEn: 'notify_before_guests' });
		conditionalRules.push({ nameEn: 'no_loud_music' });
	} else if (hasNoSharedLandlord) {
		conditionalRules.push({ nameEn: 'not_shared_with_landlord' });
	}

	if (hasFlexibleHours) {
		// More flexible rules for "giờ giấc tự do"
		conditionalRules.push({ nameEn: 'guests_office_hours_only' });
	} else {
		conditionalRules.push({ nameEn: 'quiet_after_10pm' });
	}

	// Tier-specific rules
	if (priceTier === 'BUDGET') {
		return baseRules
			.concat(conditionalRules)
			.concat([
				{ nameEn: 'no_pets' },
				{ nameEn: 'no_smoking_indoor' },
				{ nameEn: 'no_overnight_guests' },
				{ nameEn: 'no_high_power_devices' },
				{ nameEn: 'no_cooking_in_bedroom' },
				{ nameEn: 'no_parties' },
				{ nameEn: 'no_business_activities' },
			]);
	} else if (priceTier === 'ECONOMY') {
		return baseRules
			.concat(conditionalRules)
			.concat([
				{ nameEn: 'small_pets_allowed' },
				{ nameEn: 'smoking_balcony_only' },
				{ nameEn: 'register_overnight_guests' },
				{ nameEn: 'no_high_power_devices' },
				{ nameEn: 'no_parties' },
				{ nameEn: 'no_business_activities' },
			]);
	} else if (priceTier === 'STANDARD' || priceTier === 'PREMIUM') {
		return baseRules
			.concat(conditionalRules)
			.concat([
				{ nameEn: 'cats_allowed' },
				{ nameEn: 'smoking_balcony_only' },
				{ nameEn: 'register_overnight_guests' },
				{ nameEn: 'regular_room_cleaning' },
				{ nameEn: 'no_business_activities' },
			]);
	} else if (priceTier === 'LUXURY') {
		return baseRules.concat(conditionalRules).concat([
			{ nameEn: 'pets_allowed' },
			{ nameEn: 'smoking_balcony_only' },
			{ nameEn: 'register_overnight_guests' },
			{ nameEn: 'regular_room_cleaning' },
			{ nameEn: 'notice_before_moving' },
			// More relaxed rules for luxury properties
		]);
	}

	return baseRules.concat(conditionalRules);
}

// Helper functions
function generateSlug(name) {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove accents
		.replace(/[đĐ]/g, 'd')
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function extractRoomNumber(address, title, buildingId) {
	// Try to extract room number from address or title
	const roomMatch = address.match(/phòng\s*(\d+)|p\.?\s*(\d+)|room\s*(\d+)/i);
	if (roomMatch) {
		return roomMatch[1] || roomMatch[2] || roomMatch[3];
	}

	const titleMatch = title.match(/phòng\s*(\d+)|p\.?\s*(\d+)/i);
	if (titleMatch) {
		return titleMatch[1] || titleMatch[2];
	}

	// Generate unique room number based on building ID and timestamp
	const timestamp = Date.now().toString().slice(-4);
	const buildingHash = buildingId.slice(-2);
	return `${buildingHash}${timestamp}`;
}

function determineRoomType(title, description) {
	const content = (title + ' ' + description).toLowerCase();

	if (content.includes('ở ghép') || content.includes('ghép') || content.includes('ký túc')) {
		return 'dormitory';
	}
	if (content.includes('căn hộ') || content.includes('studio') || content.includes('apartment')) {
		return 'apartment';
	}
	if (
		content.includes('nhà nguyên căn') ||
		content.includes('nguyên căn') ||
		content.includes('whole house')
	) {
		return 'whole_house';
	}
	if (content.includes('sleepbox') || content.includes('sleep box') || content.includes('pod')) {
		return 'sleepbox';
	}

	return 'boarding_house'; // Default - most common Vietnamese rental type
}

async function findOrCreateLocation(addressData, province, district) {
	// Parse location from crawled data: "Quận 7, Hồ Chí Minh"
	let cityName, districtName;

	if (addressData?.location) {
		const parts = addressData.location.split(',').map((p) => p.trim());
		if (parts.length >= 2) {
			districtName = parts[0]; // "Quận 7"
			cityName = parts[1]; // "Hồ Chí Minh"
			// Normalize city name
			if (cityName.includes('Hồ Chí Minh') || cityName.includes('HCM')) {
				cityName = 'Thành phố Hồ Chí Minh';
			} else if (cityName.includes('Hà Nội')) {
				cityName = 'Thành phố Hà Nội';
			}
		} else {
			cityName = 'Thành phố Hồ Chí Minh';
			districtName = parts[0] || 'Quận 1';
		}
	} else {
		cityName = province || addressData?.city || 'Thành phố Hồ Chí Minh';
		districtName = district || addressData?.district;
	}

	const { ward } = addressData || {};

	// Find province (city) - search exactly in database
	let provinceRecord = await prisma.province.findFirst({
		where: {
			OR: [
				{ name: { equals: cityName, mode: 'insensitive' } },
				{ name: { contains: 'Hồ Chí Minh', mode: 'insensitive' } },
				{ name: { contains: 'Hà Nội', mode: 'insensitive' } },
			],
		},
	});

	// If not found and it's HCM, try different variations
	if (!provinceRecord && cityName.includes('Hồ Chí Minh')) {
		provinceRecord = await prisma.province.findFirst({
			where: {
				OR: [
					{ name: { contains: 'Hồ Chí Minh', mode: 'insensitive' } },
					{ name: { contains: 'Ho Chi Minh', mode: 'insensitive' } },
					{ code: '79' }, // HCM province code
				],
			},
		});
	}

	if (!provinceRecord) {
		// Create province if not exists
		const provinceCode = randomUUID().slice(0, 6);
		provinceRecord = await prisma.province.create({
			data: {
				code: provinceCode,
				name: cityName,
				nameEn: cityName === 'Thành phố Hồ Chí Minh' ? 'Ho Chi Minh City' : cityName,
			},
		});
	}

	// Find district with better matching
	let districtRecord = null;
	if (districtName && provinceRecord) {
		// Try exact match first
		districtRecord = await prisma.district.findFirst({
			where: {
				AND: [
					{ name: { equals: districtName, mode: 'insensitive' } },
					{ provinceId: provinceRecord.id },
				],
			},
		});

		// If not found, try partial match
		if (!districtRecord) {
			districtRecord = await prisma.district.findFirst({
				where: {
					AND: [
						{
							name: {
								contains: districtName.replace('Quận ', '').replace('Huyện ', ''),
								mode: 'insensitive',
							},
						},
						{ provinceId: provinceRecord.id },
					],
				},
			});
		}

		// Debug log
		if (!districtRecord) {
			console.log(`⚠️ District not found: ${districtName} in ${cityName}`);
		}
	}

	if (!districtRecord && districtName) {
		// Create district if not exists
		const districtCode = randomUUID().slice(0, 8);
		districtRecord = await prisma.district.create({
			data: {
				code: districtCode,
				name: districtName,
				provinceId: provinceRecord.id,
			},
		});
	}

	// Find ward if provided
	let wardRecord = null;
	if (ward && districtRecord) {
		wardRecord = await prisma.ward.findFirst({
			where: {
				AND: [{ name: { contains: ward, mode: 'insensitive' } }, { districtId: districtRecord.id }],
			},
		});

		if (!wardRecord) {
			// Create ward if not exists
			const wardCode = randomUUID().slice(0, 8);
			wardRecord = await prisma.ward.create({
				data: {
					code: wardCode,
					name: ward,
					level: ward.includes('Phường') ? 'Phường' : 'Xã',
					districtId: districtRecord.id,
				},
			});
		}
	}

	return {
		province: provinceRecord,
		district: districtRecord,
		ward: wardRecord,
	};
}

async function getRandomLandlord() {
	// Get existing landlord users (should be imported from default-users script)
	const landlords = await prisma.user.findMany({
		where: { role: 'landlord' },
		select: { id: true, firstName: true, lastName: true, email: true },
	});

	if (landlords.length === 0) {
		throw new Error(
			'No landlord users found. Please run: node scripts/import-default-users.js first',
		);
	}

	// Return random landlord
	const randomIndex = Math.floor(Math.random() * landlords.length);
	return landlords[randomIndex];
}

async function importCrawledData(filePath, limitRecords = null) {
	console.log('🚀 Bắt đầu import dữ liệu crawled...');

	try {
		// Read JSON file
		const rawData = fs.readFileSync(filePath, 'utf-8');
		let crawledData = JSON.parse(rawData);

		// Limit records if specified
		if (limitRecords && limitRecords > 0) {
			crawledData = crawledData.slice(0, limitRecords);
			console.log(`📊 Limiting to first ${limitRecords} records`);
		}

		console.log(`📊 Tổng số records: ${crawledData.length}`);

		// Get list of existing landlords
		const existingLandlords = await prisma.user.findMany({
			where: { role: 'landlord' },
			select: { id: true, firstName: true, lastName: true, email: true },
		});

		if (existingLandlords.length === 0) {
			console.log(
				'❌ No landlord users found. Please run: node scripts/import-default-users.js first',
			);
			process.exit(1);
		}

		console.log(`👥 Found ${existingLandlords.length} existing landlord users`);

		// Process data in batches
		const batchSize = 10;
		let processedCount = 0;
		let successCount = 0;
		let errorCount = 0;

		for (let i = 0; i < crawledData.length; i += batchSize) {
			const batch = crawledData.slice(i, i + batchSize);

			for (const item of batch) {
				try {
					// Extract location data from new crawled format
					const locationData = await findOrCreateLocation(
						{
							location: item.location, // "Gò Vấp, Hồ Chí Minh"
							ward: item.ward || item.full_address_normalized?.ward, // "Phườdng 5"
							district: item.district || item.full_address_normalized?.district, // "Quận Gò Vấp"
							city: item.province || item.full_address_normalized?.city, // "Hồ Chí Minh"
							full_address: item.full_address,
						},
						null,
						null,
					);

					// Get random landlord for this building
					const randomLandlord =
						existingLandlords[Math.floor(Math.random() * existingLandlords.length)];

					// Create building
					const buildingSlug = generateSlug(
						`${item.poster_full_name}-${locationData.district.name}`,
					);

					let building = await prisma.building.findUnique({
						where: { slug: buildingSlug },
					});

					if (!building) {
						building = await prisma.building.create({
							data: {
								id: buildingSlug,
								slug: buildingSlug,
								ownerId: randomLandlord.id,
								name: `Nhà trọ ${item.poster_full_name}`,
								description: `Nhà trọ được quản lý bởi ${randomLandlord.firstName} ${randomLandlord.lastName}`,
								addressLine1:
									item.full_address_normalized?.street_name ||
									item.full_address_normalized?.components?.[0] ||
									item.full_address,
								addressLine2: item.full_address_normalized?.street_number,
								wardId: locationData.ward?.id,
								districtId: locationData.district.id,
								provinceId: locationData.province.id,
								latitude: item.latitude || item.coordinates?.latitude,
								longitude: item.longitude || item.coordinates?.longitude,
								isActive: true,
								isVerified: false,
							},
						});

						console.log(
							`🏢 Building assigned to: ${randomLandlord.firstName} ${randomLandlord.lastName} (${randomLandlord.email})`,
						);
					}

					// No need to create floor - Room connects directly to Building

					// Create room
					const roomNumber = extractRoomNumber(item.full_address, item.title, building.id);
					const roomSlug = `${buildingSlug}-phong-${roomNumber}`;
					const roomType = determineRoomType(item.title, item.description);

					// Check if room already exists
					const existingRoom = await prisma.room.findUnique({
						where: { slug: roomSlug },
					});

					if (existingRoom) {
						console.log(`⚠️ Room ${roomSlug} đã tồn tại, bỏ qua...`);
						processedCount++;
						continue;
					}

					// Extract area from crawled data or estimate based on price
					const extractAreaSqm = (areaString) => {
						if (!areaString) return null;
						// Extract number from strings like "20m²", "18m²", "45m²"
						const match = areaString.match(/(\d+(?:\.\d+)?)/);
						return match ? parseFloat(match[1]) : null;
					};

					const estimateAreaFromPrice = (price, roomType) => {
						// Estimate area based on price and room type
						// These are reasonable estimates for Vietnam market
						const pricePerSqm = {
							boarding_house: 150000, // 150k VND per sqm for nhà trọ
							dormitory: 100000, // 100k VND per sqm for ký túc xá
							apartment: 250000, // 250k VND per sqm for apartment
							whole_house: 200000, // 200k VND per sqm for whole house
							sleepbox: 80000, // 80k VND per sqm for sleepbox
						};

						const ratePerSqm = pricePerSqm[roomType] || pricePerSqm['boarding_house'];
						const estimatedArea = Math.round(price / ratePerSqm);

						// Apply reasonable bounds based on room type
						const bounds = {
							boarding_house: { min: 12, max: 35 },
							dormitory: { min: 8, max: 20 },
							apartment: { min: 20, max: 80 },
							whole_house: { min: 40, max: 150 },
							sleepbox: { min: 6, max: 15 },
						};

						const { min, max } = bounds[roomType] || bounds['boarding_house'];
						return Math.max(min, Math.min(max, estimatedArea));
					};

					let areaSqm = extractAreaSqm(item.official_area || item.area);

					// If no area data found, estimate from price
					if (!areaSqm) {
						const priceNumeric =
							item.price_numeric || item.official_price_normalized?.price_numeric || 0;
						if (priceNumeric > 0) {
							areaSqm = estimateAreaFromPrice(priceNumeric, roomType);
							console.log(
								`   📐 Estimated area: ${areaSqm}m² (price: ${priceNumeric.toLocaleString()} VND)`,
							);
						}
					}

					// Create room type (not individual room)
					const room = await prisma.room.create({
						data: {
							id: roomSlug,
							slug: roomSlug,
							buildingId: building.id,
							floorNumber: 1, // Default floor number
							name: item.title,
							description: item.detailed_description || item.description,
							roomType: roomType,
							areaSqm: areaSqm, // Add area data
							maxOccupancy: roomType === 'dormitory' ? 4 : 2,
							totalRooms: 1, // Default 1 room of this type
							isActive: true,
							isVerified: false,
						},
					});

					// Create room instance with new status field
					const roomInstance = await prisma.roomInstance.create({
						data: {
							roomId: room.id,
							roomNumber: roomNumber,
							status: 'available', // Use new status field
							isActive: true,
						},
					});

					// Create room pricing - Use new price_numeric field (more reliable)
					const priceNumeric =
						item.price_numeric || item.official_price_normalized?.price_numeric || 0;
					// Price should already be in correct VND format from new crawl data
					const actualPrice = priceNumeric;

					await prisma.roomPricing.create({
						data: {
							roomId: room.id,
							basePriceMonthly: actualPrice,
							currency: item.official_price_normalized?.currency || 'VND',
							depositAmount: actualPrice, // Default 1 month deposit
							depositMonths: 1,
							utilityIncluded:
								item.description.toLowerCase().includes('bao điện') ||
								item.description.toLowerCase().includes('bao nước'),
							minimumStayMonths: 1,
							priceNegotiable:
								item.description.toLowerCase().includes('thương lượng') ||
								item.description.toLowerCase().includes('tl'),
						},
					});

					// Create room images - Handle both single image_url and images array
					const imagesToProcess = [];

					// Check if images array exists (new format)
					if (item.images && Array.isArray(item.images) && item.images.length > 0) {
						imagesToProcess.push(...item.images);
					} else if (item.main_image) {
						// Use main_image as fallback
						imagesToProcess.push(item.main_image);
					} else if (item.image_url) {
						// Use legacy image_url as last resort
						imagesToProcess.push(item.image_url);
					}

					// Create image records
					for (let i = 0; i < Math.min(imagesToProcess.length, 20); i++) {
						// Limit to 20 images
						const imageUrl = imagesToProcess[i];
						if (imageUrl && imageUrl.startsWith('http')) {
							await prisma.roomImage.create({
								data: {
									roomId: room.id,
									imageUrl: imageUrl,
									altText: item.title,
									sortOrder: i,
									isPrimary: i === 0, // First image is primary
								},
							});
						}
					}

					// Enhanced intelligent amenities, cost types, and room rules mapping
					// Pass amenities array directly from new crawl data structure
					const enhancedItem = {
						...item,
						amenities: item.amenities || [], // New crawl data has amenities array
					};
					await applyIntelligentReferences(room.id, enhancedItem, actualPrice);

					successCount++;
					console.log(`✅ Imported room: ${room.slug}`);
				} catch (error) {
					errorCount++;
					console.error(`❌ Error importing item ${item.id}:`, error);
				}

				processedCount++;

				if (processedCount % 50 === 0) {
					console.log(
						`📊 Progress: ${processedCount}/${crawledData.length} (${successCount} success, ${errorCount} errors)`,
					);
				}
			}
		}

		console.log('\n🎉 Import completed!');
		console.log(`📊 Final stats:`);
		console.log(`   - Total processed: ${processedCount}`);
		console.log(`   - Successful: ${successCount}`);
		console.log(`   - Errors: ${errorCount}`);
		console.log(`   - Success rate: ${((successCount / processedCount) * 100).toFixed(2)}%`);
	} catch (error) {
		console.error('❌ Import failed:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Utility function to clean and validate JSON file
async function validateCrawledData(filePath) {
	console.log('🔍 Validating crawled data...');

	try {
		const rawData = fs.readFileSync(filePath, 'utf-8');
		const data = JSON.parse(rawData);

		console.log(`📊 Total records: ${data.length}`);

		// Validate required fields - Updated for new data structure
		const requiredFields = ['id', 'title', 'poster_full_name'];

		// Optional fields that should be present in new format
		const optionalFields = [
			'full_address',
			'full_address_normalized',
			'official_price_normalized',
			'price_numeric',
			'province',
			'district',
			'ward',
			'amenities',
			'images',
		];

		let validRecords = 0;
		let invalidRecords = 0;

		for (const item of data) {
			const missingFields = requiredFields.filter((field) => !item[field]);

			// Check if has at least some price information
			const hasPriceInfo =
				item.price_numeric || item.official_price_normalized?.price_numeric || item.price;

			// Check if has location info - updated for new structure
			const hasLocationInfo =
				(item.province && item.district) ||
				item.full_address_normalized?.district ||
				item.location ||
				item.full_address;

			if (missingFields.length === 0 && hasPriceInfo && hasLocationInfo) {
				validRecords++;
			} else {
				invalidRecords++;
				const issues = [];
				if (missingFields.length > 0) issues.push(`Missing: ${missingFields.join(', ')}`);
				if (!hasPriceInfo) issues.push('No price information');
				if (!hasLocationInfo) issues.push('No location information');
				console.warn(`⚠️ Record ${item.id} issues:`, issues.join('; '));
			}
		}

		console.log(`✅ Valid records: ${validRecords}`);
		console.log(`❌ Invalid records: ${invalidRecords}`);
		console.log(`📊 Validation rate: ${((validRecords / data.length) * 100).toFixed(2)}%`);

		return validRecords > 0;
	} catch (error) {
		console.error('❌ Validation failed:', error);
		return false;
	}
}

// Main execution
if (require.main === module) {
	const args = process.argv.slice(2);
	const command = args[0] || 'import';
	const filePath = args[1] || path.join(__dirname, 'data', 'crawled_rooms.json');

	if (command === 'validate') {
		validateCrawledData(filePath).catch(console.error);
	} else if (command === 'import-sample') {
		// Import sample data (100 records)
		console.log('📦 Importing sample data (100 records)...');
		validateCrawledData(filePath)
			.then((isValid) => {
				if (isValid) {
					return importCrawledData(filePath, 100);
				} else {
					console.error('❌ Data validation failed, stopping import');
					process.exit(1);
				}
			})
			.catch(console.error);
	} else if (command === 'import') {
		// Validate first, then import all
		validateCrawledData(filePath)
			.then((isValid) => {
				if (isValid) {
					return importCrawledData(filePath);
				} else {
					console.error('❌ Data validation failed, stopping import');
					process.exit(1);
				}
			})
			.catch(console.error);
	} else {
		console.log('Usage:');
		console.log('  node crawl-import.js validate [file-path]');
		console.log('  node crawl-import.js import-sample [file-path]  - Import first 100 records');
		console.log('  node crawl-import.js import [file-path]         - Import all records');
	}
}

module.exports = { importCrawledData, validateCrawledData };
