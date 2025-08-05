import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmenityCategory } from '@prisma/client';

export class SystemAmenityDto {
	@ApiProperty({ description: 'Unique identifier' })
	id: string;

	@ApiProperty({ description: 'Amenity name in Vietnamese' })
	name: string;

	@ApiProperty({ description: 'Amenity name in English' })
	nameEn: string;

	@ApiProperty({
		description: 'Amenity category',
		enum: AmenityCategory,
	})
	category: AmenityCategory;

	@ApiPropertyOptional({ description: 'Icon URL for the amenity' })
	iconUrl?: string;

	@ApiPropertyOptional({ description: 'Description of the amenity' })
	description?: string;

	@ApiProperty({ description: 'Whether the amenity is active' })
	isActive: boolean;

	@ApiProperty({ description: 'Sort order for display' })
	sortOrder: number;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;

	@ApiProperty({ description: 'Last update timestamp' })
	updatedAt: Date;
}
