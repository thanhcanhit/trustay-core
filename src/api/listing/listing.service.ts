import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BreadcrumbDto, SeoDto } from '../../common/dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { maskEmail, maskFullName, maskPhone } from '../../common/utils/mask.utils';
import { formatRoomListItem, getOwnerStats } from '../../common/utils/room-formatter.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { ListingWithMetaResponseDto } from './dto/listing-with-meta.dto';
import { RoomSeekingWithMetaResponseDto } from './dto/room-seeking-with-meta.dto';
import { RoommateSeekingWithMetaResponseDto } from './dto/roommate-seeking-with-meta.dto';

@Injectable()
export class ListingService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Generate SEO data for room listings
	 */
	private async generateRoomListingSeo(query: ListingQueryDto): Promise<SeoDto> {
		const { search, provinceId, districtId, wardId, roomType, minPrice, maxPrice } = query;

		// Get location info from database
		const locationParts: string[] = [];
		if (wardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: wardId },
				select: { name: true },
			});
			if (ward) {
				locationParts.push(ward.name);
			}
		}
		if (districtId) {
			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				select: { name: true },
			});
			if (district) {
				locationParts.push(district.name);
			}
		}
		if (provinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: provinceId },
				select: { name: true },
			});
			if (province) {
				locationParts.push(province.name);
			}
		}

		// Get room type info
		const roomTypeMap: Record<string, string> = {
			boarding_house: 'nhà trọ',
			dormitory: 'ký túc xá',
			sleepbox: 'sleepbox',
			apartment: 'chung cư',
			whole_house: 'nhà nguyên căn',
		};
		const roomTypeText = roomType ? roomTypeMap[roomType] || roomType : 'phòng trọ';

		// Get price range
		let priceText = '';
		if (minPrice && maxPrice) {
			priceText = `từ ${(minPrice / 1000000).toFixed(1)} triệu đến ${(maxPrice / 1000000).toFixed(1)} triệu`;
		} else if (minPrice) {
			priceText = `từ ${(minPrice / 1000000).toFixed(1)} triệu`;
		} else if (maxPrice) {
			priceText = `dưới ${(maxPrice / 1000000).toFixed(1)} triệu`;
		}

		// Build title
		let title = 'Tìm phòng trọ';
		if (search) {
			title = `Tìm ${roomTypeText} "${search}"`;
		} else if (locationParts.length > 0) {
			title = `Tìm ${roomTypeText} tại ${locationParts.join(', ')}`;
		} else {
			title = `Tìm ${roomTypeText}`;
		}

		if (priceText) {
			title += ` ${priceText}`;
		}
		title += ' | Trustay';

		// Build description
		let description = `Tìm ${roomTypeText} chất lượng cao`;
		if (locationParts.length > 0) {
			description += ` tại ${locationParts.join(', ')}`;
		}
		if (priceText) {
			description += ` với giá ${priceText}`;
		}
		description += '. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!';

		// Build keywords
		const keywords = [
			roomTypeText,
			'phòng trọ',
			'nhà trọ',
			'thuê phòng',
			...locationParts,
			priceText ? 'giá rẻ' : '',
			'đầy đủ tiện nghi',
			'chất lượng cao',
		]
			.filter(Boolean)
			.join(', ');

		return {
			title,
			description,
			keywords,
		};
	}

	/**
	 * Generate breadcrumb for room listings
	 */
	private async generateRoomListingBreadcrumb(query: ListingQueryDto): Promise<BreadcrumbDto> {
		const { search, provinceId, districtId, roomType } = query;

		const items = [
			{ title: 'Trang chủ', path: '/' },
			{ title: 'Tìm phòng trọ', path: '/rooms' },
		];

		if (districtId) {
			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				select: { name: true },
			});
			if (district) {
				items.push({ title: district.name, path: `/rooms?districtId=${districtId}` });
			}
		}
		if (provinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: provinceId },
				select: { name: true },
			});
			if (province) {
				items.push({ title: province.name, path: `/rooms?provinceId=${provinceId}` });
			}
		}

		// Add room type breadcrumb
		if (roomType) {
			const roomTypeMap: Record<string, string> = {
				boarding_house: 'Nhà trọ',
				dormitory: 'Ký túc xá',
				sleepbox: 'Sleepbox',
				apartment: 'Chung cư',
				whole_house: 'Nhà nguyên căn',
			};
			items.push({
				title: roomTypeMap[roomType] || roomType,
				path: `/rooms?roomType=${roomType}`,
			});
		}

		// Add search breadcrumb
		if (search) {
			items.push({
				title: `"${search}"`,
				path: `/rooms?search=${encodeURIComponent(search)}`,
			});
		}

		return { items };
	}

	/**
	 * Generate SEO data for room seeking posts
	 */
	private async generateRoomSeekingSeo(query: RoomRequestSearchDto): Promise<SeoDto> {
		const { search, provinceId, districtId, wardId, roomType, minBudget, maxBudget } = query;

		// Get location info from database
		const locationParts: string[] = [];
		if (wardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: wardId },
				select: { name: true },
			});
			if (ward) {
				locationParts.push(ward.name);
			}
		}
		if (districtId) {
			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				select: { name: true },
			});
			if (district) {
				locationParts.push(district.name);
			}
		}
		if (provinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: provinceId },
				select: { name: true },
			});
			if (province) {
				locationParts.push(province.name);
			}
		}

		// Get room type info
		const roomTypeMap: Record<string, string> = {
			boarding_house: 'nhà trọ',
			dormitory: 'ký túc xá',
			sleepbox: 'sleepbox',
			apartment: 'chung cư',
			whole_house: 'nhà nguyên căn',
		};
		const roomTypeText = roomType ? roomTypeMap[roomType] || roomType : 'phòng trọ';

		// Get budget range
		let budgetText = '';
		if (minBudget && maxBudget) {
			budgetText = `từ ${(minBudget / 1000000).toFixed(1)} triệu đến ${(maxBudget / 1000000).toFixed(1)} triệu`;
		} else if (minBudget) {
			budgetText = `từ ${(minBudget / 1000000).toFixed(1)} triệu`;
		} else if (maxBudget) {
			budgetText = `dưới ${(maxBudget / 1000000).toFixed(1)} triệu`;
		}

		// Build title
		let title = 'Tìm người thuê phòng';
		if (search) {
			title = `Tìm người thuê ${roomTypeText} "${search}"`;
		} else if (locationParts.length > 0) {
			title = `Tìm người thuê ${roomTypeText} tại ${locationParts.join(', ')}`;
		} else {
			title = `Tìm người thuê ${roomTypeText}`;
		}

		if (budgetText) {
			title += ` ${budgetText}`;
		}
		title += ' | Trustay';

		// Build description
		let description = `Tìm người thuê ${roomTypeText} chất lượng cao`;
		if (locationParts.length > 0) {
			description += ` tại ${locationParts.join(', ')}`;
		}
		if (budgetText) {
			description += ` với ngân sách ${budgetText}`;
		}
		description += '. Kết nối chủ nhà và người thuê hiệu quả. Đăng tin miễn phí!';

		// Build keywords
		const keywords = [
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
			title,
			description,
			keywords,
		};
	}

	/**
	 * Generate breadcrumb for room seeking posts
	 */
	private async generateRoomSeekingBreadcrumb(query: RoomRequestSearchDto): Promise<BreadcrumbDto> {
		const { search, provinceId, districtId, roomType } = query;

		const items = [
			{ title: 'Trang chủ', path: '/' },
			{ title: 'Tìm người thuê', path: '/room-seekings' },
		];

		if (districtId) {
			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				select: { name: true },
			});
			if (district) {
				items.push({ title: district.name, path: `/room-seekings?districtId=${districtId}` });
			}
		}
		if (provinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: provinceId },
				select: { name: true },
			});
			if (province) {
				items.push({ title: province.name, path: `/room-seekings?provinceId=${provinceId}` });
			}
		}

		// Add room type breadcrumb
		if (roomType) {
			const roomTypeMap: Record<string, string> = {
				boarding_house: 'Nhà trọ',
				dormitory: 'Ký túc xá',
				sleepbox: 'Sleepbox',
				apartment: 'Chung cư',
				whole_house: 'Nhà nguyên căn',
			};
			items.push({
				title: roomTypeMap[roomType] || roomType,
				path: `/room-seekings?roomType=${roomType}`,
			});
		}

		// Add search breadcrumb
		if (search) {
			items.push({
				title: `"${search}"`,
				path: `/room-seekings?search=${encodeURIComponent(search)}`,
			});
		}

		return { items };
	}

	/**
	 * Generate SEO for roommate seeking posts
	 */
	private async generateRoommateSeekingSeo(query: ListingQueryDto): Promise<SeoDto> {
		const { search, provinceId, districtId, wardId, minPrice, maxPrice } = query;
		const locationParts: string[] = [];
		if (wardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: wardId },
				select: { name: true },
			});
			if (ward) locationParts.push(ward.name);
		}
		if (districtId) {
			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				select: { name: true },
			});
			if (district) locationParts.push(district.name);
		}
		if (provinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: provinceId },
				select: { name: true },
			});
			if (province) locationParts.push(province.name);
		}
		let budgetText = '';
		if (minPrice && maxPrice)
			budgetText = `từ ${(minPrice / 1000000).toFixed(1)} triệu đến ${(maxPrice / 1000000).toFixed(1)} triệu`;
		else if (minPrice) budgetText = `từ ${(minPrice / 1000000).toFixed(1)} triệu`;
		else if (maxPrice) budgetText = `dưới ${(maxPrice / 1000000).toFixed(1)} triệu`;
		let title = 'Tìm bạn ở ghép';
		if (search) title = `Tìm bạn ở ghép "${search}"`;
		else if (locationParts.length > 0) title = `Tìm bạn ở ghép tại ${locationParts.join(', ')}`;
		if (budgetText) title += ` ${budgetText}`;
		title += ' | Trustay';
		let description = 'Kết nối người ở ghép nhanh chóng, an toàn';
		if (locationParts.length > 0) description += ` tại ${locationParts.join(', ')}`;
		if (budgetText) description += ` với chi phí ${budgetText}`;
		const keywords = ['ở ghép', 'tìm bạn ở ghép', ...locationParts, budgetText ? 'ngân sách' : '']
			.filter(Boolean)
			.join(', ');
		return { title, description, keywords };
	}

	/**
	 * Generate breadcrumb for roommate seeking posts
	 */
	private async generateRoommateSeekingBreadcrumb(query: ListingQueryDto): Promise<BreadcrumbDto> {
		const { search, provinceId, districtId } = query;
		const items = [
			{ title: 'Trang chủ', path: '/' },
			{ title: 'Ở ghép', path: '/roommate-seekings' },
		];
		if (districtId) {
			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				select: { name: true },
			});
			if (district)
				items.push({ title: district.name, path: `/roommate-seekings?districtId=${districtId}` });
		}
		if (provinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: provinceId },
				select: { name: true },
			});
			if (province)
				items.push({ title: province.name, path: `/roommate-seekings?provinceId=${provinceId}` });
		}
		if (search)
			items.push({
				title: `"${search}"`,
				path: `/roommate-seekings?search=${encodeURIComponent(search)}`,
			});
		return { items };
	}

	async findAllListings(
		query: ListingQueryDto,
		context: { isAuthenticated: boolean; userId?: string } = { isAuthenticated: false },
	): Promise<ListingWithMetaResponseDto> {
		const { isAuthenticated, userId } = context;
		const {
			page = 1,
			limit = 20,
			search,
			provinceId,
			districtId,
			wardId,
			roomType,
			minPrice,
			maxPrice,
		} = query;

		const skip = (page - 1) * limit;

		// Fetch user preferences if authenticated and no explicit filters provided
		let userPreferences = null;
		if (
			userId &&
			!search &&
			!provinceId &&
			!districtId &&
			!wardId &&
			!roomType &&
			!minPrice &&
			!maxPrice
		) {
			userPreferences = await this.prisma.tenantRoomPreferences.findUnique({
				where: { tenantId: userId },
			});
		}

		// Apply user preferences to expand search criteria
		let expandedQuery = query;
		if (userPreferences?.isActive) {
			expandedQuery = {
				...query,
				// Use preferences for location if not specified
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
				// Expand budget range slightly for better matching
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
				// Use preferred room types
				roomType:
					query.roomType ||
					(userPreferences.preferredRoomTypes?.[0]
						? userPreferences.preferredRoomTypes[0]
						: undefined),
				// Use occupancy preference
				maxOccupancy: query.maxOccupancy || userPreferences.maxOccupancy,
				// Include required amenities
				amenities:
					query.amenities ||
					(userPreferences.requiresAmenityIds?.length
						? userPreferences.requiresAmenityIds.join(',')
						: undefined),
			};
		}

		// Use expanded query for filtering
		const {
			provinceId: finalProvinceId,
			districtId: finalDistrictId,
			wardId: finalWardId,
			roomType: finalRoomType,
			minPrice: finalMinPrice,
			maxPrice: finalMaxPrice,
			minArea: finalMinArea,
			maxArea: finalMaxArea,
			amenities: finalAmenities,
			maxOccupancy: finalMaxOccupancy,
			isVerified: finalIsVerified,
			latitude: finalLatitude,
			longitude: finalLongitude,
			radius: finalRadius,
			sortBy: finalSortBy = 'createdAt',
			sortOrder: finalSortOrder = 'desc',
		} = expandedQuery;

		const where: any = {
			isActive: true,
			building: {
				isActive: true,
			},
			// Only show rooms that have at least one available room instance
			roomInstances: {
				some: {
					isActive: true,
					status: 'available',
				},
			},
		};

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{
					building: {
						name: { contains: search, mode: 'insensitive' },
					},
				},
			];
		}

		if (finalProvinceId) {
			where.building.provinceId = finalProvinceId;
		}

		if (finalDistrictId) {
			where.building.districtId = finalDistrictId;
		}

		if (finalWardId) {
			where.building.wardId = finalWardId;
		}

		if (finalRoomType) {
			where.roomType = finalRoomType;
		}

		if (finalMaxOccupancy) {
			where.maxOccupancy = { lte: finalMaxOccupancy };
		}

		if (finalIsVerified !== undefined) {
			where.isVerified = finalIsVerified;
		}

		if (finalMinArea || finalMaxArea) {
			where.areaSqm = {};
			if (finalMinArea) {
				where.areaSqm.gte = finalMinArea;
			}
			if (finalMaxArea) {
				where.areaSqm.lte = finalMaxArea;
			}
		}

		if (finalMinPrice || finalMaxPrice) {
			where.pricing = {};
			if (finalMinPrice) {
				where.pricing.basePriceMonthly = { gte: finalMinPrice };
			}
			if (finalMaxPrice) {
				where.pricing.basePriceMonthly = {
					...where.pricing.basePriceMonthly,
					lte: finalMaxPrice,
				};
			}
		}

		if (finalAmenities) {
			const amenityIds = finalAmenities
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id.length > 0);
			where.amenities = {
				some: {
					systemAmenityId: { in: amenityIds },
				},
			};
		}

		// Handle location-based filtering
		if (finalLatitude && finalLongitude && finalRadius) {
			const latRad = finalLatitude * (Math.PI / 180);

			const minLat = finalLatitude - finalRadius / 111.32; // 1 degree ≈ 111.32 km
			const maxLat = finalLatitude + finalRadius / 111.32;
			const minLon = finalLongitude - finalRadius / (111.32 * Math.cos(latRad));
			const maxLon = finalLongitude + finalRadius / (111.32 * Math.cos(latRad));

			where.building = {
				...where.building,
				latitude: { gte: minLat, lte: maxLat },
				longitude: { gte: minLon, lte: maxLon },
			};
		}

		const orderBy: any = {};
		if (finalSortBy === 'price') {
			orderBy.pricing = { basePriceMonthly: finalSortOrder };
		} else if (finalSortBy === 'area') {
			orderBy.areaSqm = finalSortOrder;
		} else if (finalSortBy === 'distance' && finalLatitude && finalLongitude) {
			// For distance sorting, we'll need to calculate distance in the application layer
			// For now, just use createdAt as fallback
			orderBy.createdAt = finalSortOrder;
		} else {
			orderBy[finalSortBy] = finalSortOrder;
		}

		const [rooms, total] = await Promise.all([
			this.prisma.room.findMany({
				where,
				skip,
				take: limit,
				orderBy,
				include: {
					building: {
						select: {
							id: true,
							name: true,
							addressLine1: true,
							addressLine2: true,
							latitude: true,
							longitude: true,
							isVerified: true,
							province: { select: { id: true, name: true, code: true } },
							district: { select: { id: true, name: true, code: true } },
							ward: { select: { id: true, name: true, code: true } },
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
						},
					},
					roomInstances: {
						select: {
							id: true,
							roomNumber: true,
							status: true,
							isActive: true,
						},
						where: {
							isActive: true,
							status: 'available',
						},
						take: 1, // Just need to know if any available
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
							systemAmenity: {
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
							baseRate: true,
							currency: true,
							notes: true,
							systemCostType: {
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
							systemRule: {
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
			}),
			this.prisma.room.count({ where }),
		]);

		// Get unique owner IDs to batch fetch their stats
		const uniqueOwnerIds = [...new Set(rooms.map((room) => room.building.owner.id))];

		// Batch get owner statistics for all unique owners
		const ownerStatsMap = new Map<string, { totalBuildings: number; totalRoomInstances: number }>();
		await Promise.all(
			uniqueOwnerIds.map(async (ownerId) => {
				const stats = await getOwnerStats(this.prisma, ownerId);
				ownerStatsMap.set(ownerId, stats);
			}),
		);

		const formattedRooms = rooms.map((room) =>
			formatRoomListItem(room, isAuthenticated, {
				includeDistance: Boolean(finalLatitude && finalLongitude),
				latitude: finalLatitude,
				longitude: finalLongitude,
				ownerStats: ownerStatsMap.get(room.building.owner.id),
			}),
		);

		const paginatedResponse = PaginatedResponseDto.create(formattedRooms, page, limit, total);

		// Generate SEO and breadcrumb
		const seo = await this.generateRoomListingSeo(query);
		const breadcrumb = await this.generateRoomListingBreadcrumb(query);

		return {
			...paginatedResponse,
			seo,
			breadcrumb,
		};
	}

	async findAllRoomRequests(
		query: RoomRequestSearchDto,
		context: { isAuthenticated: boolean; userId?: string } = { isAuthenticated: false },
	): Promise<RoomSeekingWithMetaResponseDto> {
		const { isAuthenticated } = context;
		const {
			page = 1,
			limit = 20,
			search,
			provinceId,
			districtId,
			wardId,
			minBudget,
			maxBudget,
			roomType,
			occupancy,
			amenities,
			status,
			isPublic,
			requesterId,
			moveInDate,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const where: Prisma.RoomSeekingPostWhereInput = {};

		if (search) {
			where.OR = [
				{ title: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}

		if (provinceId) {
			where.preferredProvinceId = provinceId;
		}

		if (districtId) {
			where.preferredDistrictId = districtId;
		}

		if (wardId) {
			where.preferredWardId = wardId;
		}

		if (minBudget !== undefined && minBudget !== null) {
			where.minBudget = { lte: minBudget };
		}

		if (maxBudget !== undefined && maxBudget !== null) {
			where.maxBudget = { gte: maxBudget };
		}

		if (roomType) {
			where.preferredRoomType = roomType;
		}

		if (occupancy) {
			where.occupancy = occupancy;
		}

		if (amenities) {
			const amenityIds = amenities
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id.length > 0);
			if (amenityIds.length > 0) {
				where.amenities = {
					some: {
						id: { in: amenityIds },
					},
				};
			}
		}

		if (status) {
			where.status = status;
		}

		if (isPublic !== undefined) {
			where.isPublic = isPublic;
		}

		if (requesterId) {
			where.requesterId = requesterId;
		}

		if (moveInDate) {
			where.moveInDate = { lte: moveInDate };
		}

		const orderBy: Prisma.RoomSeekingPostOrderByWithRelationInput = {
			[sortBy]: sortOrder,
		};

		const [data, total] = await Promise.all([
			this.prisma.roomSeekingPost.findMany({
				where,
				orderBy,
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
			}),
			this.prisma.roomSeekingPost.count({ where }),
		]);

		const formattedData = data.map((item) => {
			const requesterFullName =
				`${item.requester.firstName || ''} ${item.requester.lastName || ''}`.trim();
			const maskedRequesterName = maskFullName(requesterFullName);
			const maskedEmail = item.requester.email ? maskEmail(item.requester.email) : '';
			const maskedPhone = item.requester.phone ? maskPhone(item.requester.phone) : '';

			return {
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
				requester: {
					...item.requester,
					firstName: isAuthenticated ? item.requester.firstName : undefined,
					lastName: isAuthenticated ? item.requester.lastName : undefined,
					email: isAuthenticated ? item.requester.email : maskedEmail,
					phone: isAuthenticated ? item.requester.phone : maskedPhone,
					// add masked display name for convenience
					name: isAuthenticated ? requesterFullName : maskedRequesterName,
				},
				amenities: item.amenities,
				preferredProvince: item.preferredProvince,
				preferredDistrict: item.preferredDistrict,
				preferredWard: item.preferredWard,
			};
		});

		const paginatedResponse = PaginatedResponseDto.create(formattedData, page, limit, total);

		// Generate SEO and breadcrumb
		const seo = await this.generateRoomSeekingSeo(query);
		const breadcrumb = await this.generateRoomSeekingBreadcrumb(query);

		return {
			...paginatedResponse,
			seo,
			breadcrumb,
		};
	}

	async findAllRoommateSeekings(
		query: ListingQueryDto,
		context: { isAuthenticated: boolean; userId?: string } = { isAuthenticated: false },
	): Promise<RoommateSeekingWithMetaResponseDto> {
		const { isAuthenticated } = context;
		const {
			page = 1,
			limit = 20,
			search,
			provinceId,
			districtId,
			wardId,
			minPrice,
			maxPrice,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const where: any = { status: 'active', isActive: true };
		if (search) {
			where.OR = [
				{ title: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}
		if (provinceId) where.externalProvinceId = provinceId;
		if (districtId) where.externalDistrictId = districtId;
		if (wardId) where.externalWardId = wardId;
		if (minPrice || maxPrice) {
			where.monthlyRent = {};
			if (minPrice) where.monthlyRent.gte = minPrice;
			if (maxPrice) where.monthlyRent.lte = maxPrice;
		}

		const orderBy: any = { [sortBy === 'price' ? 'createdAt' : sortBy]: sortOrder };

		const [posts, total] = await Promise.all([
			this.prisma.roommateSeekingPost.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
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
			}),
			this.prisma.roommateSeekingPost.count({ where }),
		]);

		const formatted = posts.map((post) => {
			const fullName = `${post.tenant.firstName || ''} ${post.tenant.lastName || ''}`.trim();
			const maskedName = maskFullName(fullName);
			const maskedEmail = post.tenant.email ? maskEmail(post.tenant.email) : '';
			const maskedPhone = post.tenant.phone ? maskPhone(post.tenant.phone) : '';
			return {
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
				requester: {
					id: post.tenant.id,
					name: isAuthenticated ? fullName : maskedName,
					email: isAuthenticated ? post.tenant.email : maskedEmail,
					phone: isAuthenticated ? post.tenant.phone : maskedPhone,
					avatarUrl: post.tenant.avatarUrl,
				},
			};
		});

		const paginated = PaginatedResponseDto.create(formatted, page, limit, total);
		const seo = await this.generateRoommateSeekingSeo(query);
		const breadcrumb = await this.generateRoommateSeekingBreadcrumb(query);
		return { ...paginated, seo, breadcrumb };
	}
}
