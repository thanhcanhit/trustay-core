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
	name: string;

	@ApiPropertyOptional()
	avatarUrl?: string;

	@ApiPropertyOptional()
	gender?: string;

	@ApiProperty()
	verifiedPhone: boolean;

	@ApiProperty()
	verifiedEmail: boolean;

	@ApiProperty()
	verifiedIdentity: boolean;
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
	@ApiPropertyOptional()
	basePriceMonthly?: string;

	@ApiPropertyOptional()
	depositAmount?: string;

	@ApiProperty()
	utilityIncluded: boolean;
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

	@ApiProperty({ enum: RoomType })
	roomType: RoomType;

	@ApiPropertyOptional()
	areaSqm?: string;

	@ApiProperty()
	maxOccupancy: number;

	@ApiProperty()
	isVerified: boolean;

	@ApiProperty()
	buildingName: string;

	@ApiProperty()
	buildingVerified: boolean;

	@ApiProperty()
	address: string;

	@ApiProperty()
	availableRooms: number;

	@ApiProperty({ type: BuildingOwnerDto })
	owner: BuildingOwnerDto;

	@ApiProperty({ type: LocationDto })
	location: LocationDto;

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
}
