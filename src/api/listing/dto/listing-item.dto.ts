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
}

export class RoomCostDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	value: string;
}

export class RoomPricingDto {
	@ApiProperty()
	basePriceMonthly: string;

	@ApiProperty()
	depositAmount: string;

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
}

export class ListingItemDto {
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
	address: string;

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
