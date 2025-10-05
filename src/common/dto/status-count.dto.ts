import { ApiProperty } from '@nestjs/swagger';

/**
 * Generic status count DTO for overview summaries
 */
export class StatusCountDto {
	@ApiProperty({ description: 'Total count of pending items', example: 12 })
	pending: number;

	@ApiProperty({ description: 'Total count of approved items', example: 8 })
	approved: number;

	@ApiProperty({ description: 'Total count of rejected items', example: 3 })
	rejected: number;

	@ApiProperty({ description: 'Total count of cancelled items', example: 5 })
	cancelled: number;

	@ApiProperty({ description: 'Total count of all items', example: 28 })
	total: number;
}
