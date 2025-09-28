import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { RoommatePostStatus } from '@prisma/client';
import { PaginatedResponseDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { generateSlug, generateUniqueSlug } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
	CreateRoommateSeekingPostDto,
	RoommateSeekingDetailWithMetaResponseDto,
	RoommateSeekingPostResponseDto,
	UpdateRoommateSeekingPostDto,
} from './dto';

@Injectable()
export class RoommateSeekingPostService {
	private viewCache = new Map<string, { timestamp: number; ips: Set<string> }>();
	private readonly VIEW_COOLDOWN_MS = 1 * 60 * 1000; // 1 phút

	constructor(private readonly prisma: PrismaService) {
		// Dọn dẹp cache định kỳ
		setInterval(
			() => {
				this.cleanupViewCache();
			},
			30 * 60 * 1000,
		); // 30 phút
	}

	private cleanupViewCache(): void {
		const now = Date.now();
		for (const [key, value] of this.viewCache.entries()) {
			if (now - value.timestamp > this.VIEW_COOLDOWN_MS * 2) {
				this.viewCache.delete(key);
			}
		}
	}

	private shouldIncrementView(postId: string, clientIp?: string): boolean {
		const cacheKey = postId;
		const now = Date.now();

		if (!this.viewCache.has(cacheKey)) {
			this.viewCache.set(cacheKey, {
				timestamp: now,
				ips: new Set(clientIp ? [clientIp] : []),
			});
			return true;
		}

		const cacheEntry = this.viewCache.get(cacheKey)!;

		if (clientIp && cacheEntry.ips.has(clientIp)) {
			if (now - cacheEntry.timestamp < this.VIEW_COOLDOWN_MS) {
				return false;
			}
		}

		if (clientIp) {
			cacheEntry.ips.add(clientIp);
		}
		cacheEntry.timestamp = now;

		return true;
	}

	async create(
		createDto: CreateRoommateSeekingPostDto,
		tenantId: string,
	): Promise<RoommateSeekingPostResponseDto> {
		// Validate platform room constraints
		if (createDto.roomInstanceId) {
			await this.validatePlatformRoomConstraints(createDto, tenantId);
		}

		// Validate required fields for external rooms
		if (!createDto.roomInstanceId && !createDto.externalAddress) {
			throw new BadRequestException(
				'Phải cung cấp thông tin phòng (roomInstanceId hoặc externalAddress)',
			);
		}

		// Generate slug
		const baseSlug = generateSlug(createDto.title);
		const slug = await generateUniqueSlug(baseSlug, async (slug: string) => {
			const existing = await this.prisma.roommateSeekingPost.findUnique({
				where: { slug },
			});
			return existing !== null;
		});

		// Calculate remaining slots
		const remainingSlots = createDto.seekingCount;

		const post = await this.prisma.roommateSeekingPost.create({
			data: {
				...createDto,
				slug,
				tenantId,
				remainingSlots,
				availableFromDate: new Date(createDto.availableFromDate),
				expiresAt: createDto.expiresAt ? new Date(createDto.expiresAt) : undefined,
			},
			include: this.getIncludeOptions(),
		});

		return this.mapToResponseDto(post);
	}

	async findMyPosts(
		query: PaginationQueryDto,
		tenantId: string,
	): Promise<PaginatedResponseDto<RoommateSeekingPostResponseDto>> {
		const { page = 1, limit = 10 } = query;
		const skip = (page - 1) * limit;

		const [posts, total] = await Promise.all([
			this.prisma.roommateSeekingPost.findMany({
				where: { tenantId },
				include: this.getIncludeOptions(),
				orderBy: { createdAt: 'desc' },
				skip,
				take: limit,
			}),
			this.prisma.roommateSeekingPost.count({
				where: { tenantId },
			}),
		]);

		return PaginatedResponseDto.create(
			posts.map((post) => this.mapToResponseDto(post)),
			page,
			limit,
			total,
		);
	}

	async findOne(
		id: string,
		clientIp?: string,
		_options?: { isAuthenticated?: boolean },
	): Promise<RoommateSeekingDetailWithMetaResponseDto> {
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id },
			include: {
				...this.getIncludeOptions(),
				applications: {
					include: {
						applicant: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});

		if (!post) {
			throw new NotFoundException('Không tìm thấy bài đăng');
		}

		// Increment view count
		if (this.shouldIncrementView(id, clientIp)) {
			await this.prisma.roommateSeekingPost.update({
				where: { id },
				data: { viewCount: { increment: 1 } },
			});
			post.viewCount += 1;
		}

		const responseDto = this.mapToResponseDto(post);

		return {
			...responseDto,
			isOwner: false, // Will be set by controller if authenticated
			canEdit: false,
			canApply: post.status === RoommatePostStatus.active && post.remainingSlots > 0,
		};
	}

