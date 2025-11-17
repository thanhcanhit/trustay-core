import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Query dto dùng để lọc dữ liệu dashboard.
 */
export class DashboardFilterQueryDto {
	@ApiPropertyOptional({
		description: 'Giới hạn dữ liệu theo tòa nhà cụ thể',
		example: 'building-123',
	})
	@IsOptional()
	@IsString()
	readonly buildingId?: string;

	@ApiPropertyOptional({
		description: 'Tháng tham chiếu theo định dạng YYYY-MM',
		example: '2025-11',
	})
	@IsOptional()
	@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
	readonly referenceMonth?: string;
}
