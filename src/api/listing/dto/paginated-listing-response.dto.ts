import { ApiProperty } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';

export interface LocationDto {
	province: {
		id: number;
		name: string;
		code: string;
	};
	district: {
		id: number;
		name: string;
		code: string;
	};
	ward?: {
		id: number;
		name: string;
		code: string;
	};
}

export interface BuildingOwnerDto {
	id: string;
	firstName: string;
	lastName: string;
	phone?: string;
	isVerifiedPhone: boolean;
	isVerifiedEmail: boolean;
	isVerifiedIdentity: boolean;
}

export interface BuildingDto {
	id: string;
	name: string;
	description?: string;
	addressLine1: string;
	addressLine2?: string;
	latitude?: string;
	longitude?: string;
	isVerified: boolean;
	owner: BuildingOwnerDto;
	location: LocationDto;
}

export interface FloorDto {
	floorNumber: number;
	building: BuildingDto;
}

export interface RoomImageDto {
	id: string;
	imageUrl: string;
	altText?: string;
	sortOrder: number;
	isPrimary: boolean;
}

export interface SystemAmenityDto {
	id: string;
	name: string;
	nameEn: string;
	category: string;
	iconUrl?: string;
}

export interface RoomAmenityDto {
	id: string;
	customValue?: string;
	notes?: string;
	systemAmenity: SystemAmenityDto;
}

export interface SystemCostTypeDto {
	id: string;
	name: string;
	nameEn: string;
	category: string;
	defaultUnit?: string;
}

export interface RoomCostDto {
	id: string;
	baseRate: string;
	currency: string;
	notes?: string;
	systemCostType: SystemCostTypeDto;
}

export interface RoomPricingDto {
	id: string;
	basePriceMonthly: string;
	currency: string;
	depositAmount: string;
	depositMonths: number;
	utilityIncluded: boolean;
	utilityCostMonthly?: string;
	cleaningFee?: string;
	serviceFeePercentage?: string;
	minimumStayMonths: number;
	maximumStayMonths?: number;
	priceNegotiable: boolean;
}

export interface RoomRuleDto {
	id: string;
	ruleType: string;
	ruleText: string;
}

export interface ListingItemDto {
	id: string;
	slug: string;
	name?: string;
	description?: string;
	roomType: RoomType;
	areaSqm?: string;
	maxOccupancy: number;
	isVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
	floor: FloorDto;
	images: RoomImageDto[];
	amenities: RoomAmenityDto[];
	costs: RoomCostDto[];
	pricing?: RoomPricingDto;
	rules: RoomRuleDto[];
}

export interface PaginationMetaDto {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface PaginatedListingResponseDto {
	data: ListingItemDto[];
	meta: PaginationMetaDto;
}
