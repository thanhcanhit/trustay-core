import { ApiProperty } from '@nestjs/swagger';
import { RatingTargetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class RatingQueryDto extends PaginationQueryDto {
	@ApiProperty({
		description: 'Filter by target type',
		enum: RatingTargetType,
		required: false,
	})
	@IsEnum(RatingTargetType)
	@IsOptional()
	targetType?: RatingTargetType;

	@ApiProperty({ description: 'Filter by target ID', required: false })
	@IsUUID()
	@IsOptional()
	targetId?: string;

	@ApiProperty({ description: 'Filter by reviewer ID', required: false })
	@IsUUID()
	@IsOptional()
	reviewerId?: string;

	@ApiProperty({ description: 'Filter by rental ID', required: false })
	@IsUUID()
	@IsOptional()
	rentalId?: string;

	@ApiProperty({
		description: 'Filter by minimum rating',
		minimum: 1,
		maximum: 5,
		required: false,
	})
	@Transform(({ value }) => parseInt(value))
	@IsInt()
	@Min(1)
	@Max(5)
	@IsOptional()
	minRating?: number;

	@ApiProperty({
		description: 'Filter by maximum rating',
		minimum: 1,
		maximum: 5,
		required: false,
	})
	@Transform(({ value }) => parseInt(value))
	@IsInt()
	@Min(1)
	@Max(5)
	@IsOptional()
	maxRating?: number;
}
