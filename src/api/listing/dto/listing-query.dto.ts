import { RoomType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

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
}
