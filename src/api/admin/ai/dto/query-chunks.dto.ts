import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * AI Chunk collection type
 */
export enum AiChunkCollectionEnum {
	SCHEMA = 'schema',
	QA = 'qa',
	BUSINESS = 'business',
	DOCS = 'docs',
}

/**
 * DTO for querying AI chunks
 */
export class QueryChunksDto {
	@ApiPropertyOptional({
		description: 'Search term to filter by content text',
		example: 'room',
	})
	@IsString({ message: 'Search phải là chuỗi ký tự' })
	@IsOptional()
	search?: string;

	@ApiPropertyOptional({
		description: 'Filter by collection type',
		enum: AiChunkCollectionEnum,
		example: 'qa',
	})
	@IsEnum(AiChunkCollectionEnum, {
		message: 'Collection phải là một trong: schema, qa, business, docs',
	})
	@IsOptional()
	collection?: AiChunkCollectionEnum;

	@ApiPropertyOptional({
		description: 'Số lượng kết quả trả về',
		example: 20,
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@Type(() => Number)
	@IsInt({ message: 'Limit phải là số nguyên' })
	@Min(1, { message: 'Limit phải lớn hơn 0' })
	@Max(100, { message: 'Limit không được vượt quá 100' })
	@IsOptional()
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Offset cho pagination',
		example: 0,
		default: 0,
		minimum: 0,
	})
	@Type(() => Number)
	@IsInt({ message: 'Offset phải là số nguyên' })
	@Min(0, { message: 'Offset phải lớn hơn hoặc bằng 0' })
	@IsOptional()
	offset?: number = 0;
}
