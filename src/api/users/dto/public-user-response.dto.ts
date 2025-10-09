import { ApiProperty } from '@nestjs/swagger';
import { RatingResponseDto, RatingStatsDto } from '../../rating/dto';

export class PublicUserResponseDto {
	@ApiProperty({ description: 'User ID' })
	id: string;

	@ApiProperty({ description: 'User first name', required: false })
	firstName?: string;

	@ApiProperty({ description: 'User last name', required: false })
	lastName?: string;

	@ApiProperty({ description: 'User display name (masked if not authenticated)' })
	name: string;

	@ApiProperty({ description: 'User email (masked if not authenticated)', required: false })
	email?: string;

	@ApiProperty({ description: 'User phone (masked if not authenticated)', required: false })
	phone?: string;

	@ApiProperty({ description: 'User avatar URL', required: false })
	avatarUrl?: string;

	@ApiProperty({ description: 'User gender', required: false })
	gender?: string;

	@ApiProperty({ description: 'User role' })
	role: string;

	@ApiProperty({ description: 'User bio', required: false })
	bio?: string;

	@ApiProperty({ description: 'Whether phone is verified' })
	isVerifiedPhone: boolean;

	@ApiProperty({ description: 'Whether email is verified' })
	isVerifiedEmail: boolean;

	@ApiProperty({ description: 'Whether identity is verified' })
	isVerifiedIdentity: boolean;

	@ApiProperty({ description: 'Whether bank account is verified' })
	isVerifiedBank: boolean;

	@ApiProperty({ description: 'Overall rating', required: false })
	overallRating?: number;

	@ApiProperty({ description: 'Total number of ratings received' })
	totalRatings: number;

	@ApiProperty({ description: 'User creation date' })
	createdAt: Date;

	@ApiProperty({ description: 'User last update date' })
	updatedAt: Date;

	@ApiProperty({
		description: 'Aggregated rating stats for this user',
		required: false,
		type: RatingStatsDto,
	})
	ratingStats?: RatingStatsDto;

	@ApiProperty({
		description: 'Recent ratings for this user',
		required: false,
		type: [RatingResponseDto],
	})
	recentRatings?: RatingResponseDto[];

	@ApiProperty({
		description: 'Recent ratings this user sent to others',
		required: false,
		type: [RatingResponseDto],
	})
	recentGivenRatings?: RatingResponseDto[];
}
