import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryPendingKnowledgeDto {
	@ApiPropertyOptional({
		description: 'Search term to filter by question',
		example: 'phòng quận 1',
	})
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({
		description: 'Filter by status',
		enum: ['pending', 'approved', 'rejected'],
		example: 'pending',
	})
	@IsOptional()
	@IsString()
	status?: string;

	@ApiPropertyOptional({
		description: 'Number of items per page',
		minimum: 1,
		maximum: 100,
		default: 20,
		example: 20,
	})
	@IsOptional()
	limit?: number;

	@ApiPropertyOptional({
		description: 'Number of items to skip',
		minimum: 0,
		default: 0,
		example: 0,
	})
	@IsOptional()
	offset?: number;
}

export class ApprovePendingKnowledgeDto {
	@ApiPropertyOptional({
		description: 'Optional note from admin',
		example: 'Approved after review',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}

export class RejectPendingKnowledgeDto {
	@ApiProperty({
		description: 'Reason for rejection (required)',
		example: 'SQL query is incorrect or results are invalid',
		maxLength: 1000,
	})
	@IsNotEmpty()
	@IsString()
	@MaxLength(1000)
	reason: string;
}
