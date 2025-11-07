import {
	BaseRoomOutputDto,
	RoomAmenityOutputDto,
	RoomCostOutputDto,
	RoomDetailOutputDto,
	RoomImageOutputDto,
	RoomListItemOutputDto,
	RoomLocationOutputDto,
	RoomOwnerOutputDto,
	RoomPricingOutputDto,
	RoomRuleOutputDto,
} from '../dto/room-output.dto';
import { maskEmail, maskFullName, maskPhone, maskText } from './mask.utils';

/**
 * Helper function to calculate owner statistics
 * This function should be called from the service layer with proper Prisma client
 */
export async function getOwnerStats(
	prisma: any,
	ownerId: string,
): Promise<{ totalBuildings: number; totalRoomInstances: number }> {
	const [totalBuildings, totalRoomInstances] = await Promise.all([
		prisma.building.count({
			where: {
				ownerId,
				isActive: true,
			},
		}),
		prisma.roomInstance.count({
			where: {
				room: {
					building: {
						ownerId,
					},
				},
				isActive: true,
			},
		}),
	]);

	return { totalBuildings, totalRoomInstances };
}

/**
 * Transform owner data based on authentication status
 */
export function formatRoomOwner(
	owner: any,
	isAuthenticated: boolean,
	stats?: { totalBuildings: number; totalRoomInstances: number },
): RoomOwnerOutputDto {
	const fullName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim();

	return {
		id: owner.id,
		name: isAuthenticated ? fullName : maskFullName(fullName),
		avatarUrl: owner.avatarUrl || undefined,
		gender: owner.gender || undefined,
		email:
			owner.email !== undefined
				? isAuthenticated
					? owner.email || ''
					: maskEmail(owner.email || '')
				: '',
		phone:
			owner.phone !== undefined
				? isAuthenticated
					? owner.phone || ''
					: maskPhone(owner.phone || '')
				: '',
		verifiedPhone: owner.isVerifiedPhone,
		verifiedEmail: owner.isVerifiedEmail,
		verifiedIdentity: owner.isVerifiedIdentity,
		totalBuildings: stats?.totalBuildings || 0,
		totalRoomInstances: stats?.totalRoomInstances || 0,
	};
}

/**
 * Transform location data
 */
export function formatRoomLocation(location: any): RoomLocationOutputDto {
	return {
		provinceId: location.province.id,
		provinceName: location.province.name,
		districtId: location.district.id,
		districtName: location.district.name,
		wardId: location.ward?.id,
		wardName: location.ward?.name,
	};
}

/**
 * Transform image data
 */
export function formatRoomImages(images: any[]): RoomImageOutputDto[] {
	return images.map((image) => ({
		url: image.imageUrl,
		alt: image.altText,
		isPrimary: image.isPrimary,
		sortOrder: image.sortOrder,
	}));
}

/**
 * Transform amenity data
 */
export function formatRoomAmenities(
	amenities: any[],
	includeDetails: boolean = false,
): RoomAmenityOutputDto[] {
	return amenities.map((amenity) => ({
		id: amenity.amenity.id,
		name: amenity.amenity.name,
		category: amenity.amenity.category,
		...(includeDetails && {
			customValue: amenity.customValue,
			notes: amenity.notes,
		}),
	}));
}

/**
 * Transform cost data
 */
export function formatRoomCosts(
	costs: any[],
	includeDetails: boolean = false,
): RoomCostOutputDto[] {
	return costs.map((cost) => {
		// Get the correct value based on costType
		let value: string = '0';
		const costType = cost.costType || 'fixed';

		if (costType === 'fixed') {
			value = cost.fixedAmount?.toString() || '0';
		} else if (costType === 'per_person') {
			value = cost.perPersonAmount?.toString() || '0';
		} else if (costType === 'metered') {
			value = cost.unitPrice?.toString() || '0';
		}

		return {
			id: cost.costTypeTemplate.id,
			name: cost.costTypeTemplate.name,
			value,
			category: cost.costTypeTemplate.category,
			...(includeDetails && {
				notes: cost.notes,
			}),
		};
	});
}

/**
 * Transform pricing data
 */
export function formatRoomPricing(pricing: any): RoomPricingOutputDto | undefined {
	if (!pricing) {
		return undefined;
	}

	return {
		basePriceMonthly:
			pricing.basePriceMonthly != null ? pricing.basePriceMonthly.toString() : undefined,
		depositAmount: pricing.depositAmount != null ? pricing.depositAmount.toString() : undefined,
		utilityIncluded: pricing.utilityIncluded,
	};
}

