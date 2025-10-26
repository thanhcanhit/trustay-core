import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, CostType, RoomType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { UpdateRoomImageDto } from './room-image.dto';

export class UpdateRoomPricingDto {
	@ApiPropertyOptional({
		description: 'Giá thuê cơ bản hàng tháng (VND)',
		example: 3800000,
		minimum: 100000,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(100000)
	basePriceMonthly?: number;

	@ApiPropertyOptional({
		description: 'Số tiền cọc (VND)',
		example: 7600000,
		minimum: 0,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	depositAmount?: number;

	@ApiPropertyOptional({
		description: 'Số tháng cọc',
		example: 2,
		minimum: 0,
		maximum: 12,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	depositMonths?: number;

	@ApiPropertyOptional({
		description: 'Chu kỳ thanh toán',
		enum: BillingCycle,
		example: BillingCycle.monthly,
	})
	@IsOptional()
	@IsEnum(BillingCycle)
	billingCycle?: BillingCycle;

	@ApiPropertyOptional({
		description: 'Có thể thanh toán trước không',
		example: true,
	})
	@IsOptional()
	@IsBoolean()
	allowAdvancePayment?: boolean;

	@ApiPropertyOptional({
		description: 'Số tháng tối đa có thể thanh toán trước',
		example: 6,
		minimum: 1,
		maximum: 12,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	maxAdvanceMonths?: number;

	@ApiPropertyOptional({
		description: 'Phần trăm giảm giá khi thanh toán trước (%)',
		example: 5.0,
		minimum: 0,
		maximum: 50,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	advancePaymentDiscount?: number;

	@ApiPropertyOptional({
		description: 'Có thể đàm phán giá không',
		example: true,
	})
	@IsOptional()
	@IsBoolean()
	isNegotiable?: boolean;

	@ApiPropertyOptional({
		description: 'Ghi chú về giá cả',
		example: 'Giá đã bao gồm phí quản lý',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	priceNotes?: string;
}

export class UpdateRoomAmenityDto {
	@ApiPropertyOptional({
		description: 'ID của system amenity',
		example: 'uuid-amenity-id',
	})
	@IsOptional()
	@IsUUID()
	systemAmenityId?: string;

	@ApiPropertyOptional({
		description: 'Giá trị tùy chỉnh',
		example: '2 chiếc Daikin inverter',
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	customValue?: string;

	@ApiPropertyOptional({
		description: 'Ghi chú thêm',
		example: 'Điều hòa mới 100%, bảo hành 3 năm',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notes?: string;
}

export class UpdateRoomCostDto {
	@ApiPropertyOptional({
		description: 'ID của system cost type',
		example: 'uuid-cost-type-id',
	})
	@IsOptional()
	@IsUUID()
	systemCostTypeId?: string;

	@ApiPropertyOptional({
		description: 'Giá trị chi phí',
		example: 3800,
		minimum: 0,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
	@Min(0)
	value?: number;

	@ApiPropertyOptional({
		description: 'Loại tính phí',
		enum: CostType,
		example: CostType.per_person,
		default: CostType.fixed,
	})
	@IsOptional()
	@IsEnum(CostType)
	costType?: CostType = CostType.fixed;

	@ApiPropertyOptional({
		description: 'Đơn vị tính',
		example: 'kWh',
		maxLength: 50,
	})
	@IsOptional()
	@IsString()
	@MaxLength(50)
	unit?: string;

	@ApiPropertyOptional({
		description: 'Ghi chú chi phí',
		example: 'Giá điện theo EVN, đọc công tơ cuối tháng',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notes?: string;

	@ApiPropertyOptional({
		description: 'Có bắt buộc không',
		example: true,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	isMandatory?: boolean = false;

	@ApiPropertyOptional({
		description: 'Bao gồm trong giá thuê',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	isIncludedInRent?: boolean = false;

	@ApiPropertyOptional({
		description: 'Chu kỳ thanh toán',
		enum: BillingCycle,
		example: BillingCycle.monthly,
		default: BillingCycle.monthly,
	})
	@IsOptional()
	@IsEnum(BillingCycle)
	billingCycle?: BillingCycle = BillingCycle.monthly;
}

export class UpdateRoomRuleDto {
	@ApiPropertyOptional({
		description: 'ID của system rule',
		example: 'uuid-rule-id',
	})
	@IsOptional()
	@IsUUID()
	systemRuleId?: string;

	@ApiPropertyOptional({
		description: 'Giá trị tùy chỉnh',
		example: 'Tối đa 2 người/phòng',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	customValue?: string;

	@ApiPropertyOptional({
		description: 'Có bắt buộc tuân thủ không',
		example: true,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	isStrict?: boolean = false;

	@ApiPropertyOptional({
		description: 'Ghi chú quy tắc',
		example: 'Vi phạm 3 lần sẽ chấm dứt hợp đồng',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notes?: string;
}

export class UpdateRoomDto {
	@ApiPropertyOptional({
		description: 'Tên room type',
		example: 'Phòng VIP Deluxe',
		minLength: 1,
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	name?: string;

	@ApiPropertyOptional({
		description: 'Mô tả chi tiết room type',
		example: 'Phòng cao cấp với đầy đủ tiện nghi, view đẹp, được nâng cấp hoàn toàn',
		maxLength: 2000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	description?: string;

	@ApiPropertyOptional({
		description: 'Loại phòng',
		enum: RoomType,
		example: RoomType.boarding_house,
	})
	@IsOptional()
	@IsEnum(RoomType)
	roomType?: RoomType;

	@ApiPropertyOptional({
		description: 'Diện tích phòng (m²)',
		example: 28.5,
		minimum: 1,
		maximum: 1000,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(1)
	areaSqm?: number;

	@ApiPropertyOptional({
		description: 'Tổng số phòng instance (chỉ cập nhật khi tăng)',
		example: 8,
		minimum: 1,
		maximum: 1000,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	totalRooms?: number;

	@ApiPropertyOptional({
		description: 'Thông tin giá cả - CẬP NHẬT toàn bộ',
		type: UpdateRoomPricingDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateRoomPricingDto)
	pricing?: UpdateRoomPricingDto;

	@ApiPropertyOptional({
		description: 'Danh sách tiện ích - GHI ĐÈ HOÀN TOÀN danh sách cũ',
		type: [UpdateRoomAmenityDto],
		example: [
			{
				systemAmenityId: 'uuid-amenity-dieu-hoa',
				customValue: '3 chiếc LG inverter',
				notes: 'Điều hòa mới 100%, tiết kiệm điện',
			},
			{
				systemAmenityId: 'uuid-amenity-wifi',
				customValue: 'Viettel 100Mbps',
				notes: 'Tốc độ ổn định 24/7',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateRoomAmenityDto)
	amenities?: UpdateRoomAmenityDto[];

	@ApiPropertyOptional({
		description: 'Danh sách chi phí - GHI ĐÈ HOÀN TOÀN danh sách cũ',
		type: [UpdateRoomCostDto],
		example: [
			{
				systemCostTypeId: 'uuid-cost-dien',
				value: 4000,
				costType: 'per_unit',
				unit: 'kWh',
				notes: 'Giá điện tăng theo EVN',
				isMandatory: true,
				billingCycle: 'monthly',
			},
			{
				systemCostTypeId: 'uuid-cost-nuoc',
				value: 25000,
				costType: 'per_unit',
				unit: 'm³',
				notes: 'Nước sạch Saigon Water',
				isMandatory: true,
				billingCycle: 'monthly',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateRoomCostDto)
	costs?: UpdateRoomCostDto[];

	@ApiPropertyOptional({
		description: 'Danh sách quy tắc - GHI ĐÈ HOÀN TOÀN danh sách cũ',
		type: [UpdateRoomRuleDto],
		example: [
			{
				systemRuleId: 'uuid-rule-khach',
				customValue: 'Tối đa 3 người/phòng',
				isStrict: true,
				notes: 'Quá số lượng sẽ tính phụ phí',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateRoomRuleDto)
	rules?: UpdateRoomRuleDto[];

	@ApiPropertyOptional({
		description: 'Trạng thái hoạt động',
		example: true,
	})
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@ApiPropertyOptional({
		description: 'Danh sách hình ảnh phòng - GHI ĐÈ HOÀN TOÀN danh sách cũ',
		type: UpdateRoomImageDto,
		example: {
			images: [
				{
					path: '/images/1757854142834-a76f44bd-19d60dce93ed8871.jpg',
					alt: 'KHAI TRƯƠNG TOÀ NHÀ MỚI XÂY GIÁ CHỈ 3 TRIỆU 8',
					isPrimary: true,
					sortOrder: 0,
				},
				{
					path: '/images/1757854142835-a76f44be-19d60dce93ed8872.jpg',
				},
				{
					path: '/images/1757854142836-a76f44bf-19d60dce93ed8873.jpg',
					alt: 'Hình ảnh phòng',
				},
			],
		},
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateRoomImageDto)
	images?: UpdateRoomImageDto;
}
