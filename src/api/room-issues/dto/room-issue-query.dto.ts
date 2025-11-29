import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomIssueCategory, RoomIssueStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class RoomIssueQueryDto {
	@ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 50 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Filter by room instance',
		example: 'f3d9f525-8d4a-45d1-9501-893e3627ef4f',
	})
	@IsOptional()
	@IsUUID()
	roomInstanceId?: string;

	@ApiPropertyOptional({ description: 'Filter by category', enum: RoomIssueCategory })
	@IsOptional()
	@IsEnum(RoomIssueCategory)
	category?: RoomIssueCategory;

	@ApiPropertyOptional({
		description: 'Filter by issue status',
		enum: RoomIssueStatus,
	})
	@IsOptional()
	@IsEnum(RoomIssueStatus)
	status?: RoomIssueStatus;
}