/**
 * Transform rule data
 */
export function formatRoomRules(
	rules: any[],
	includeDetails: boolean = false,
): RoomRuleOutputDto[] {
	return rules.map((rule) => ({
		id: rule.ruleTemplate.id,
		name: rule.customValue || rule.ruleTemplate.name,
		type: rule.ruleTemplate.ruleType,
		...(includeDetails && {
			customValue: rule.customValue,
			notes: rule.notes,
			isEnforced: rule.isEnforced,
		}),
	}));
}

/**
 * Transform base room data (common fields for both list and detail)
 */
export function formatBaseRoom(
	room: any,
	isAuthenticated: boolean,
	ownerStats?: { totalBuildings: number; totalRoomInstances: number },
): BaseRoomOutputDto {
	return {
		id: room.id,
		slug: room.slug,
		name: room.name || undefined,
		roomType: room.roomType,
		areaSqm: room.areaSqm ? room.areaSqm.toString() : undefined,
		maxOccupancy: room.maxOccupancy,
		isVerified: room.isVerified,
		buildingName: room.building.name || '',
		buildingVerified: room.building.isVerified,
		address: isAuthenticated
			? room.building.addressLine1 || ''
			: room.building.addressLine1
				? maskText(room.building.addressLine1, 2, 2)
				: '',
		availableRooms:
			room.roomInstances?.filter((instance: any) => instance.status === 'available').length || 0,
		owner: formatRoomOwner(room.building.owner, isAuthenticated, ownerStats),
		location: formatRoomLocation(room.building),
	};
}

/**
 * Transform room data for listing endpoints (search, browse, etc.)
 */
export function formatRoomListItem(
	room: any,
	isAuthenticated: boolean,
	options?: {
		includeDistance?: boolean;
		latitude?: number;
		longitude?: number;
		ownerStats?: { totalBuildings: number; totalRoomInstances: number };
	},
): RoomListItemOutputDto {
	const baseRoom = formatBaseRoom(room, isAuthenticated, options?.ownerStats);

	let distance: number | undefined;
	if (
		options?.includeDistance &&
		options.latitude &&
		options.longitude &&
		room.building.latitude &&
		room.building.longitude
	) {
		// Calculate distance using Haversine formula
		const lat1Rad = options.latitude * (Math.PI / 180);
		const lon1Rad = options.longitude * (Math.PI / 180);
		const lat2Rad = Number(room.building.latitude) * (Math.PI / 180);
		const lon2Rad = Number(room.building.longitude) * (Math.PI / 180);

		const dLat = lat2Rad - lat1Rad;
		const dLon = lon2Rad - lon1Rad;

		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		distance = Number((6371 * c).toFixed(2)); // Distance in km
	}

	return {
		...baseRoom,
		images: formatRoomImages(room.images || []),
		amenities: formatRoomAmenities(room.amenities || []),
		costs: formatRoomCosts(room.costs || []),
		pricing: formatRoomPricing(room.pricing),
		rules: formatRoomRules(room.rules || []),
		...(distance !== undefined && { distance }),
	};
}

/**
 * Transform room data for detail endpoints
 */
export function formatRoomDetail(
	room: any,
	isAuthenticated: boolean,
	ownerStats?: { totalBuildings: number; totalRoomInstances: number },
): RoomDetailOutputDto {
	const baseRoom = formatBaseRoom(room, isAuthenticated, ownerStats);

	return {
		...baseRoom,
		images: formatRoomImages(room.images || []),
		amenities: formatRoomAmenities(room.amenities || [], true), // Include details
		costs: formatRoomCosts(room.costs || [], true), // Include details
		pricing: formatRoomPricing(room.pricing),
		rules: formatRoomRules(room.rules || [], true), // Include details
		buildingId: room.building?.id || room.buildingId,

		// Additional detail-only fields
		description: room.description,
		floorNumber: room.floorNumber,
		totalRooms: room.totalRooms,
		isActive: room.isActive,
		buildingDescription: room.building.description,
		addressLine2: isAuthenticated
			? room.building.addressLine2 || undefined
			: room.building.addressLine2
				? maskText(room.building.addressLine2, 2, 2)
				: undefined,
		latitude: isAuthenticated ? room.building.latitude?.toString() || undefined : undefined,
		longitude: isAuthenticated ? room.building.longitude?.toString() || undefined : undefined,
		viewCount: room.viewCount || 0,
		lastUpdated: room.updatedAt,
	};
}
