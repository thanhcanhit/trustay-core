import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';

export class LocationDto {
	@ApiProperty()
	provinceId: number;

	@ApiProperty()
	provinceName: string;

	@ApiProperty()
	districtId: number;

	@ApiProperty()
	districtName: string;

	@ApiPropertyOptional()
	wardId?: number;

	@ApiPropertyOptional()
	wardName?: string;
}

export class BuildingOwnerDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	firstName: string;

	@ApiProperty()
	lastName: string;

	@ApiPropertyOptional()
	phone?: string;

	@ApiProperty()
	isVerifiedPhone: boolean;

	@ApiProperty()
	isVerifiedEmail: boolean;

	@ApiProperty()
	isVerifiedIdentity: boolean;
}

export class RoomImageDto {
	@ApiProperty()
	url: string;

	@ApiPropertyOptional()
	alt?: string;

	@ApiProperty()
	isPrimary: boolean;

	@ApiProperty()
	sortOrder: number;
}

export class RoomAmenityDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	category: string;

	@ApiPropertyOptional()
	customValue?: string;

	@ApiPropertyOptional()
	notes?: string;
}

export class RoomCostDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	value: string;

	@ApiProperty()
	category: string;

	@ApiPropertyOptional()
	notes?: string;
}

export class RoomPricingDto {
	@ApiProperty()
	basePriceMonthly: string;

	@ApiProperty()
	depositAmount: string;

	@ApiProperty()
	depositMonths: number;

	@ApiProperty()
	utilityIncluded: boolean;

	@ApiPropertyOptional()
	utilityCostMonthly?: string;

	@ApiProperty()
	minimumStayMonths: number;

	@ApiPropertyOptional()
	maximumStayMonths?: number;

	@ApiProperty()
	priceNegotiable: boolean;
}

export class RoomRuleDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	type: string;

	@ApiPropertyOptional()
	customValue?: string;

	@ApiPropertyOptional()
	notes?: string;

	@ApiProperty()
	isEnforced: boolean;
}

export class RoomInstanceDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	roomNumber: string;

	@ApiProperty()
	isOccupied: boolean;

	@ApiProperty()
	isActive: boolean;
}

export class RoomDetailDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	slug: string;

	@ApiPropertyOptional()
	name?: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty({ enum: RoomType })
	roomType: RoomType;

	@ApiPropertyOptional()
	areaSqm?: string;

	@ApiProperty()
	maxOccupancy: number;

	@ApiProperty()
	totalRooms: number;

	@ApiProperty()
	availableRooms: number;

	@ApiProperty()
	isVerified: boolean;

	@ApiProperty()
	isActive: boolean;

	@ApiPropertyOptional()
	floorNumber?: number;

	@ApiProperty()
	buildingName: string;

	@ApiPropertyOptional()
	buildingDescription?: string;

	@ApiProperty()
	address: string;

	@ApiPropertyOptional()
	addressLine2?: string;

	@ApiPropertyOptional()
	latitude?: string;

	@ApiPropertyOptional()
	longitude?: string;

	@ApiProperty({ type: LocationDto })
	location: LocationDto;

	@ApiProperty({ type: BuildingOwnerDto })
	owner: BuildingOwnerDto;

	@ApiProperty({ type: [RoomInstanceDto] })
	roomInstances: RoomInstanceDto[];

	@ApiProperty({ type: [RoomImageDto] })
	images: RoomImageDto[];

	@ApiProperty({ type: [RoomAmenityDto] })
	amenities: RoomAmenityDto[];

	@ApiProperty({ type: [RoomCostDto] })
	costs: RoomCostDto[];

	@ApiPropertyOptional({ type: RoomPricingDto })
	pricing?: RoomPricingDto;

	@ApiProperty({ type: [RoomRuleDto] })
	rules: RoomRuleDto[];

	@ApiProperty()
	lastUpdated: Date;
}
