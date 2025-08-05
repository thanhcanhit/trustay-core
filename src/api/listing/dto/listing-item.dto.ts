import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';

export class LocationDto {
	@ApiProperty()
	province: {
		id: number;
		name: string;
		code: string;
	};

	@ApiProperty()
	district: {
		id: number;
		name: string;
		code: string;
	};

	@ApiPropertyOptional()
	ward?: {
		id: number;
		name: string;
		code: string;
	};
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

export class BuildingDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	addressLine1: string;

	@ApiPropertyOptional()
	addressLine2?: string;

	@ApiPropertyOptional()
	latitude?: string;

	@ApiPropertyOptional()
	longitude?: string;

	@ApiProperty()
	isVerified: boolean;

	@ApiProperty({ type: BuildingOwnerDto })
	owner: BuildingOwnerDto;

	@ApiProperty({ type: LocationDto })
	location: LocationDto;
}

export class FloorDto {
	@ApiProperty()
	floorNumber: number;

	@ApiProperty({ type: BuildingDto })
	building: BuildingDto;
}

export class RoomImageDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	imageUrl: string;

	@ApiPropertyOptional()
	altText?: string;

	@ApiProperty()
	sortOrder: number;

	@ApiProperty()
	isPrimary: boolean;
}

export class SystemAmenityDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	nameEn: string;

	@ApiProperty()
	category: string;

	@ApiPropertyOptional()
	iconUrl?: string;
}

export class RoomAmenityDto {
	@ApiProperty()
	id: string;

	@ApiPropertyOptional()
	customValue?: string;

	@ApiPropertyOptional()
	notes?: string;

	@ApiProperty({ type: SystemAmenityDto })
	systemAmenity: SystemAmenityDto;
}

export class SystemCostTypeDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	nameEn: string;

	@ApiProperty()
	category: string;

	@ApiPropertyOptional()
	defaultUnit?: string;
}

export class RoomCostDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	baseRate: string;

	@ApiProperty()
	currency: string;

	@ApiPropertyOptional()
	notes?: string;

	@ApiProperty({ type: SystemCostTypeDto })
	systemCostType: SystemCostTypeDto;
}

export class RoomPricingDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	basePriceMonthly: string;

	@ApiProperty()
	currency: string;

	@ApiProperty()
	depositAmount: string;

	@ApiProperty()
	depositMonths: number;

	@ApiProperty()
	utilityIncluded: boolean;

	@ApiPropertyOptional()
	utilityCostMonthly?: string;

	@ApiPropertyOptional()
	cleaningFee?: string;

	@ApiPropertyOptional()
	serviceFeePercentage?: string;

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
	ruleType: string;

	@ApiProperty()
	ruleText: string;
}

export class ListingItemDto {
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
	isVerified: boolean;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;

	@ApiProperty({ type: FloorDto })
	floor: FloorDto;

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
