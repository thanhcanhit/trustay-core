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

		// Check if user already rated this target (one rating per user per target)
		await this.checkDuplicateRating(targetType, targetId, reviewerId);

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
		context: { isAuthenticated: boolean; currentUserId?: string } = { isAuthenticated: false },
	): Promise<PaginatedResponseDto<RatingResponseDto> & { stats: RatingStatsDto }> {
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

		// Convert string parameters to numbers
		const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
		const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
		const minRatingNum = minRating
			? typeof minRating === 'string'
				? parseInt(minRating, 10)
				: minRating
			: undefined;
		const maxRatingNum = maxRating
			? typeof maxRating === 'string'
				? parseInt(maxRating, 10)
				: maxRating
			: undefined;

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

		if (minRatingNum || maxRatingNum) {
			where.rating = {};
			if (minRatingNum) {
				where.rating.gte = minRatingNum;
			}
			if (maxRatingNum) {
				where.rating.lte = maxRatingNum;
			}
		}

		const skip = (pageNum - 1) * limitNum;

		// If current user is authenticated and we're not filtering by specific reviewer,
		// we need to get all ratings and sort them to put current user's reviews first
		const shouldPrioritizeCurrentUser =
			context.isAuthenticated && context.currentUserId && !reviewerId;

		let ratings: any[];
		let total: number;

		if (shouldPrioritizeCurrentUser) {
			// Get all ratings for the query
			const allRatings = await this.prisma.rating.findMany({
				where,
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

			// Sort to put current user's reviews first, then by the specified sort order
			allRatings.sort((a, b) => {
				const aIsCurrentUser = a.reviewerId === context.currentUserId;
				const bIsCurrentUser = b.reviewerId === context.currentUserId;

				// Current user's reviews come first
				if (aIsCurrentUser && !bIsCurrentUser) {
					return -1;
				}
				if (!aIsCurrentUser && bIsCurrentUser) {
					return 1;
				}

				// For same user type, sort by the specified criteria
				const aValue = a[sortBy];
				const bValue = b[sortBy];

				if (sortOrder === 'desc') {
					return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
				} else {
					return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
				}
			});

			total = allRatings.length;
			ratings = allRatings.slice(skip, skip + limitNum);
		} else {
			// Use normal query with database sorting
			[ratings, total] = await Promise.all([
				this.prisma.rating.findMany({
					where,
					skip,
					take: limitNum,
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
		}

		const formattedRatings = ratings.map((rating) => this.formatRatingResponse(rating, context));

		// Get stats for the filtered results
		const stats = await this.getRatingStatsForQuery(where);

		return {
			...PaginatedResponseDto.create(formattedRatings, pageNum, limitNum, total),
			stats,
		};
	}

	async findOne(
		id: string,
		context: { isAuthenticated: boolean; currentUserId?: string } = { isAuthenticated: false },
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
			select: { reviewerId: true, targetType: true, targetId: true },
		});

		if (!rating) {
			throw new NotFoundException('Rating not found');
		}

		// Check if user can update this rating
		await this.validateRatingOwnership(rating.reviewerId, userId, 'update');

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

		return this.formatRatingResponse(updatedRating, {
			isAuthenticated: true,
			currentUserId: userId,
		});
	}

	async remove(id: string, userId: string): Promise<void> {
		const rating = await this.prisma.rating.findUnique({
			where: { id },
			select: { reviewerId: true, targetType: true, targetId: true },
		});

		if (!rating) {
			throw new NotFoundException('Rating not found');
		}

		// Check if user can delete this rating
		await this.validateRatingOwnership(rating.reviewerId, userId, 'delete');

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

	private async getRatingStatsForQuery(where: any): Promise<RatingStatsDto> {
		const ratings = await this.prisma.rating.findMany({
			where,
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

	private async checkDuplicateRating(
		targetType: RatingTargetType,
		targetId: string,
		reviewerId: string,
	): Promise<void> {
		const existingRating = await this.prisma.rating.findFirst({
			where: {
				targetType,
				targetId,
				reviewerId,
			},
		});

		if (existingRating) {
			throw new BadRequestException(
				`You have already rated this ${targetType}. Each user can only rate a target once.`,
			);
		}
	}

	private async validateRatingPermission(
		targetType: RatingTargetType,
		targetId: string,
		reviewerId: string,
		_rentalId?: string,
	): Promise<void> {
		// Simplified validation - only check basic rules

		// Can't rate yourself
		if (targetId === reviewerId) {
			throw new BadRequestException('You cannot rate yourself');
		}

		// Validate target type
		if (!Object.values(RatingTargetType).includes(targetType)) {
			throw new BadRequestException('Invalid rating target type');
		}

		// Optional: Validate target exists (basic check)
		switch (targetType) {
			case RatingTargetType.tenant:
			case RatingTargetType.landlord: {
				// Check if target user exists
				const user = await this.prisma.user.findUnique({
					where: { id: targetId },
					select: { id: true },
				});

				if (!user) {
					throw new NotFoundException('Target user not found');
				}
				break;
			}

			case RatingTargetType.room: {
				// Check if target room exists
				const room = await this.prisma.room.findUnique({
					where: { id: targetId },
					select: { id: true },
				});

				if (!room) {
					throw new NotFoundException('Target room not found');
				}
				break;
			}

			default:
				throw new BadRequestException('Invalid rating target type');
		}
	}

	// Removed response validation for simplified version

	private async validateRatingOwnership(
		reviewerId: string,
		userId: string,
		action: 'update' | 'delete',
	): Promise<void> {
		if (reviewerId !== userId) {
			throw new ForbiddenException(`You can only ${action} your own ratings`);
		}
	}

	private formatRatingResponse(
		rating: any,
		context: { isAuthenticated: boolean; currentUserId?: string } = { isAuthenticated: false },
	): RatingResponseDto {
		const { isAuthenticated, currentUserId } = context;

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
			isCurrentUser: currentUserId ? rating.reviewerId === currentUserId : false,
		};
	}
}
