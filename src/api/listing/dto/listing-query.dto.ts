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
}
