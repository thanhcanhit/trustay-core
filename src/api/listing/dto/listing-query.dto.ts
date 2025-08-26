import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType, SearchPostStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class RoomRequestSearchDto extends PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	provinceId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	districtId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	wardId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minBudget?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxBudget?: number;

	@IsOptional()
	@IsEnum(RoomType)
	roomType?: RoomType;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	occupancy?: number;

	@ApiPropertyOptional({
		description: 'Tiện ích mong muốn (comma-separated)',
		type: String,
	})
	@IsOptional()
	@IsString()
	amenities?: string;

	@IsOptional()
	@IsEnum(SearchPostStatus)
	status?: SearchPostStatus;

	@IsOptional()
	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	isPublic?: boolean;

	@IsOptional()
	@IsString()
	requesterId?: string;

	@ApiPropertyOptional({
		description: 'Ngày dự định vào ở',
		type: String,
	})
	@IsOptional()
	@Type(() => Date)
	moveInDate?: Date;
}

export class ListingQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	provinceId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	districtId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	wardId?: number;

	@IsOptional()
	@IsEnum(RoomType)
	roomType?: RoomType;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minPrice?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxPrice?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minArea?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxArea?: number;

	@ApiPropertyOptional({
		description: 'Tiện ích yêu cầu (comma-separated)',
		type: String,
	})
	@IsOptional()
	@IsString()
	amenities?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxOccupancy?: number;

	@IsOptional()
	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	isVerified?: boolean;

	@IsOptional()
	@IsString()
	requesterId?: string;

	@ApiPropertyOptional({
		description: 'Vĩ độ để tìm kiếm theo khoảng cách',
		type: Number,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Kinh độ để tìm kiếm theo khoảng cách',
		type: Number,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	longitude?: number;

	@ApiPropertyOptional({
		description: 'Bán kính tìm kiếm (km)',
		type: Number,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0.1)
	radius?: number;
}
