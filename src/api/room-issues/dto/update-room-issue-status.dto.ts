import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomIssueStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoomIssueStatusDto {
	@ApiProperty({
		description: 'New status of the room issue',
		enum: RoomIssueStatus,
		example: RoomIssueStatus.in_progress,
	})
	@IsEnum(RoomIssueStatus)
	status: RoomIssueStatus;

	@ApiPropertyOptional({
		description: 'Optional note from landlord about this update',
		example: 'Technician will come to check the issue tomorrow morning.',
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
