import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { SearchPostStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { BreadcrumbDto, SeoDto } from '../../common/dto';
import { PaginatedResponseDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PersonPublicView } from '../../common/serialization/person.view';
import { generateSlug, generateUniqueSlug } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { ElasticsearchQueueService } from '../../queue/services/elasticsearch-queue.service';
import { CreateRoomSeekingPostDto, RoomRoomSeekingPostDto, UpdateRoomSeekingPostDto } from './dto';
import { RoomSeekingDetailWithMetaResponseDto } from './dto/room-seeking-detail-with-meta.dto';

@Injectable()
export class RoomSeekingPostService {
	private viewCache = new Map<string, { timestamp: number; ips: Set<string> }>();
	private readonly VIEW_COOLDOWN_MS = 1 * 60 * 1000; // 1 phút
	private readonly CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 phút

	constructor(
		private readonly prisma: PrismaService,
		private readonly elasticsearchQueueService: ElasticsearchQueueService,
	) {
		// Dọn dẹp cache định kỳ
		setInterval(() => {
			this.cleanupViewCache();
		}, this.CACHE_CLEANUP_INTERVAL);
	}

	/**
	 * Dọn dẹp cache view cũ
	 */
	private cleanupViewCache(): void {
		const now = Date.now();
		for (const [key, value] of this.viewCache.entries()) {
			if (now - value.timestamp > this.VIEW_COOLDOWN_MS * 2) {
				this.viewCache.delete(key);
			}
		}
	}

	/**
	 * Kiểm tra và ghi nhận view mới
	 * @param postId - ID của bài đăng
	 * @param clientIp - IP của client (có thể undefined nếu không có)
	 * @returns true nếu view hợp lệ, false nếu bị chặn do spam
	 */
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

		// Nếu có IP và IP này đã xem trong thời gian cooldown
		if (clientIp && cacheEntry.ips.has(clientIp)) {
			if (now - cacheEntry.timestamp < this.VIEW_COOLDOWN_MS) {
				return false; // Chặn spam từ cùng IP
			}
		}

		// Cập nhật cache
		if (clientIp) {
			cacheEntry.ips.add(clientIp);
		}
		cacheEntry.timestamp = now;

		return true;
	}

	/**
	 * Generate SEO data for room seeking detail page
	 */
	private async generateRoomSeekingDetailSeo(post: any): Promise<SeoDto> {
		const {
			title,
			preferredRoomType,
			preferredProvince,
			preferredDistrict,
			preferredWard,
			minBudget,
			maxBudget,
		} = post;

		// Get room type info
		const roomTypeMap: Record<string, string> = {
			boarding_house: 'nhà trọ',
			dormitory: 'ký túc xá',
			sleepbox: 'sleepbox',
			apartment: 'chung cư',
			whole_house: 'nhà nguyên căn',
		};
		const roomTypeText = preferredRoomType
			? roomTypeMap[preferredRoomType] || preferredRoomType
			: 'phòng trọ';

		// Get location info
		const locationParts = [];
		if (preferredWard?.name) {
			locationParts.push(preferredWard.name);
		}
		if (preferredDistrict?.name) {
			locationParts.push(preferredDistrict.name);
		}
		if (preferredProvince?.name) {
			locationParts.push(preferredProvince.name);
		}

		// Get budget info
		let budgetText = '';
		if (minBudget && maxBudget) {
			budgetText = `từ ${(Number(minBudget) / 1000000).toFixed(1)} triệu đến ${(Number(maxBudget) / 1000000).toFixed(1)} triệu`;
		} else if (minBudget) {
			budgetText = `từ ${(Number(minBudget) / 1000000).toFixed(1)} triệu`;
		} else if (maxBudget) {
			budgetText = `dưới ${(Number(maxBudget) / 1000000).toFixed(1)} triệu`;
		}

		// Build title
		let seoTitle = title;
		if (locationParts.length > 0) {
			seoTitle += ` tại ${locationParts.join(', ')}`;
		}
		if (budgetText) {
			seoTitle += ` ${budgetText}`;
		}
		seoTitle += ' | Trustay';

		// Build description
		let description = `${title} - Tìm ${roomTypeText} chất lượng cao`;
		if (locationParts.length > 0) {
			description += ` tại ${locationParts.join(', ')}`;
		}
		if (budgetText) {
			description += ` với ngân sách ${budgetText}`;
		}
		description += '. Kết nối chủ nhà và người thuê hiệu quả!';

		// Build keywords
		const keywords = [
			title,
			'tìm người thuê',
			'đăng tin tìm trọ',
			'room seeking',
			roomTypeText,
			...locationParts,
			budgetText ? 'ngân sách' : '',
			'chủ nhà',
			'người thuê',
		]
			.filter(Boolean)
			.join(', ');

		return {
			title: seoTitle,
			description,
			keywords,
		};
	}

	/**
	 * Generate breadcrumb for room seeking detail page
	 */
	private async generateRoomSeekingDetailBreadcrumb(post: any): Promise<BreadcrumbDto> {
		const { title, preferredRoomType, preferredProvince, preferredDistrict } = post;

		const items = [
			{ title: 'Trang chủ', path: '/' },
			{ title: 'Tìm người thuê', path: '/room-seekings' },
		];

		if (preferredDistrict?.name) {
			items.push({
				title: preferredDistrict.name,
				path: `/room-seekings?districtId=${preferredDistrict.id}`,
			});
		}
		if (preferredProvince?.name) {
			items.push({
				title: preferredProvince.name,
				path: `/room-seekings?provinceId=${preferredProvince.id}`,
			});
		}

		// Add room type breadcrumb
		if (preferredRoomType) {
			const roomTypeMap: Record<string, string> = {
				boarding_house: 'Nhà trọ',
				dormitory: 'Ký túc xá',
				sleepbox: 'Sleepbox',
				apartment: 'Chung cư',
				whole_house: 'Nhà nguyên căn',
			};
			items.push({
				title: roomTypeMap[preferredRoomType] || preferredRoomType,
				path: `/room-seekings?roomType=${preferredRoomType}`,
			});
		}

		// Add post title (current page)
		items.push({
			title: title,
			path: `/room-seekings/${post.slug}`,
		});

		return { items };
	}

	/**
	 * Converts date string to Date object with validation
	 * @param dateString - Date string in ISO format
	 * @returns Date object or undefined if input is falsy
	 */
	private convertToDate(dateString?: string): Date | undefined {
		if (!dateString) {
			return undefined;
		}

		const date = new Date(dateString);
		if (Number.isNaN(date.getTime())) {
			throw new BadRequestException(
				`Invalid date format: ${dateString}. Expected ISO-8601 format.`,
			);
		}

		return date;
	}

	/**
	 * Validates that location IDs exist in the database
	 * @param roomRequestData - Room request data containing location IDs
	 */
	private async validateLocationIds(roomRequestData: any): Promise<void> {
		const { preferredProvinceId, preferredDistrictId, preferredWardId } = roomRequestData;

		// Validate province exists
		if (preferredProvinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: preferredProvinceId },
			});
			if (!province) {
				throw new BadRequestException(`Province with ID ${preferredProvinceId} not found`);
			}
		}

		// Validate district exists and belongs to province
		if (preferredDistrictId) {
			const district = await this.prisma.district.findUnique({
				where: { id: preferredDistrictId },
				include: { province: true },
			});
			if (!district) {
				throw new BadRequestException(`District with ID ${preferredDistrictId} not found`);
			}
			if (preferredProvinceId && district.provinceId !== preferredProvinceId) {
				throw new BadRequestException(
					`District with ID ${preferredDistrictId} does not belong to province with ID ${preferredProvinceId}`,
				);
			}
		}

		// Validate ward exists and belongs to district
		if (preferredWardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: preferredWardId },
				include: { district: true },
			});
			if (!ward) {
				throw new BadRequestException(`Ward with ID ${preferredWardId} not found`);
			}
			if (preferredDistrictId && ward.districtId !== preferredDistrictId) {
				throw new BadRequestException(
					`Ward with ID ${preferredWardId} does not belong to district with ID ${preferredDistrictId}`,
				);
			}
		}
	}

	async findMyPosts(
		query: PaginationQueryDto,
		userId: string,
	): Promise<PaginatedResponseDto<RoomRoomSeekingPostDto>> {
		const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', search } = query;

		const where: any = {
			requesterId: userId,
			...(search && {
				OR: [
					{ title: { contains: search, mode: 'insensitive' } },
					{ description: { contains: search, mode: 'insensitive' } },
				],
			}),
		};

		const [items, total] = await Promise.all([
			this.prisma.roomSeekingPost.findMany({
				where,
				orderBy: { [sortBy]: sortOrder },
				skip: (page - 1) * limit,
				take: limit,
				include: {
					requester: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							avatarUrl: true,
							overallRating: true,
							totalRatings: true,
						},
					},
					amenities: {
						select: {
							id: true,
							name: true,
							nameEn: true,
							category: true,
							description: true,
						},
					},
					preferredProvince: { select: { id: true, name: true, nameEn: true } },
					preferredDistrict: { select: { id: true, name: true, nameEn: true } },
					preferredWard: { select: { id: true, name: true, nameEn: true } },
				},
			}),
			this.prisma.roomSeekingPost.count({ where }),
		]);

		return PaginatedResponseDto.create(
			items.map((item) => {
				const dto = this.mapToResponseDto(item);
				return {
					...dto,
					// Always show full info for authenticated user's own posts
					requester: plainToInstance(PersonPublicView, dto.requester, {
						groups: ['auth'],
					}),
				};
			}),
			page,
			limit,
			total,
		);
	}

	async create(
		createRoomRequestDto: CreateRoomSeekingPostDto,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		const { amenityIds, ...roomRequestData } = createRoomRequestDto;

		// Generate unique slug from title
		const baseSlug = generateSlug(roomRequestData.title);
		const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
			const existing = await this.prisma.roomSeekingPost.findUnique({
				where: { slug },
				select: { id: true },
			});
			return !!existing;
		});

		// Validate location IDs exist
		await this.validateLocationIds(roomRequestData);

		// Convert date strings to Date objects
		const processedData = {
			...roomRequestData,
			moveInDate: this.convertToDate(roomRequestData.moveInDate),
			expiresAt: this.convertToDate(roomRequestData.expiresAt),
		};

		// Tạo room request với amenities
		let roomRequest: any;
		try {
			roomRequest = await this.prisma.roomSeekingPost.create({
				data: {
					...processedData,
					slug: uniqueSlug,
					requesterId,
					status: SearchPostStatus.active,
					currency: roomRequestData.currency || 'VND',
					isPublic: roomRequestData.isPublic ?? true,
					amenities:
						amenityIds && amenityIds.length > 0
							? {
									connect: amenityIds.map((amenityId) => ({ id: amenityId })),
								}
							: undefined,
				},
				include: {
					requester: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							avatarUrl: true,
							overallRating: true,
							totalRatings: true,
						},
					},
					amenities: {
						select: {
							id: true,
							name: true,
							nameEn: true,
							category: true,
							description: true,
						},
					},
					preferredProvince: {
						select: {
							id: true,
							name: true,
							nameEn: true,
						},
					},
					preferredDistrict: {
						select: {
							id: true,
							name: true,
							nameEn: true,
						},
					},
					preferredWard: {
						select: {
							id: true,
							name: true,
							nameEn: true,
						},
					},
				},
			});
		} catch (error) {
			// Handle Prisma foreign key constraint errors
			if (error.code === 'P2003') {
				throw new BadRequestException(
					'Invalid location data. Please check province, district, and ward IDs.',
				);
			}
			// Re-throw other errors
			throw error;
		}

		// Queue Elasticsearch indexing (async, best-effort)
		void this.elasticsearchQueueService.queueIndexRoomSeeking(roomRequest.id);

		const dto = this.mapToResponseDto(roomRequest);
		return {
			...dto,
			// Always show full info for authenticated user's own posts
			requester: plainToInstance(PersonPublicView, dto.requester, {
				groups: ['auth'],
			}),
		};
	}

	async findOne(
		id: string,
		clientIp?: string,
		options: { isAuthenticated?: boolean } = { isAuthenticated: false },
	): Promise<RoomSeekingDetailWithMetaResponseDto> {
		const isAuthenticated = options.isAuthenticated ?? false;
		const roomRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			include: {
				requester: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						avatarUrl: true,
						isVerifiedPhone: true,
						isVerifiedEmail: true,
						isVerifiedIdentity: true,
						isOnline: true,
						lastActiveAt: true,
					},
				},
				amenities: {
					select: {
						id: true,
						name: true,
						nameEn: true,
						category: true,
						description: true,
					},
				},
				preferredProvince: {
					select: {
						id: true,
						name: true,
						nameEn: true,
					},
				},
				preferredDistrict: {
					select: {
						id: true,
						name: true,
						nameEn: true,
					},
				},
				preferredWard: {
					select: {
						id: true,
						name: true,
						nameEn: true,
					},
				},
			},
		});

		if (!roomRequest) {
			throw new NotFoundException('Room seeking post not found');
		}

		// Tăng view count với chiến lược chống spam
		if (this.shouldIncrementView(id, clientIp)) {
			await this.prisma.roomSeekingPost.update({
				where: { id },
				data: { viewCount: { increment: 1 } },
			});
		}

		const dto = this.mapToResponseDto(roomRequest);

		// Generate SEO and breadcrumb
		const seo = await this.generateRoomSeekingDetailSeo(roomRequest);
		const breadcrumb = await this.generateRoomSeekingDetailBreadcrumb(roomRequest);

		return {
			...dto,
			// Use serialization groups to handle masking for requester
			requester: plainToInstance(PersonPublicView, dto.requester, {
				groups: isAuthenticated ? ['auth'] : [],
			}),
			seo,
			breadcrumb,
		};
	}

	async update(
		id: string,
		updateRoomRequestDto: UpdateRoomSeekingPostDto,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Room seeking post not found');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('You do not have permission to edit this post');
		}

		const { amenityIds, ...updateData } = updateRoomRequestDto;

		// Generate new slug if title changed
		let newSlug: string | undefined;
		if (updateData.title) {
			const baseSlug = generateSlug(updateData.title);
			newSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
				const existing = await this.prisma.roomSeekingPost.findFirst({
					where: {
						slug,
						id: { not: id },
					},
					select: { id: true },
				});
				return !!existing;
			});
		}

		// Validate location IDs if they are being updated
		if (
			updateData.preferredProvinceId ||
			updateData.preferredDistrictId ||
			updateData.preferredWardId
		) {
			await this.validateLocationIds(updateData);
		}

		// Convert date strings to Date objects
		const processedUpdateData = {
			...updateData,
			moveInDate: this.convertToDate(updateData.moveInDate),
			expiresAt: this.convertToDate(updateData.expiresAt),
		};

		// Cập nhật room request
		let updatedRequest: any;
		try {
			updatedRequest = await this.prisma.roomSeekingPost.update({
				where: { id },
				data: {
					...processedUpdateData,
					...(newSlug && { slug: newSlug }),
					...(amenityIds && {
						amenities: {
							set: amenityIds.map((amenityId) => ({ id: amenityId })),
						},
					}),
				},
				include: {
					requester: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							avatarUrl: true,
							overallRating: true,
							totalRatings: true,
						},
					},
					amenities: {
						select: {
							id: true,
							name: true,
							nameEn: true,
							category: true,
							description: true,
						},
					},
					preferredProvince: {
						select: {
							id: true,
							name: true,
							nameEn: true,
						},
					},
					preferredDistrict: {
						select: {
							id: true,
							name: true,
							nameEn: true,
						},
					},
					preferredWard: {
						select: {
							id: true,
							name: true,
							nameEn: true,
						},
					},
				},
			});
		} catch (error) {
			// Handle Prisma foreign key constraint errors
			if (error.code === 'P2003') {
				throw new BadRequestException(
					'Invalid location data. Please check province, district, and ward IDs.',
				);
			}
			// Re-throw other errors
			throw error;
		}

		// Queue Elasticsearch re-indexing (async, best-effort)
		void this.elasticsearchQueueService.queueIndexRoomSeeking(updatedRequest.id);

		const dto = this.mapToResponseDto(updatedRequest);
		return {
			...dto,
			// Always show full info for authenticated user's own posts
			requester: plainToInstance(PersonPublicView, dto.requester, {
				groups: ['auth'],
			}),
		};
	}

	async remove(id: string, requesterId: string): Promise<void> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Room seeking post not found');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('You do not have permission to delete this post');
		}

		await this.prisma.roomSeekingPost.delete({
			where: { id },
		});
	}

	async updateStatus(
		id: string,
		status: SearchPostStatus,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Room seeking post not found');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('You do not have permission to change the status of this post');
		}

		const updatedRequest = await this.prisma.roomSeekingPost.update({
			where: { id },
			data: { status },
			include: {
				requester: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						avatarUrl: true,
					},
				},
				amenities: {
					select: {
						id: true,
						name: true,
						nameEn: true,
						category: true,
						description: true,
					},
				},
				preferredProvince: {
					select: {
						id: true,
						name: true,
						nameEn: true,
					},
				},
				preferredDistrict: {
					select: {
						id: true,
						name: true,
						nameEn: true,
					},
				},
				preferredWard: {
					select: {
						id: true,
						name: true,
						nameEn: true,
					},
				},
			},
		});

		const dto = this.mapToResponseDto(updatedRequest);
		return {
			...dto,
			// Always show full info for authenticated user's own posts
			requester: plainToInstance(PersonPublicView, dto.requester, {
				groups: ['auth'],
			}),
		};
	}

	private mapToResponseDto(roomRequest: any): RoomRoomSeekingPostDto {
		return {
			id: roomRequest.id,
			title: roomRequest.title,
			description: roomRequest.description,
			slug: roomRequest.slug,
			requesterId: roomRequest.requesterId,
			preferredDistrictId: roomRequest.preferredDistrictId,
			preferredWardId: roomRequest.preferredWardId,
			preferredProvinceId: roomRequest.preferredProvinceId,
			minBudget: roomRequest.minBudget,
			maxBudget: roomRequest.maxBudget,
			currency: roomRequest.currency,
			preferredRoomType: roomRequest.preferredRoomType,
			occupancy: roomRequest.occupancy,
			moveInDate: roomRequest.moveInDate,
			status: roomRequest.status,
			isPublic: roomRequest.isPublic,
			expiresAt: roomRequest.expiresAt,
			viewCount: roomRequest.viewCount,
			contactCount: roomRequest.contactCount,
			createdAt: roomRequest.createdAt,
			updatedAt: roomRequest.updatedAt,
			requester: roomRequest.requester,
			amenities: roomRequest.amenities,
			preferredProvince: roomRequest.preferredProvince,
			preferredDistrict: roomRequest.preferredDistrict,
			preferredWard: roomRequest.preferredWard,
		};
	}
}
