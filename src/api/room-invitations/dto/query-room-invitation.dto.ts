import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryRoomInvitationDto {
	@ApiPropertyOptional({
		description: 'Số trang',
		example: 1,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Số lượng mỗi trang',
		example: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Lọc theo trạng thái',
		enum: InvitationStatus,
		example: 'pending',
	})
	@IsOptional()
	@IsEnum(InvitationStatus)
	status?: InvitationStatus;

	@ApiPropertyOptional({
		description: 'Lọc theo building ID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	buildingId?: string;

	@ApiPropertyOptional({
		description: 'Lọc theo room ID',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	roomId?: string;
}
