import { ApiProperty } from '@nestjs/swagger';
import { RatingTargetType } from '@prisma/client';
import {
	IsArray,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
} from 'class-validator';

export class CreateRatingDto {
	@ApiProperty({
		description: 'Target type to rate',
		enum: RatingTargetType,
		example: 'tenant',
	})
	@IsEnum(RatingTargetType)
	targetType: RatingTargetType;

	@ApiProperty({ description: 'ID of the target being rated' })
	@IsUUID()
	@IsNotEmpty()
	targetId: string;

	@ApiProperty({ description: 'Related rental ID', required: false })
	@IsUUID()
	@IsOptional()
	rentalId?: string;

	@ApiProperty({
		description: 'Rating (1-5)',
		minimum: 1,
		maximum: 5,
		example: 5,
	})
	@IsInt()
	@Min(1)
	@Max(5)
	rating: number;

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
