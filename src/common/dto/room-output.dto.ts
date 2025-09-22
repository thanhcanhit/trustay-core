import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';

/**
 * Common owner information DTO used across different room endpoints
 */
export class RoomOwnerOutputDto {
	@ApiProperty({ description: 'Owner ID' })
	id: string;
	@ApiProperty({ description: 'Owner full name (masked if not authenticated)' })
	name: string;

	@ApiPropertyOptional({ description: 'Owner avatar URL' })
	avatarUrl?: string;

	@ApiPropertyOptional({ description: 'Owner gender' })
	gender?: string;

	@ApiProperty({ description: 'Owner email (masked if not authenticated)' })
	email: string;

	@ApiProperty({ description: 'Owner phone (masked if not authenticated)' })
	phone: string;

	@ApiProperty({ description: 'Whether phone is verified' })
	verifiedPhone: boolean;

	@ApiProperty({ description: 'Whether email is verified' })
	verifiedEmail: boolean;

	@ApiProperty({ description: 'Whether identity is verified' })
	verifiedIdentity: boolean;

	@ApiProperty({ description: 'Total number of buildings owned' })
	totalBuildings: number;

	@ApiProperty({ description: 'Total number of room instances owned' })
	totalRoomInstances: number;
}

/**
 * Common location information DTO used across different room endpoints
 */
export class RoomLocationOutputDto {
	@ApiProperty({ description: 'Province ID' })
	provinceId: number;

	@ApiProperty({ description: 'Province name' })
	provinceName: string;

	@ApiProperty({ description: 'District ID' })
	districtId: number;

	@ApiProperty({ description: 'District name' })
	districtName: string;

	@ApiPropertyOptional({ description: 'Ward ID' })
	wardId?: number;

	@ApiPropertyOptional({ description: 'Ward name' })
	wardName?: string;
}

/**
 * Common room image DTO used across different room endpoints
 */
export class RoomImageOutputDto {
	@ApiProperty({ description: 'Image URL' })
	url: string;

	@ApiPropertyOptional({ description: 'Image alt text' })
	alt?: string;

	@ApiProperty({ description: 'Whether this is the primary image' })
	isPrimary: boolean;

	@ApiProperty({ description: 'Image sort order' })
	sortOrder: number;
}

/**
 * Common amenity information DTO used across different room endpoints
 */
export class RoomAmenityOutputDto {
	@ApiProperty({ description: 'System amenity ID' })
	id: string;

	@ApiProperty({ description: 'Amenity name' })
	name: string;

	@ApiProperty({ description: 'Amenity category' })
	category: string;

	@ApiPropertyOptional({ description: 'Custom value for this amenity' })
	customValue?: string;

	@ApiPropertyOptional({ description: 'Additional notes' })
	notes?: string;
}

/**
 * Common cost information DTO used across different room endpoints
 */
export class RoomCostOutputDto {
	@ApiProperty({ description: 'System cost type ID' })
	id: string;

	@ApiProperty({ description: 'Cost type name' })
	name: string;

	@ApiProperty({ description: 'Cost value as string' })
	value: string;

	@ApiProperty({ description: 'Cost category' })
	category: string;

	@ApiPropertyOptional({ description: 'Additional notes' })
	notes?: string;
}

/**
 * Common pricing information DTO used across different room endpoints
 */
export class RoomPricingOutputDto {
	@ApiPropertyOptional({ description: 'Base monthly price as string' })
	basePriceMonthly?: string;

	@ApiPropertyOptional({ description: 'Deposit amount as string' })
	depositAmount?: string;

	@ApiProperty({ description: 'Whether utilities are included' })
	utilityIncluded: boolean;
}

/**
 * Common rule information DTO used across different room endpoints
 */
export class RoomRuleOutputDto {
	@ApiProperty({ description: 'System rule ID' })
	id: string;

	@ApiProperty({ description: 'Rule name' })
	name: string;

	@ApiProperty({ description: 'Rule type' })
	type: string;

	@ApiPropertyOptional({ description: 'Custom value for this rule' })
	customValue?: string;

	@ApiPropertyOptional({ description: 'Additional notes' })
	notes?: string;

