import { RoomType, SearchPostStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class RoomRequestSearchDto extends PaginationQueryDto {
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
	@IsString()
	minBudget?: string;

	@IsOptional()
	@IsString()
	maxBudget?: string;

	@IsOptional()
	@IsEnum(RoomType)
	roomType?: RoomType;

	@IsOptional()
	@IsString()
	occupancy?: string;

	@IsOptional()
	@IsEnum(SearchPostStatus)
	status?: SearchPostStatus;

	@IsOptional()
	@IsString()
	@Transform(({ value }) => value === 'true')
	isPublic?: string;

	@IsOptional()
	@IsString()
	requesterId?: string;
}

export class ListingQueryDto extends PaginationQueryDto {
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
	occupancy?: string;

	@IsOptional()
	@IsString()
	requesterId?: string;
}
