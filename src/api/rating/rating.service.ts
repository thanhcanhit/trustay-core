import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { RatingTargetType } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { maskFullName } from '../../common/utils/mask.utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
	CreateRatingDto,
	RatingQueryDto,
	RatingResponseDto,
	RatingStatsDto,
	UpdateRatingDto,
} from './dto';

@Injectable()
export class RatingService {
	constructor(private readonly prisma: PrismaService) {}

	async create(createRatingDto: CreateRatingDto, reviewerId: string): Promise<RatingResponseDto> {
		const { targetType, targetId, rentalId, ...ratingData } = createRatingDto;

		// Validate target exists and permissions
		await this.validateRatingPermission(targetType, targetId, reviewerId, rentalId);

		// Check if user already rated this target
		const existingRating = await this.prisma.rating.findFirst({
			where: {
				targetType,
				targetId,
				reviewerId,
				...(rentalId && { rentalId }),
			},
		});

		if (existingRating) {
			throw new BadRequestException('You have already rated this target');
		}

		// Create rating and update overall rating
		const rating = await this.prisma.$transaction(async (tx) => {
			const newRating = await tx.rating.create({
				data: {
					...ratingData,
					targetType,
					targetId,
					reviewerId,
					rentalId,
				},
				include: {
					reviewer: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
							isVerifiedPhone: true,
							isVerifiedEmail: true,
							isVerifiedIdentity: true,
						},
					},
				},
			});

			// Update overall rating for the target
			await this.updateOverallRating(tx, targetType, targetId);

			return newRating;
		});

		return this.formatRatingResponse(rating);
	}

	async findAll(
		query: RatingQueryDto,
		context: { isAuthenticated: boolean } = { isAuthenticated: false },
	): Promise<PaginatedResponseDto<RatingResponseDto>> {
		const {
			page = 1,
			limit = 20,
			targetType,
			targetId,
			reviewerId,
			rentalId,
			minRating,
			maxRating,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const where: any = {};

		if (targetType) {
			where.targetType = targetType;
		}
		if (targetId) {
			where.targetId = targetId;
		}
		if (reviewerId) {
			where.reviewerId = reviewerId;
		}
		if (rentalId) {
			where.rentalId = rentalId;
		}

		if (minRating || maxRating) {
			where.rating = {};
			if (minRating) {
				where.rating.gte = minRating;
			}
			if (maxRating) {
				where.rating.lte = maxRating;
			}
		}

		const skip = (page - 1) * limit;

		const [ratings, total] = await Promise.all([
			this.prisma.rating.findMany({
				where,
				skip,
				take: limit,
				orderBy: { [sortBy]: sortOrder },
				include: {
					reviewer: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
							isVerifiedPhone: true,
							isVerifiedEmail: true,
							isVerifiedIdentity: true,
						},
					},
				},
			}),
			this.prisma.rating.count({ where }),
		]);

		const formattedRatings = ratings.map((rating) => this.formatRatingResponse(rating, context));

		return PaginatedResponseDto.create(formattedRatings, page, limit, total);
	}

	async findOne(
		id: string,
		context: { isAuthenticated: boolean } = { isAuthenticated: false },
	): Promise<RatingResponseDto> {
		const rating = await this.prisma.rating.findUnique({
			where: { id },
			include: {
				reviewer: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						avatarUrl: true,
						isVerifiedPhone: true,
						isVerifiedEmail: true,
						isVerifiedIdentity: true,
					},
				},
			},
		});

		if (!rating) {
			throw new NotFoundException('Rating not found');
		}

		// Note: In simplified version, all ratings are public

		return this.formatRatingResponse(rating, context);
	}

	async update(
		id: string,
		updateRatingDto: UpdateRatingDto,
		userId: string,
	): Promise<RatingResponseDto> {
		const rating = await this.prisma.rating.findUnique({
			where: { id },
			select: { reviewerId: true },
		});

		if (!rating) {
			throw new NotFoundException('Rating not found');
		}

		if (rating.reviewerId !== userId) {
			throw new ForbiddenException('You can only update your own ratings');
		}

		const updatedRating = await this.prisma.$transaction(async (tx) => {
			const updated = await tx.rating.update({
				where: { id },
				data: updateRatingDto,
				include: {
					reviewer: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
							isVerifiedPhone: true,
							isVerifiedEmail: true,
							isVerifiedIdentity: true,
						},
					},
				},
			});

			// Update overall rating for the target
			await this.updateOverallRating(tx, updated.targetType, updated.targetId);

			return updated;
		});

		return this.formatRatingResponse(updatedRating);
	}

	async remove(id: string, userId: string): Promise<void> {
		const rating = await this.prisma.rating.findUnique({
			where: { id },
			select: { reviewerId: true, targetType: true, targetId: true },
		});

		if (!rating) {
			throw new NotFoundException('Rating not found');
		}

		if (rating.reviewerId !== userId) {
			throw new ForbiddenException('You can only delete your own ratings');
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.rating.delete({
				where: { id },
			});

			// Update overall rating for the target
			await this.updateOverallRating(tx, rating.targetType, rating.targetId);
		});
	}

	private async updateOverallRating(
		tx: any,
		targetType: RatingTargetType,
		targetId: string,
	): Promise<void> {
		// Calculate new overall rating
		const ratings = await tx.rating.findMany({
			where: {
				targetType,
				targetId,
			},
			select: {
				rating: true,
			},
		});

		const totalRatings = ratings.length;
		const averageRating =
			totalRatings > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings : 0;

		// Update the target model based on type
		switch (targetType) {
			case RatingTargetType.tenant:
			case RatingTargetType.landlord:
				await tx.user.update({
					where: { id: targetId },
					data: {
						overallRating: averageRating,
						totalRatings,
					},
				});
				break;

			case RatingTargetType.room:
				await tx.room.update({
					where: { id: targetId },
					data: {
						overallRating: averageRating,
						totalRatings,
					},
				});
				break;
		}
	}

	// Removed response functionality for simplified version

	async getRatingStats(targetType: RatingTargetType, targetId: string): Promise<RatingStatsDto> {
		const ratings = await this.prisma.rating.findMany({
			where: {
				targetType,
				targetId,
			},
			select: {
				rating: true,
			},
		});

		if (ratings.length === 0) {
			return {
				totalRatings: 0,
				averageRating: 0,
				distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
			};
		}

		const totalRatings = ratings.length;
		const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;

		// Calculate distribution
		const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
		ratings.forEach((rating) => {
			distribution[rating.rating as keyof typeof distribution]++;
		});

		return {
			totalRatings,
			averageRating: Math.round(averageRating * 10) / 10,
			distribution,
		};
	}

	// Removed helpful functionality for simplified version

	private async validateRatingPermission(
		targetType: RatingTargetType,
		targetId: string,
		reviewerId: string,
		rentalId?: string,
	): Promise<void> {
		switch (targetType) {
			case RatingTargetType.tenant:
			case RatingTargetType.landlord: {
				// For tenant/landlord ratings, must have a rental relationship
				if (!rentalId) {
					throw new BadRequestException('Rental ID is required for tenant/landlord ratings');
				}

				const rental = await this.prisma.rental.findUnique({
					where: { id: rentalId },
					select: { tenantId: true, ownerId: true, status: true },
				});

				if (!rental) {
					throw new NotFoundException('Rental not found');
				}

				// Validate the reviewer is part of this rental
				if (rental.tenantId !== reviewerId && rental.ownerId !== reviewerId) {
					throw new ForbiddenException('You are not part of this rental');
				}

				// Validate the target is the other party in the rental
				if (targetType === RatingTargetType.tenant && rental.tenantId !== targetId) {
					throw new BadRequestException('Target ID does not match rental tenant');
				}
				if (targetType === RatingTargetType.landlord && rental.ownerId !== targetId) {
					throw new BadRequestException('Target ID does not match rental owner');
				}

				// Can't rate yourself
				if (targetId === reviewerId) {
					throw new BadRequestException('You cannot rate yourself');
				}
				break;
			}

			case RatingTargetType.room: {
				// For room ratings, check if user has stayed in the room
				const roomRental = await this.prisma.rental.findFirst({
					where: {
						tenantId: reviewerId,
						roomInstance: {
							roomId: targetId,
						},
						status: { in: ['terminated', 'expired'] }, // Only completed stays
					},
				});

				if (!roomRental) {
					throw new ForbiddenException('You can only rate rooms you have stayed in');
				}
				break;
			}

			default:
				throw new BadRequestException('Invalid rating target type');
		}
	}

	// Removed response validation for simplified version

	private formatRatingResponse(
		rating: any,
		context: { isAuthenticated: boolean } = { isAuthenticated: false },
	): RatingResponseDto {
		const { isAuthenticated } = context;

		// Format reviewer information
		let reviewer = {
			id: rating.reviewer.id,
			firstName: undefined,
			lastName: undefined,
			avatarUrl: undefined,
			isVerified:
				rating.reviewer.isVerifiedPhone ||
				rating.reviewer.isVerifiedEmail ||
				rating.reviewer.isVerifiedIdentity,
		};

		// Show reviewer info (simplified - always show some info)
		const fullName = `${rating.reviewer.firstName || ''} ${rating.reviewer.lastName || ''}`.trim();
		reviewer = {
			...reviewer,
			firstName: isAuthenticated ? rating.reviewer.firstName : undefined,
			lastName: isAuthenticated ? rating.reviewer.lastName : undefined,
			avatarUrl: rating.reviewer.avatarUrl,
		};

		// If not authenticated, mask the name
		if (!isAuthenticated && fullName) {
			const maskedName = maskFullName(fullName);
			const nameParts = maskedName.split(' ');
			reviewer.firstName = nameParts[0];
			reviewer.lastName = nameParts.slice(1).join(' ') || undefined;
		}

		return {
			id: rating.id,
			targetType: rating.targetType,
			targetId: rating.targetId,
			reviewerId: rating.reviewerId,
			rentalId: rating.rentalId,
			rating: rating.rating,
			content: rating.content,
			createdAt: rating.createdAt,
			updatedAt: rating.updatedAt,
			reviewer,
			images: rating.images || [],
		};
	}
}
