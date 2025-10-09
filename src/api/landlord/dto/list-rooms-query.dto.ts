import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListRoomsQueryDto {
	@ApiPropertyOptional({ description: 'Page', example: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({ description: 'Filter by building ID' })
	@IsOptional()
	@IsString()
	buildingId?: string;

	@ApiPropertyOptional({ description: 'Search by room name' })
	@IsOptional()
	@IsString()
	search?: string;
}
