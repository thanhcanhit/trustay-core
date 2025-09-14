import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, CostType, RoomType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { CreateRoomImageDto } from './room-image.dto';

export class CreateRoomPricingDto {
	@ApiProperty({
		description: 'Giá thuê hàng tháng (VND)',
		example: 3500000,
	})
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	basePriceMonthly: number;

	@ApiProperty({
		description: 'Số tiền cọc (VND)',
		example: 7000000,
	})
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	depositAmount: number;

	@ApiPropertyOptional({
		description: 'Số tháng cọc',
		example: 2,
		default: 1,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(12)
	depositMonths?: number = 1;

	@ApiPropertyOptional({
		description: 'Tiện ích đã bao gồm trong giá thuê',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	utilityIncluded?: boolean = false;

	@ApiPropertyOptional({
		description: 'Chi phí tiện ích hàng tháng (nếu không bao gồm)',
		example: 500000,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	utilityCostMonthly?: number;

	@ApiPropertyOptional({
		description: 'Phí dọn dẹp',
		example: 200000,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	cleaningFee?: number;

	@ApiPropertyOptional({
		description: 'Phí dịch vụ (%)',
		example: 5.0,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0)
	@Max(100)
	serviceFeePercentage?: number;

	@ApiPropertyOptional({
		description: 'Số tháng ở tối thiểu',
		example: 3,
		default: 1,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(60)
	minimumStayMonths?: number = 1;

	@ApiPropertyOptional({
		description: 'Số tháng ở tối đa',
		example: 12,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(60)
	maximumStayMonths?: number;

	@ApiPropertyOptional({
		description: 'Có thể thương lượng giá',
		example: true,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	priceNegotiable?: boolean = false;
}

export class CreateRoomAmenityDto {
	@ApiProperty({
		description: 'ID của system amenity',
		example: 'uuid-dieu-hoa',
	})
	@IsString()
	@IsNotEmpty()
	systemAmenityId: string;

	@ApiPropertyOptional({
		description: 'Giá trị tùy chỉnh (nếu có)',
		example: '2 chiếc',
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	customValue?: string;

	@ApiPropertyOptional({
		description: 'Ghi chú thêm',
		example: 'Điều hòa mới, tiết kiệm điện',
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notes?: string;
}

export class CreateRoomCostDto {
	@ApiProperty({
		description: 'ID của system cost type',
		example: 'uuid-dien',
	})
	@IsString()
	@IsNotEmpty()
	systemCostTypeId: string;

	@ApiProperty({
		description: 'Giá trị chi phí (VND)',
		example: 100000,
	})
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
	@Min(0)
	value: number;

	@ApiPropertyOptional({
		description: 'Loại tính phí',
		enum: CostType,
		example: CostType.fixed,
		default: CostType.fixed,
	})
	@IsOptional()
	@IsEnum(CostType)
	costType?: CostType = CostType.fixed;

	@ApiPropertyOptional({
		description: 'Đơn vị tính (override system default)',
		example: 'kWh',
	})
	@IsOptional()
	@IsString()
	@MaxLength(50)
	unit?: string;

	@ApiPropertyOptional({
		description: 'Chu kỳ thanh toán',
		enum: BillingCycle,
		example: BillingCycle.monthly,
		default: BillingCycle.monthly,
	})
	@IsOptional()
	@IsEnum(BillingCycle)
	billingCycle?: BillingCycle = BillingCycle.monthly;

	@ApiPropertyOptional({
		description: 'Bao gồm trong tiền thuê',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	includedInRent?: boolean = false;

	@ApiPropertyOptional({
		description: 'Tùy chọn (không bắt buộc)',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	isOptional?: boolean = false;

	@ApiPropertyOptional({
		description: 'Ghi chú',
		example: 'Internet tốc độ cao',
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notes?: string;
}

export class CreateRoomRuleDto {
	@ApiProperty({
		description: 'ID của system room rule',
		example: 'uuid',
	})
	@IsString()
	@IsNotEmpty()
	systemRuleId: string;

	@ApiPropertyOptional({
		description: 'Giá trị tùy chỉnh cho rule',
		example: 'Sau 22h00',
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	customValue?: string;

	@ApiPropertyOptional({
		description: 'Có được thực thi nghiêm ngặt',
		example: true,
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	isEnforced?: boolean = true;

	@ApiPropertyOptional({
		description: 'Ghi chú thêm',
		example: 'Áp dụng tất cả các ngày trong tuần',
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	notes?: string;
}

export class CreateRoomDto {
	@ApiProperty({
		description: 'Tên loại phòng',
		example: 'Phòng VIP',
		minLength: 1,
		maxLength: 255,
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(1)
	@MaxLength(255)
	name: string;

	@ApiPropertyOptional({
		description: 'Mô tả chi tiết phòng',
		example: 'Phòng có ban công, WC riêng, đầy đủ nội thất',
		maxLength: 1000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	description?: string;

	@ApiProperty({
		description: 'Loại phòng',
		enum: RoomType,
		example: RoomType.boarding_house,
	})
	@IsEnum(RoomType)
	roomType: RoomType;

	@ApiPropertyOptional({
		description: 'Diện tích phòng (m²)',
		example: 25.5,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(1)
	@Max(1000)
	areaSqm?: number;

	@ApiPropertyOptional({
		description: 'Số tầng',
		example: 2,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(50)
	floorNumber?: number;

	@ApiPropertyOptional({
		description: 'Số người ở tối đa',
		example: 2,
		default: 1,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(10)
	maxOccupancy?: number = 1;

	@ApiProperty({
		description: 'Tổng số phòng loại này',
		example: 5,
		minimum: 1,
		maximum: 100,
	})
	@IsInt()
	@Min(1)
	@Max(100)
	totalRooms: number;

	@ApiPropertyOptional({
		description: 'Trạng thái hoạt động',
		example: true,
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	isActive?: boolean = true;

	@ApiProperty({
		description: 'Thông tin giá cả',
		type: CreateRoomPricingDto,
	})
	@ValidateNested()
	@Type(() => CreateRoomPricingDto)
	pricing: CreateRoomPricingDto;

	@ApiPropertyOptional({
		description: 'Danh sách tiện ích',
		type: [CreateRoomAmenityDto],
		isArray: true,
		example: [
			{
				systemAmenityId: 'uuid-dieu-hoa',
				customValue: '2 chiếc',
				notes: 'Điều hòa Daikin inverter',
			},
			{
				systemAmenityId: 'uuid-tu-lanh',
				customValue: '200L',
				notes: 'Tủ lạnh Electrolux',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRoomAmenityDto)
	amenities?: CreateRoomAmenityDto[];

	@ApiPropertyOptional({
		description: 'Danh sách chi phí phát sinh',
		type: [CreateRoomCostDto],
		isArray: true,
		example: [
			{
				systemCostTypeId: 'uuid-dien',
				value: 3500,
				costType: 'per_unit',
				unit: 'kWh',
				notes: 'Giá điện theo đồng hồ',
			},
			{
				systemCostTypeId: 'uuid-internet',
				value: 100000,
				costType: 'fixed',
				billingCycle: 'monthly',
				includedInRent: false,
				notes: 'Internet FiberVNN 50Mbps',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRoomCostDto)
	costs?: CreateRoomCostDto[];

	@ApiPropertyOptional({
		description: 'Danh sách quy tắc',
		type: [CreateRoomRuleDto],
		isArray: true,
		example: [
			{
				systemRuleId: 'uuid-khong-hut-thuoc',
				isEnforced: true,
				notes: 'Nghiêm cấm hút thuốc trong phòng',
			},
			{
				systemRuleId: 'uuid-gio-ve-muon',
				customValue: 'Sau 23:00',
				isEnforced: false,
				notes: 'Nên về sớm để không làm ảnh hưởng người khác',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRoomRuleDto)
	rules?: CreateRoomRuleDto[];

	@ApiPropertyOptional({
		description: 'Prefix cho room number (VD: "A" -> A101, A102)',
		example: 'A',
		maxLength: 5,
	})
	@IsOptional()
	@IsString()
	@MaxLength(5)
	roomNumberPrefix?: string;

	@ApiPropertyOptional({
		description: 'Số bắt đầu cho room number',
		example: 101,
		default: 1,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(9999)
	roomNumberStart?: number = 1;

	@ApiPropertyOptional({
		description: 'Danh sách hình ảnh phòng',
		type: CreateRoomImageDto,
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
	@Type(() => CreateRoomImageDto)
	images?: CreateRoomImageDto;
}
