import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { BreadcrumbDto, SeoDto } from '../../common/dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PersonPublicView } from '../../common/serialization/person.view';
import { formatRoomListItem, getOwnerStats } from '../../common/utils/room-formatter.utils';
import { ElasticsearchSearchService } from '../../elasticsearch/services/elasticsearch-search.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { ListingWithMetaResponseDto } from './dto/listing-with-meta.dto';
import { RoomSeekingWithMetaResponseDto } from './dto/room-seeking-with-meta.dto';
import { RoommateSeekingWithMetaResponseDto } from './dto/roommate-seeking-with-meta.dto';

/**
 * Helper service for Elasticsearch-based listing searches
 */
@Injectable()
export class ListingElasticsearchHelper {
	private readonly logger = new Logger(ListingElasticsearchHelper.name);

	constructor(
		private readonly elasticsearchSearchService: ElasticsearchSearchService,
		private readonly prisma: PrismaService,
	) {}

	/**
	 * Search rooms using Elasticsearch and hydrate with Prisma
	 */
	async searchRooms(
		query: ListingQueryDto,
		context: { isAuthenticated: boolean; userId?: string },
		seo: SeoDto,
		breadcrumb: BreadcrumbDto,
	): Promise<ListingWithMetaResponseDto> {
		const { isAuthenticated } = context;

		// Apply user preferences if needed (expand query)
		const expandedQuery = await this.applyUserPreferences(query, context.userId);

		// Normalize query param types to ensure ES term/range filters match
		const toNum = (v: unknown): number | undefined =>
			v === undefined || v === null || v === '' ? undefined : Number(v);
		const toBool = (v: unknown): boolean | undefined =>
			v === undefined || v === null || v === '' ? undefined : v === true || v === 'true';

		// Search with Elasticsearch
		const esResult = await this.elasticsearchSearchService.searchRooms({
			search: expandedQuery.search,
			provinceId: toNum(expandedQuery.provinceId as any),
			districtId: toNum(expandedQuery.districtId as any),
			wardId: toNum(expandedQuery.wardId as any),
			roomType: expandedQuery.roomType,
			minPrice: toNum(expandedQuery.minPrice as any),
			maxPrice: toNum(expandedQuery.maxPrice as any),
			minArea: toNum(expandedQuery.minArea as any),
			maxArea: toNum(expandedQuery.maxArea as any),
			amenities: expandedQuery.amenities,
			maxOccupancy: toNum(expandedQuery.maxOccupancy as any),
			isVerified: toBool(expandedQuery.isVerified as any),
			latitude: toNum(expandedQuery.latitude as any),
			longitude: toNum(expandedQuery.longitude as any),
			radius: toNum(expandedQuery.radius as any),
			sortBy: expandedQuery.sortBy || 'createdAt',
			sortOrder: (expandedQuery.sortOrder as 'asc' | 'desc') || 'desc',
			page: toNum(expandedQuery.page as any) || 1,
			limit: toNum(expandedQuery.limit as any) || 20,
		});

		if (esResult.hits.length === 0) {
			return {
				data: [],
				meta: {
					page: query.page || 1,
					limit: query.limit || 20,
					total: 0,
					totalPages: 0,
					hasNext: false,
					hasPrev: false,
					itemCount: 0,
				},
				seo,
				breadcrumb,
			};
		}

		// Extract room IDs from ES results
		const roomIds = esResult.hits.map((hit) => hit.id);

		// Hydrate full room data from Prisma (preserving ES order)
		const rooms = await this.prisma.room.findMany({
			where: { id: { in: roomIds } },
			include: {
				building: {
					include: {
						owner: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								avatarUrl: true,
								gender: true,
								isVerifiedPhone: true,
								isVerifiedEmail: true,
								isVerifiedIdentity: true,
								isOnline: true,
								lastActiveAt: true,
								overallRating: true,
								totalRatings: true,
							},
						},
						province: { select: { id: true, name: true, code: true } },
						district: { select: { id: true, name: true, code: true } },
						ward: { select: { id: true, name: true, code: true } },
					},
				},
				roomInstances: {
					where: {
						isActive: true,
						status: 'available',
					},
					select: {
						id: true,
						roomNumber: true,
						status: true,
						isActive: true,
					},
					take: 1,
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
						altText: true,
						sortOrder: true,
						isPrimary: true,
					},
					orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
					take: 4,
				},
				amenities: {
					select: {
						id: true,
						customValue: true,
						notes: true,
						amenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
							},
						},
					},
				},
				costs: {
					select: {
						id: true,
						costType: true,
						fixedAmount: true,
						perPersonAmount: true,
						unitPrice: true,
						unit: true,
						meterReading: true,
						lastMeterReading: true,
						currency: true,
						notes: true,
						costTypeTemplate: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								defaultUnit: true,
							},
						},
					},
				},
				pricing: {
					select: {
						id: true,
						basePriceMonthly: true,
						currency: true,
						depositAmount: true,
						depositMonths: true,
						utilityIncluded: true,
						utilityCostMonthly: true,
						minimumStayMonths: true,
						maximumStayMonths: true,
						priceNegotiable: true,
					},
				},
				rules: {
					select: {
						id: true,
						customValue: true,
						isEnforced: true,
						notes: true,
						ruleTemplate: {
							select: {
								id: true,
								ruleType: true,
								name: true,
								nameEn: true,
							},
						},
					},
				},
			},
		});

		// Create a map for quick lookup and preserve ES order
		const roomMap = new Map(rooms.map((room) => [room.id, room]));
		const sortedRooms = roomIds.map((id) => roomMap.get(id)).filter(Boolean);

		// Get unique owner IDs for batch fetching stats
		const uniqueOwnerIds = [...new Set(sortedRooms.map((room) => room.buildingId))];

		// Batch get owner statistics
		const ownerStatsMap = new Map<string, { totalBuildings: number; totalRoomInstances: number }>();
		await Promise.all(
			uniqueOwnerIds.map(async (ownerId) => {
				const stats = await getOwnerStats(this.prisma, ownerId);
				ownerStatsMap.set(ownerId, stats);
			}),
		);

		// Format rooms
		const formattedRooms = sortedRooms.map((room) =>
			formatRoomListItem(room, isAuthenticated, {
				includeDistance: Boolean(query.latitude && query.longitude),
				latitude: query.latitude,
				longitude: query.longitude,
				ownerStats: ownerStatsMap.get(room.buildingId),
			}),
		);

		const paginatedResponse = PaginatedResponseDto.create(
			formattedRooms,
			query.page || 1,
			query.limit || 20,
			esResult.total,
		);

		return {
			...paginatedResponse,
			seo,
			breadcrumb,
		};
	}

	/**
	 * Search room seeking posts using Elasticsearch
	 */
	async searchRoomSeekingPosts(
		query: RoomRequestSearchDto,
		seo: SeoDto,
		breadcrumb: BreadcrumbDto,
	): Promise<RoomSeekingWithMetaResponseDto> {
		const esResult = await this.elasticsearchSearchService.searchRoomSeekingPosts({
			search: query.search,
			provinceId: query.provinceId,
			districtId: query.districtId,
			wardId: query.wardId,
			minBudget: query.minBudget,
			maxBudget: query.maxBudget,
			roomType: query.roomType,
			amenities: query.amenities,
			status: query.status,
			moveInDate: query.moveInDate,
			sortBy: query.sortBy || 'createdAt',
			sortOrder: query.sortOrder || 'desc',
			page: query.page || 1,
			limit: query.limit || 20,
		});

		if (esResult.hits.length === 0) {
			return {
				data: [],
				meta: {
					page: query.page || 1,
					limit: query.limit || 20,
					total: 0,
					totalPages: 0,
					hasNext: false,
					hasPrev: false,
					itemCount: 0,
				},
				seo,
				breadcrumb,
			};
		}

		// Hydrate from Prisma
		const postIds = esResult.hits.map((hit) => hit.id);
		const posts = await this.prisma.roomSeekingPost.findMany({
			where: { id: { in: postIds } },
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

		// Preserve ES order
		const postMap = new Map(posts.map((post) => [post.id, post]));
		const sortedPosts = postIds.map((id) => postMap.get(id)).filter(Boolean);

		const formattedData = sortedPosts.map((item) => ({
			id: item.id,
			title: item.title,
			description: item.description,
			slug: item.slug,
			requesterId: item.requesterId,
			preferredDistrictId: item.preferredDistrictId,
			preferredWardId: item.preferredWardId,
			preferredProvinceId: item.preferredProvinceId,
			minBudget: item.minBudget !== null ? Number(item.minBudget) : undefined,
			maxBudget: item.maxBudget !== null ? Number(item.maxBudget) : undefined,
			currency: item.currency,
			preferredRoomType: item.preferredRoomType,
			occupancy: item.occupancy,
			moveInDate: item.moveInDate,
			status: item.status,
			isPublic: item.isPublic,
			expiresAt: item.expiresAt,
			viewCount: item.viewCount,
			contactCount: item.contactCount,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
			requester: plainToInstance(PersonPublicView, item.requester),
			amenities: item.amenities,
			preferredProvince: item.preferredProvince,
			preferredDistrict: item.preferredDistrict,
			preferredWard: item.preferredWard,
		}));

		const paginatedResponse = PaginatedResponseDto.create(
			formattedData,
			query.page || 1,
			query.limit || 20,
			esResult.total,
		);

		return {
			...paginatedResponse,
			seo,
			breadcrumb,
		};
	}

	/**
	 * Search roommate seeking posts using Elasticsearch
	 */
	async searchRoommateSeekingPosts(
		query: ListingQueryDto,
		seo: SeoDto,
		breadcrumb: BreadcrumbDto,
	): Promise<RoommateSeekingWithMetaResponseDto> {
		const esResult = await this.elasticsearchSearchService.searchRoommateSeekingPosts({
			search: query.search,
			provinceId: query.provinceId,
			districtId: query.districtId,
			wardId: query.wardId,
			minPrice: query.minPrice,
			maxPrice: query.maxPrice,
			status: (query as any).status,
			sortBy: query.sortBy || 'createdAt',
			sortOrder: query.sortOrder || 'desc',
			page: query.page || 1,
			limit: query.limit || 20,
		});

		if (esResult.hits.length === 0) {
			return {
				data: [],
				meta: {
					page: query.page || 1,
					limit: query.limit || 20,
					total: 0,
					totalPages: 0,
					hasNext: false,
					hasPrev: false,
					itemCount: 0,
				},
				seo,
				breadcrumb,
			};
		}

		const postIds = esResult.hits.map((hit) => hit.id);
		const posts = await this.prisma.roommateSeekingPost.findMany({
			where: { id: { in: postIds } },
			include: {
				tenant: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						avatarUrl: true,
					},
				},
			},
		});

		const postMap = new Map(posts.map((post) => [post.id, post]));
		const sortedPosts = postIds.map((id) => postMap.get(id)).filter(Boolean);

		const formatted = sortedPosts.map((post) => ({
			id: post.id,
			title: post.title,
			description: post.description,
			slug: post.slug,
			maxBudget: Number(post.monthlyRent),
			currency: post.currency,
			occupancy: post.seekingCount,
			moveInDate: post.availableFromDate,
			status: post.status,
			viewCount: post.viewCount,
			contactCount: post.contactCount,
			createdAt: post.createdAt,
			requester: plainToInstance(PersonPublicView, {
				id: post.tenant.id,
				firstName: post.tenant.firstName,
				lastName: post.tenant.lastName,
				email: post.tenant.email,
				phone: post.tenant.phone,
				avatarUrl: post.tenant.avatarUrl,
			}),
		}));

		const paginated = PaginatedResponseDto.create(
			formatted,
			query.page || 1,
			query.limit || 20,
			esResult.total,
		);

		return { ...paginated, seo, breadcrumb };
	}

	/**
	 * Apply user preferences to expand query
	 */
	private async applyUserPreferences(
		query: ListingQueryDto,
		userId?: string,
	): Promise<ListingQueryDto> {
		if (!userId) {
			return query;
		}

		// Fetch user preferences if authenticated and no explicit filters
		if (
			!query.search &&
			!query.provinceId &&
			!query.districtId &&
			!query.wardId &&
			!query.roomType &&
			!query.minPrice &&
			!query.maxPrice
		) {
			const userPreferences = await this.prisma.tenantRoomPreferences.findUnique({
				where: { tenantId: userId },
			});

			if (userPreferences?.isActive) {
				return {
					...query,
					provinceId:
						query.provinceId ||
						(userPreferences.preferredProvinceIds?.[0]
							? userPreferences.preferredProvinceIds[0]
							: undefined),
					districtId:
						query.districtId ||
						(userPreferences.preferredDistrictIds?.[0]
							? userPreferences.preferredDistrictIds[0]
							: undefined),
					minPrice:
						query.minPrice ||
						(userPreferences.minBudget
							? Math.floor(Number(userPreferences.minBudget) * 0.8)
							: undefined),
					maxPrice:
						query.maxPrice ||
						(userPreferences.maxBudget
							? Math.ceil(Number(userPreferences.maxBudget) * 1.2)
							: undefined),
					roomType:
						query.roomType ||
						(userPreferences.preferredRoomTypes?.[0]
							? userPreferences.preferredRoomTypes[0]
							: undefined),
					maxOccupancy: query.maxOccupancy || userPreferences.maxOccupancy,
					amenities:
						query.amenities ||
						(userPreferences.requiresAmenityIds?.length
							? userPreferences.requiresAmenityIds.join(',')
							: undefined),
				};
			}
		}

		return query;
	}
}
