import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * AI Processing Log status enum
 */
export enum AiLogStatusEnum {
	COMPLETED = 'completed',
	FAILED = 'failed',
	PARTIAL = 'partial',
}

/**
 * DTO for querying AI processing logs
 */
export class QueryLogsDto {
	@ApiPropertyOptional({
		description: 'Search term to filter by question text',
		example: 'phòng',
	})
	@IsString({ message: 'Search phải là chuỗi ký tự' })
	@IsOptional()
	search?: string;

	@ApiPropertyOptional({
		description: 'Filter by status',
		enum: AiLogStatusEnum,
		example: 'completed',
	})
	@IsEnum(AiLogStatusEnum, {
		message: 'Status phải là một trong: completed, failed, partial',
	})
	@IsOptional()
	status?: AiLogStatusEnum;

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
