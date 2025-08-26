import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
	@ApiPropertyOptional({
		description: 'Page number (starts from 1)',
		default: 1,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Number of items per page',
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({ description: 'Search keyword' })
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({
		description: 'Sort field',
		default: 'createdAt',
		example: 'createdAt',
	})
	@IsOptional()
	@IsString()
	sortBy?: string = 'createdAt';

	@ApiPropertyOptional({
		description: 'Sort order',
		default: 'desc',
		enum: ['asc', 'desc'],
	})
	@IsOptional()
	@IsString()
	@IsIn(['asc', 'desc'])
	sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginationMetaDto {
	@ApiProperty({ description: 'Current page number' })
	page: number;

	@ApiProperty({ description: 'Number of items per page' })
	limit: number;

	@ApiProperty({ description: 'Total number of items' })
	total: number;

	@ApiProperty({ description: 'Total number of pages' })
	totalPages: number;

	@ApiProperty({ description: 'Whether there is a next page' })
	hasNext: boolean;

	@ApiProperty({ description: 'Whether there is a previous page' })
	hasPrev: boolean;

	@ApiProperty({ description: 'Number of items in current page' })
	itemCount: number;

	constructor(page: number, limit: number, total: number, itemCount: number) {
		this.page = page;
		this.limit = limit;
		this.total = total;
		this.totalPages = Math.ceil(total / limit);
		this.hasNext = page < this.totalPages;
		this.hasPrev = page > 1;
		this.itemCount = itemCount;
	}
}

export class PaginatedResponseDto<T> {
	@ApiProperty({ description: 'Array of items' })
	data: T[];

	@ApiProperty({ description: 'Pagination metadata' })
	meta: PaginationMetaDto;

	constructor(data: T[], meta: PaginationMetaDto) {
		this.data = data;
		this.meta = meta;
	}

	static create<T>(data: T[], page: number, limit: number, total: number): PaginatedResponseDto<T> {
		const meta = new PaginationMetaDto(page, limit, total, data.length);
		return new PaginatedResponseDto(data, meta);
	}
}

export interface PaginationOptions {
	page: number;
	limit: number;
}

export function calculatePagination(
	page: number = 1,
	limit: number = 20,
): {
	skip: number;
	take: number;
	page: number;
	limit: number;
} {
	const skip = (page - 1) * limit;
	return {
		skip,
		take: limit,
		page,
		limit,
	};
}
