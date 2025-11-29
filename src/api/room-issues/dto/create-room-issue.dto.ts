import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomIssueCategory } from '@prisma/client';
import {
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class CreateRoomIssueDto {
	@ApiProperty({
		description: 'Room instance identifier',
		example: 'e1e7c5fd-1f68-4e1b-8178-8ad2a0e5b5b9',
	})
	@IsUUID()
	roomInstanceId: string;

	@ApiProperty({
		description: 'Short title describing the problem',
		example: 'Water leakage near the bathroom door',
	})
	@IsString()
	@MaxLength(120)
	title: string;

	@ApiProperty({
		description: 'Issue category for quick grouping',
		enum: RoomIssueCategory,
		example: RoomIssueCategory.utility,
	})
	@IsEnum(RoomIssueCategory)
	category: RoomIssueCategory;

	@ApiPropertyOptional({
		description: 'List of evidence image URLs',
		type: [String],
		example: ['https://cdn.trustay.vn/issues/leak-1.jpg'],
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(10)
	@IsString({ each: true })
	imageUrls?: string[];
}
