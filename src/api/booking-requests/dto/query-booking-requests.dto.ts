import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryBookingRequestsDto {
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
		description: 'Số items per page',
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
		description: 'Lọc theo trạng thái booking',
		enum: BookingStatus,
		example: 'pending',
	})
	@IsOptional()
	@IsEnum(BookingStatus)
	status?: BookingStatus;

	@ApiPropertyOptional({
		description: 'Lọc theo building ID (for landlords)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	buildingId?: string;

	@ApiPropertyOptional({
		description: 'Lọc theo room ID (for landlords)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	roomId?: string;
}
