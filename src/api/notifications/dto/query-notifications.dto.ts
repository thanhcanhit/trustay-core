import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryNotificationsDto {
	@ApiPropertyOptional({
		description: 'Số trang',
		example: 1,
		minimum: 1,
	})
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	@IsNumber()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Số lượng items per page',
		example: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	@IsNumber()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Lọc theo trạng thái đã đọc',
		example: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	isRead?: boolean;

	@ApiPropertyOptional({
		description: 'Lọc theo loại thông báo',
		example: 'booking_request',
	})
	@IsOptional()
	@IsString()
	notificationType?: string;
}
