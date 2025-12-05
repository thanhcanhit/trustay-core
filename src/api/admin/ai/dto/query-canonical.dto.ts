import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO for querying canonical SQL QA entries
 */
export class QueryCanonicalDto {
	@ApiPropertyOptional({
		description: 'Search term to filter by question text',
		example: 'phòng giá',
	})
	@IsString({ message: 'Search phải là chuỗi ký tự' })
	@IsOptional()
	search?: string;

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
