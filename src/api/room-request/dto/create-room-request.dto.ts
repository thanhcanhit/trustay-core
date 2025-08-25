import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType, SearchPostStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Max,
	Min,
} from 'class-validator';

export class CreateRoomRequestDto {
	@ApiProperty({ description: 'Tiêu đề bài đăng tìm trọ' })
	@IsString()
	title: string;

	@ApiProperty({ description: 'Mô tả chi tiết về yêu cầu tìm trọ' })
	@IsString()
	description: string;

	@ApiProperty({ description: 'Slug duy nhất cho bài đăng' })
	@IsString()
	slug: string;

	@ApiPropertyOptional({ description: 'ID quận/huyện mong muốn' })
	@IsOptional()
	@IsNumber()
	preferredDistrictId?: number;

	@ApiPropertyOptional({ description: 'ID phường/xã mong muốn' })
	@IsOptional()
	@IsNumber()
	preferredWardId?: number;

	@ApiProperty({ description: 'ID tỉnh/thành phố mong muốn' })
	@IsNumber()
	preferredProvinceId: number;

	@ApiPropertyOptional({ description: 'Ngân sách tối thiểu' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	minBudget?: number;

	@ApiProperty({ description: 'Ngân sách tối đa' })
	@IsNumber()
	@Min(0)
	maxBudget: number;

	@ApiPropertyOptional({ description: 'Đơn vị tiền tệ', default: 'VND' })
	@IsOptional()
	@IsString()
	currency?: string;

	@ApiPropertyOptional({ description: 'Loại phòng mong muốn', enum: RoomType })
	@IsOptional()
	@IsEnum(RoomType)
	preferredRoomType?: RoomType;

	@ApiPropertyOptional({ description: 'Số người sẽ ở trong phòng' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	@Max(10)
	occupancy?: number;

	@ApiPropertyOptional({ description: 'Thời gian dự định vào ở' })
	@IsOptional()
	@IsDateString()
	moveInDate?: string;

	@ApiPropertyOptional({ description: 'Có công khai hay không', default: true })
	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;

	@ApiPropertyOptional({ description: 'Thời gian hết hạn' })
	@IsOptional()
	@IsDateString()
	expiresAt?: string;

	@ApiPropertyOptional({ description: 'Danh sách ID tiện ích mong muốn' })
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	amenityIds?: string[];
}
