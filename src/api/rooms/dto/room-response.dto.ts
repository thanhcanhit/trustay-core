import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus, RoomType } from '@prisma/client';
import { Expose, Transform, Type } from 'class-transformer';

export class RoomPricingResponseDto {
	@ApiProperty({ example: 3500000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : 0))
	basePriceMonthly: number;

	@ApiProperty({ example: 7000000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : 0))
	depositAmount: number;

	@ApiProperty({ example: 2 })
	@Expose()
	depositMonths: number;

	@ApiProperty({ example: false })
	@Expose()
	utilityIncluded: boolean;

	@ApiPropertyOptional({ example: 500000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	utilityCostMonthly?: number;

	@ApiPropertyOptional({ example: 200000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	cleaningFee?: number;

	@ApiPropertyOptional({ example: 5.0 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	serviceFeePercentage?: number;

	@ApiProperty({ example: 3 })
	@Expose()
	minimumStayMonths: number;

	@ApiPropertyOptional({ example: 12 })
	@Expose()
	maximumStayMonths?: number;

	@ApiProperty({ example: true })
	@Expose()
	priceNegotiable: boolean;
}

export class RoomAmenityResponseDto {
	@ApiProperty({ example: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'Điều hòa' })
	@Expose()
	@Transform(({ obj }) => obj.systemAmenity?.name)
	name: string;

	@ApiProperty({ example: 'Air conditioning' })
	@Expose()
	@Transform(({ obj }) => obj.systemAmenity?.nameEn)
	nameEn: string;

	@ApiProperty({ example: 'basic' })
	@Expose()
	@Transform(({ obj }) => obj.systemAmenity?.category)
	category: string;

	@ApiPropertyOptional({ example: '2 chiếc' })
	@Expose()
	customValue?: string;

	@ApiPropertyOptional({ example: 'Điều hòa mới' })
	@Expose()
	notes?: string;
}

export class RoomCostResponseDto {
	@ApiProperty({ example: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'Internet' })
	@Expose()
	@Transform(({ obj }) => obj.systemCostType?.name)
	name: string;

	@ApiProperty({ example: 'internet' })
	@Expose()
	@Transform(({ obj }) => obj.systemCostType?.nameEn)
	nameEn: string;

	@ApiProperty({ example: 'service' })
	@Expose()
	@Transform(({ obj }) => obj.systemCostType?.category)
	category: string;

	@ApiProperty({ example: 'fixed' })
	@Expose()
	costType: string;

	@ApiPropertyOptional({ example: 50000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	baseRate?: number;

	@ApiPropertyOptional({ example: 3500 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	unitPrice?: number;

	@ApiPropertyOptional({ example: 100000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	fixedAmount?: number;

	@ApiPropertyOptional({ example: 'kWh' })
	@Expose()
	unit?: string;

	@ApiPropertyOptional({ example: 50000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	minimumCharge?: number;

	@ApiPropertyOptional({ example: 500000 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : null))
	maximumCharge?: number;

	@ApiProperty({ example: false })
	@Expose()
	isMetered: boolean;

	@ApiProperty({ example: 'monthly' })
	@Expose()
	billingCycle: string;

	@ApiProperty({ example: false })
	@Expose()
	includedInRent: boolean;

	@ApiProperty({ example: false })
	@Expose()
	isOptional: boolean;

	@ApiPropertyOptional({ example: 'Tốc độ cao' })
	@Expose()
	notes?: string;
}

export class RoomRuleResponseDto {
	@ApiProperty({ example: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'Không hút thuốc' })
	@Expose()
	@Transform(({ obj }) => obj.systemRule?.name)
	name: string;

	@ApiProperty({ example: 'No smoking' })
	@Expose()
	@Transform(({ obj }) => obj.systemRule?.nameEn)
	nameEn: string;

	@ApiProperty({ example: 'smoking' })
	@Expose()
	@Transform(({ obj }) => obj.systemRule?.category)
	category: string;

	@ApiProperty({ example: 'forbidden' })
	@Expose()
	@Transform(({ obj }) => obj.systemRule?.ruleType)
	ruleType: string;

	@ApiPropertyOptional({ example: 'Sau 22h00' })
	@Expose()
	customValue?: string;

	@ApiProperty({ example: true })
	@Expose()
	isEnforced: boolean;

	@ApiPropertyOptional({ example: 'Áp dụng tất cả các ngày' })
	@Expose()
	notes?: string;
}

export class RoomInstanceResponseDto {
	@ApiProperty({ example: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'A101' })
	@Expose()
	roomNumber: string;

	@ApiProperty({ enum: RoomStatus, example: 'available' })
	@Expose()
	status: RoomStatus;

	@ApiProperty({ example: true })
	@Expose()
	isActive: boolean;

	@ApiPropertyOptional({ example: 'Phòng góc, view đẹp' })
	@Expose()
	notes?: string;

	@ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
	@Expose()
	createdAt: Date;
}

export class BuildingBasicInfoDto {
	@ApiProperty({ example: 'nha-tro-minh-phat-quan-1' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'Nhà trọ Minh Phát' })
	@Expose()
	name: string;

	@ApiProperty({ example: '123 Võ Văn Ngân' })
	@Expose()
	addressLine1: string;
}

export class RoomResponseDto {
	@ApiProperty({ example: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'nha-tro-minh-phat-quan-1-phong-vip' })
	@Expose()
	slug: string;

	@ApiProperty({ example: 'Phòng VIP' })
	@Expose()
	name: string;

	@ApiPropertyOptional({ example: 'Phòng có ban công, WC riêng' })
	@Expose()
	description?: string;

	@ApiProperty({ enum: RoomType, example: 'boarding_house' })
	@Expose()
	roomType: RoomType;

	@ApiPropertyOptional({ example: 25.5 })
	@Expose()
	@Transform(({ value }) => {
		if (value === null || value === undefined) return undefined;
		try {
			return parseFloat(value.toString());
		} catch {
			return undefined;
		}
	})
	areaSqm?: number;

	@ApiPropertyOptional({ example: 2 })
	@Expose()
	floorNumber?: number;

	@ApiProperty({ example: 2 })
	@Expose()
	maxOccupancy: number;

	@ApiProperty({ example: 5 })
	@Expose()
	totalRooms: number;

	@ApiProperty({ example: true })
	@Expose()
	isActive: boolean;

	@ApiProperty({ example: false })
	@Expose()
	isVerified: boolean;

	@ApiPropertyOptional({ example: 4.5 })
	@Expose()
	@Transform(({ value }) => (value ? parseFloat(value.toString()) : 0))
	overallRating?: number;

	@ApiProperty({ example: 25 })
	@Expose()
	totalRatings: number;

	@ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
	@Expose()
	createdAt: Date;

	@ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
	@Expose()
	updatedAt: Date;

	@ApiProperty({ type: BuildingBasicInfoDto })
	@Expose()
	@Type(() => BuildingBasicInfoDto)
	building: BuildingBasicInfoDto;

	@ApiPropertyOptional({ type: RoomPricingResponseDto })
	@Expose()
	@Type(() => RoomPricingResponseDto)
	pricing?: RoomPricingResponseDto;

	@ApiPropertyOptional({ type: [RoomAmenityResponseDto] })
	@Expose()
	@Type(() => RoomAmenityResponseDto)
	amenities?: RoomAmenityResponseDto[];

	@ApiPropertyOptional({ type: [RoomCostResponseDto] })
	@Expose()
	@Type(() => RoomCostResponseDto)
	costs?: RoomCostResponseDto[];

	@ApiPropertyOptional({ type: [RoomRuleResponseDto] })
	@Expose()
	@Type(() => RoomRuleResponseDto)
	rules?: RoomRuleResponseDto[];

	@ApiPropertyOptional({ type: [RoomInstanceResponseDto] })
	@Expose()
	@Type(() => RoomInstanceResponseDto)
	roomInstances?: RoomInstanceResponseDto[];

	@ApiPropertyOptional({ example: 3 })
	@Expose()
	availableInstancesCount?: number;

	@ApiPropertyOptional({ example: 2 })
	@Expose()
	occupiedInstancesCount?: number;
}
