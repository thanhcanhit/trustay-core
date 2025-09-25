import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
} from 'class-validator';

export class CreateRoomPreferencesDto {
	@ApiPropertyOptional({
		description: 'ID tỉnh/thành phố ưu tiên',
		type: [Number],
		example: [1, 2, 3],
	})
	@IsOptional()
	@IsArray()
	@Type(() => Number)
	@IsNumber({}, { each: true })
	preferredProvinceIds?: number[];

	@ApiPropertyOptional({
		description: 'ID quận/huyện ưu tiên',
		type: [Number],
		example: [10, 20, 30],
	})
	@IsOptional()
	@IsArray()
	@Type(() => Number)
	@IsNumber({}, { each: true })
	preferredDistrictIds?: number[];

	@ApiPropertyOptional({ description: 'Ngân sách tối thiểu (VNĐ)', example: 2000000 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minBudget?: number;

	@ApiProperty({ description: 'Ngân sách tối đa (VNĐ)', example: 5000000 })
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxBudget: number;

	@ApiPropertyOptional({ description: 'Đơn vị tiền tệ', default: 'VND' })
	@IsOptional()
	@IsString()
	currency?: string;

	@ApiPropertyOptional({
		description: 'Loại phòng ưu tiên',
		enum: RoomType,
		isArray: true,
		example: ['boarding_house', 'apartment'],
	})
	@IsOptional()
	@IsArray()
	@IsEnum(RoomType, { each: true })
	preferredRoomTypes?: RoomType[];

	@ApiPropertyOptional({
		description: 'Số người ở tối đa',
		example: 2,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	maxOccupancy?: number;

	@ApiPropertyOptional({
		description: 'ID tiện ích bắt buộc',
		type: [String],
		example: ['uuid1', 'uuid2'],
	})
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	requiresAmenityIds?: string[];

	@ApiPropertyOptional({ description: 'Ngày có thể chuyển vào', example: '2024-01-01' })
	@IsOptional()
	@IsDateString()
	availableFromDate?: string;

	@ApiPropertyOptional({
		description: 'Thời gian thuê tối thiểu (tháng)',
		default: 3,
		example: 3,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	minLeaseTerm?: number;

	@ApiPropertyOptional({ description: 'Kích hoạt preferences', default: true })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class UpdateRoomPreferencesDto extends CreateRoomPreferencesDto {}

export class RoomPreferencesResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	tenantId: string;

	@ApiPropertyOptional({ type: [Number] })
	preferredProvinceIds?: number[];

	@ApiPropertyOptional({ type: [Number] })
	preferredDistrictIds?: number[];

	@ApiPropertyOptional()
	minBudget?: number;

	@ApiProperty()
	maxBudget: number;

	@ApiProperty()
	currency: string;

	@ApiPropertyOptional({ enum: RoomType, isArray: true })
	preferredRoomTypes?: RoomType[];

	@ApiPropertyOptional()
	maxOccupancy?: number;

	@ApiPropertyOptional({ type: [String] })
	requiresAmenityIds?: string[];

	@ApiPropertyOptional()
	availableFromDate?: string;

	@ApiPropertyOptional()
	minLeaseTerm?: number;

	@ApiProperty()
	isActive: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}