	async update(
		id: string,
		updateDto: UpdateRoommateSeekingPostDto,
		tenantId: string,
	): Promise<RoommateSeekingPostResponseDto> {
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id },
		});

		if (!post) {
			throw new NotFoundException('Không tìm thấy bài đăng');
		}

		if (post.tenantId !== tenantId) {
			throw new ForbiddenException('Không có quyền chỉnh sửa bài đăng này');
		}

		// Update remaining slots if seeking count changed
		let remainingSlots = post.remainingSlots;
		if (updateDto.seekingCount !== undefined) {
			const changeInSeeking = updateDto.seekingCount - post.seekingCount;
			remainingSlots = Math.max(0, post.remainingSlots + changeInSeeking);
		}

		const updatedPost = await this.prisma.roommateSeekingPost.update({
			where: { id },
			data: {
				...updateDto,
				remainingSlots,
				availableFromDate: updateDto.availableFromDate
					? new Date(updateDto.availableFromDate)
					: undefined,
				expiresAt: updateDto.expiresAt ? new Date(updateDto.expiresAt) : undefined,
			},
			include: this.getIncludeOptions(),
		});

		return this.mapToResponseDto(updatedPost);
	}

	async remove(id: string, tenantId: string): Promise<void> {
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id },
		});

		if (!post) {
			throw new NotFoundException('Không tìm thấy bài đăng');
		}

		if (post.tenantId !== tenantId) {
			throw new ForbiddenException('Không có quyền xóa bài đăng này');
		}

		await this.prisma.roommateSeekingPost.delete({
			where: { id },
		});
	}

	async updateStatus(
		id: string,
		status: RoommatePostStatus,
		tenantId: string,
	): Promise<RoommateSeekingPostResponseDto> {
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id },
		});

		if (!post) {
			throw new NotFoundException('Không tìm thấy bài đăng');
		}

		if (post.tenantId !== tenantId) {
			throw new ForbiddenException('Không có quyền thay đổi trạng thái bài đăng này');
		}

		const updatedPost = await this.prisma.roommateSeekingPost.update({
			where: { id },
			data: { status },
			include: this.getIncludeOptions(),
		});

		return this.mapToResponseDto(updatedPost);
	}

	private async validatePlatformRoomConstraints(
		dto: CreateRoommateSeekingPostDto,
		tenantId: string,
	): Promise<void> {
		if (!dto.roomInstanceId) {
			return;
		}

		// Check if user has active rental for this room
		const rental = await this.prisma.rental.findFirst({
			where: {
				roomInstanceId: dto.roomInstanceId,
				tenantId,
				status: 'active',
			},
			include: {
				roomInstance: {
					include: {
						room: true,
					},
				},
			},
		});

		if (!rental) {
			throw new BadRequestException('Bạn không có hợp đồng thuê đang hoạt động cho phòng này');
		}

		// Validate seeking count doesn't exceed room capacity
		// Add business logic validation here if needed
	}

	private getIncludeOptions() {
		return {
			tenant: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					avatarUrl: true,
					phoneNumber: true,
				},
			},
			roomInstance: {
				select: {
					id: true,
					roomNumber: true,
					room: {
						select: {
							id: true,
							name: true,
							building: {
								select: {
									id: true,
									name: true,
									address: true,
								},
							},
						},
					},
				},
			},
			externalProvince: {
				select: {
					id: true,
					name: true,
				},
			},
			externalDistrict: {
				select: {
					id: true,
					name: true,
				},
			},
			externalWard: {
				select: {
					id: true,
					name: true,
				},
			},
		};
	}

	private mapToResponseDto(post: any): RoommateSeekingPostResponseDto {
		return {
			id: post.id,
			title: post.title,
			description: post.description,
			slug: post.slug,
			tenantId: post.tenantId,
			roomInstanceId: post.roomInstanceId,
			rentalId: post.rentalId,
			externalAddress: post.externalAddress,
			externalProvinceId: post.externalProvinceId,
			externalDistrictId: post.externalDistrictId,
			externalWardId: post.externalWardId,
			monthlyRent: Number(post.monthlyRent),
			currency: post.currency,
			depositAmount: Number(post.depositAmount),
			utilityCostPerPerson: post.utilityCostPerPerson
				? Number(post.utilityCostPerPerson)
				: undefined,
			seekingCount: post.seekingCount,
			approvedCount: post.approvedCount,
			remainingSlots: post.remainingSlots,
			maxOccupancy: post.maxOccupancy,
			currentOccupancy: post.currentOccupancy,
			preferredGender: post.preferredGender,
			additionalRequirements: post.additionalRequirements,
			availableFromDate: post.availableFromDate.toISOString(),
			minimumStayMonths: post.minimumStayMonths,
			maximumStayMonths: post.maximumStayMonths,
			status: post.status,
			requiresLandlordApproval: post.requiresLandlordApproval,
			isApprovedByLandlord: post.isApprovedByLandlord,
			landlordNotes: post.landlordNotes,
			isActive: post.isActive,
			expiresAt: post.expiresAt?.toISOString(),
			viewCount: post.viewCount,
			contactCount: post.contactCount,
			createdAt: post.createdAt.toISOString(),
			updatedAt: post.updatedAt.toISOString(),
			tenant: post.tenant,
			roomInstance: post.roomInstance,
			externalProvince: post.externalProvince,
			externalDistrict: post.externalDistrict,
			externalWard: post.externalWard,
		};
	}
}
