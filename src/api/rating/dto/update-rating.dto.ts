import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateRatingDto {
	@ApiProperty({
		description: 'Rating (1-5)',
		minimum: 1,
		maximum: 5,
		required: false,
	})
	@IsInt()
	@Min(1)
	@Max(5)
	@IsOptional()
	rating?: number;

	@ApiProperty({ description: 'Review content', required: false })
	@IsString()
	@IsOptional()
	content?: string;

	@ApiProperty({
		description: 'List of image URLs',
		type: [String],
		required: false,
	})
	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	images?: string[];
}