	@ApiPropertyOptional({ description: 'Whether rule is enforced' })
	isEnforced?: boolean;
}

/**
 * Base room information DTO - common fields used in both list and detail views
 */
export class BaseRoomOutputDto {
	@ApiProperty({ description: 'Room ID' })
	id: string;

	@ApiProperty({ description: 'Room slug' })
	slug: string;

	@ApiPropertyOptional({ description: 'Room name' })
	name?: string;

	@ApiProperty({ enum: RoomType, description: 'Room type' })
	roomType: RoomType;

	@ApiPropertyOptional({ description: 'Room area in square meters' })
	areaSqm?: string;

	@ApiProperty({ description: 'Maximum occupancy' })
	maxOccupancy: number;

	@ApiProperty({ description: 'Whether room is verified' })
	isVerified: boolean;

	@ApiProperty({ description: 'Building name' })
	buildingName: string;

	@ApiProperty({ description: 'Whether building is verified' })
	buildingVerified: boolean;

	@ApiProperty({ description: 'Address (masked if not authenticated)' })
	address: string;

	@ApiProperty({ description: 'Number of available room instances' })
	availableRooms: number;

	@ApiProperty({ type: RoomOwnerOutputDto, description: 'Owner information' })
	owner: RoomOwnerOutputDto;

	@ApiProperty({ type: RoomLocationOutputDto, description: 'Location information' })
	location: RoomLocationOutputDto;
}

/**
 * Room list item DTO - used for listing endpoints (search, browse, etc.)
 */
export class RoomListItemOutputDto extends BaseRoomOutputDto {
	@ApiProperty({ type: [RoomImageOutputDto], description: 'Room images (limited)' })
	images: RoomImageOutputDto[];

	@ApiProperty({ type: [RoomAmenityOutputDto], description: 'Room amenities (basic info)' })
	amenities: RoomAmenityOutputDto[];

	@ApiProperty({ type: [RoomCostOutputDto], description: 'Room costs (basic info)' })
	costs: RoomCostOutputDto[];

	@ApiPropertyOptional({ type: RoomPricingOutputDto, description: 'Pricing information' })
	pricing?: RoomPricingOutputDto;

	@ApiProperty({ type: [RoomRuleOutputDto], description: 'Room rules (basic info)' })
	rules: RoomRuleOutputDto[];

	@ApiPropertyOptional({ description: 'Distance from search point (if provided)' })
	distance?: number;
}

/**
 * Room detail DTO - used for detailed view endpoints
 * Extends list item with additional fields that are only needed in detail view
 */
export class RoomDetailOutputDto extends BaseRoomOutputDto {
	@ApiProperty({ type: [RoomImageOutputDto], description: 'All room images' })
	images: RoomImageOutputDto[];

	@ApiProperty({ type: [RoomAmenityOutputDto], description: 'All room amenities with details' })
	amenities: RoomAmenityOutputDto[];

	@ApiProperty({ type: [RoomCostOutputDto], description: 'All room costs with details' })
	costs: RoomCostOutputDto[];

	@ApiPropertyOptional({ type: RoomPricingOutputDto, description: 'Complete pricing information' })
	pricing?: RoomPricingOutputDto;

	@ApiProperty({ type: [RoomRuleOutputDto], description: 'All room rules with details' })
	rules: RoomRuleOutputDto[];

	// Additional fields only needed in detail view
	@ApiPropertyOptional({ description: 'Room description' })
	description?: string;

	@ApiPropertyOptional({ description: 'Floor number' })
	floorNumber?: number;

	@ApiProperty({ description: 'Total number of room instances' })
	totalRooms: number;

	@ApiProperty({ description: 'Whether room is active' })
	isActive: boolean;

	@ApiPropertyOptional({ description: 'Building description' })
	buildingDescription?: string;

	@ApiPropertyOptional({ description: 'Secondary address line' })
	addressLine2?: string;

	@ApiPropertyOptional({ description: 'Latitude coordinate' })
	latitude?: string;

	@ApiPropertyOptional({ description: 'Longitude coordinate' })
	longitude?: string;

	@ApiProperty({ description: 'Number of views' })
	viewCount: number;

	@ApiProperty({ description: 'Last updated timestamp' })
	lastUpdated: Date;
}
