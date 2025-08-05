import { RoomType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
} from 'class-validator';

export class ListingQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@IsString()
	provinceId?: string;

	@IsOptional()
	@IsString()
	districtId?: string;

	@IsOptional()
	@IsString()
	wardId?: string;

	@IsOptional()
	@IsEnum(RoomType)
	roomType?: RoomType;

	@IsOptional()
	@IsString()
	minPrice?: string;

	@IsOptional()
	@IsString()
	maxPrice?: string;

	@IsOptional()
	@IsString()
	minArea?: string;

	@IsOptional()
	@IsString()
	maxArea?: string;

	@IsOptional()
	@IsString()
	amenities?: string;

	@IsOptional()
	@IsString()
	maxOccupancy?: string;

	@IsOptional()
	@IsString()
	@Transform(({ value }) => value === 'true')
	isVerified?: string;

	@IsOptional()
	@IsString()
	@IsEnum(['price', 'area', 'createdAt', 'updatedAt'])
	sortBy?: string = 'createdAt';

	@IsOptional()
	@IsString()
	@IsEnum(['asc', 'desc'])
	sortOrder?: string = 'desc';
}
