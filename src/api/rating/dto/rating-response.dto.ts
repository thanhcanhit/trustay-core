import { ApiProperty } from '@nestjs/swagger';
import { RatingTargetType } from '@prisma/client';

export class RatingReviewerDto {
	@ApiProperty({ description: 'Reviewer ID' })
	id: string;

	@ApiProperty({ description: 'Reviewer first name' })
	firstName?: string;

	@ApiProperty({ description: 'Reviewer last name' })
	lastName?: string;

	@ApiProperty({ description: 'Reviewer avatar URL' })
	avatarUrl?: string;

	@ApiProperty({ description: 'Whether reviewer is verified' })
	isVerified: boolean;
}

export class RatingResponseDto {
	@ApiProperty({ description: 'Rating ID' })
	id: string;

	@ApiProperty({ description: 'Target type', enum: RatingTargetType })
	targetType: RatingTargetType;

	@ApiProperty({ description: 'Target ID' })
	targetId: string;

	@ApiProperty({ description: 'Reviewer ID' })
	reviewerId: string;

	@ApiProperty({ description: 'Related rental ID' })
	rentalId?: string;

	@ApiProperty({ description: 'Rating (1-5)' })
	rating: number;

	@ApiProperty({ description: 'Review content' })
	content?: string;

	@ApiProperty({ description: 'Created date' })
	createdAt: Date;

	@ApiProperty({ description: 'Updated date' })
	updatedAt: Date;

	@ApiProperty({ description: 'Reviewer information', type: RatingReviewerDto })
	reviewer: RatingReviewerDto;

	@ApiProperty({
		description: 'List of image URLs',
		type: [String],
	})
	images: string[];
}

export class RatingStatsDto {
	@ApiProperty({ description: 'Total number of ratings' })
	totalRatings: number;

	@ApiProperty({ description: 'Average rating' })
	averageRating: number;

	@ApiProperty({ description: 'Rating distribution (1-5 stars)' })
	distribution: {
		1: number;
		2: number;
		3: number;
		4: number;
		5: number;
	};
}
