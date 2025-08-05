import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CostCategory } from '@prisma/client';

export class SystemCostTypeDto {
	@ApiProperty({ description: 'Unique identifier' })
	id: string;

	@ApiProperty({ description: 'Cost type name in Vietnamese' })
	name: string;

	@ApiProperty({ description: 'Cost type name in English' })
	nameEn: string;

	@ApiProperty({
		description: 'Cost category',
		enum: CostCategory,
	})
	category: CostCategory;

	@ApiPropertyOptional({ description: 'Default unit for this cost type' })
	defaultUnit?: string;

	@ApiPropertyOptional({ description: 'Icon URL for the cost type' })
	iconUrl?: string;

	@ApiPropertyOptional({ description: 'Description of the cost type' })
	description?: string;

	@ApiProperty({ description: 'Whether the cost type is active' })
	isActive: boolean;

	@ApiProperty({ description: 'Sort order for display' })
	sortOrder: number;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;

	@ApiProperty({ description: 'Last update timestamp' })
	updatedAt: Date;
}
