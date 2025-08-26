import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { PaginatedListingResponseDto } from './dto/paginated-listing-response.dto';

@Injectable()
export class ListingService {
	constructor(private readonly prisma: PrismaService) {}

	async findAllListings(query: ListingQueryDto): Promise<PaginatedListingResponseDto> {
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
			minArea,
			maxArea,
			amenities,
			maxOccupancy,
			isVerified,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const skip = (page - 1) * limit;

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

		if (provinceId) {
			where.building.provinceId = provinceId;
		}

		if (districtId) {
			where.building.districtId = districtId;
		}

		if (wardId) {
			where.building.wardId = wardId;
		}

		if (roomType) {
			where.roomType = roomType;
		}

		if (maxOccupancy) {
			where.maxOccupancy = { lte: maxOccupancy };
		}

		if (isVerified !== undefined) {
			where.isVerified = isVerified;
		}

		if (minArea || maxArea) {
			where.areaSqm = {};
			if (minArea) where.areaSqm.gte = minArea;
			if (maxArea) where.areaSqm.lte = maxArea;
		}

		if (minPrice || maxPrice) {
			where.pricing = {};
			if (minPrice) where.pricing.basePriceMonthly = { gte: minPrice };
			if (maxPrice) {
				where.pricing.basePriceMonthly = {
					...where.pricing.basePriceMonthly,
					lte: maxPrice,
				};
			}
		}

		if (amenities) {
			const amenityIds = amenities.split(',').map((id) => id.trim());
			where.amenities = {
				some: {
					systemAmenityId: { in: amenityIds },
				},
			};
		}

		const orderBy: any = {};
		if (sortBy === 'price') {
			orderBy.pricing = { basePriceMonthly: sortOrder };
		} else if (sortBy === 'area') {
			orderBy.areaSqm = sortOrder;
		} else {
			orderBy[sortBy] = sortOrder;
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
							isVerified: true,
							province: { select: { id: true, name: true, code: true } },
							district: { select: { id: true, name: true, code: true } },
							ward: { select: { id: true, name: true, code: true } },
							owner: {
								select: {
									firstName: true,
									lastName: true,
									avatarUrl: true,
									gender: true,
									isVerifiedPhone: true,
									isVerifiedEmail: true,
									isVerifiedIdentity: true,
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

		const formattedRooms = rooms.map((room) => ({
			id: room.id,
			slug: room.slug,
			name: room.name,
			roomType: room.roomType,
			areaSqm: room.areaSqm?.toString(),
			maxOccupancy: room.maxOccupancy,
			isVerified: room.isVerified,
			buildingName: room.building.name,
			buildingVerified: room.building.isVerified,
			address: room.building.addressLine1,
			availableRooms: room.roomInstances.length, // Number of available room instances
			owner: {
				name: `${room.building.owner.firstName} ${room.building.owner.lastName}`,
				avatarUrl: room.building.owner.avatarUrl,
				gender: room.building.owner.gender,
				verifiedPhone: room.building.owner.isVerifiedPhone,
				verifiedEmail: room.building.owner.isVerifiedEmail,
				verifiedIdentity: room.building.owner.isVerifiedIdentity,
			},
			location: {
				provinceId: room.building.province.id,
				provinceName: room.building.province.name,
				districtId: room.building.district.id,
				districtName: room.building.district.name,
				wardId: room.building.ward?.id,
				wardName: room.building.ward?.name,
			},
			images: room.images.map((image) => ({
				url: image.imageUrl,
				alt: image.altText,
				isPrimary: image.isPrimary,
				sortOrder: image.sortOrder,
			})),
			amenities: room.amenities.map((amenity) => ({
				id: amenity.systemAmenity.id,
				name: amenity.systemAmenity.name,
				category: amenity.systemAmenity.category,
			})),
			costs: room.costs.map((cost) => ({
				id: cost.systemCostType.id,
				name: cost.systemCostType.name,
				value: cost.baseRate.toString(),
			})),
			pricing: room.pricing
				? {
						basePriceMonthly: room.pricing.basePriceMonthly.toString(),
						depositAmount: room.pricing.depositAmount.toString(),
						utilityIncluded: room.pricing.utilityIncluded,
					}
				: undefined,
			rules: room.rules.map((rule) => ({
				id: rule.systemRule.id,
				name: rule.customValue || rule.systemRule.name,
				type: rule.systemRule.ruleType,
			})),
		}));

		return PaginatedResponseDto.create(formattedRooms, page, limit, total);
	}

	async findAllRoomRequests(query: RoomRequestSearchDto): Promise<any> {
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
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const where: Prisma.RoomSeekingPostWhereInput = {
			...(search && {
				OR: [
					{ title: { contains: search, mode: 'insensitive' } },
					{ description: { contains: search, mode: 'insensitive' } },
				],
			}),
			...(provinceId && { preferredProvinceId: provinceId }),
			...(districtId && { preferredDistrictId: districtId }),
			...(wardId && { preferredWardId: wardId }),
			...(minBudget !== undefined && { minBudget: { gte: minBudget } }),
			...(maxBudget !== undefined && { maxBudget: { lte: maxBudget } }),
			...(roomType && { preferredRoomType: roomType }),
			...(occupancy && { occupancy: occupancy }),
			...(amenities && {
				amenities: {
					some: {
						id: { in: amenities.split(',').map((id) => id.trim()) },
					},
				},
			}),
			...(status && { status }),
			...(isPublic !== undefined && { isPublic: isPublic }),
			...(requesterId && { requesterId }),
		};

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

		return {
			data: data.map((item) => ({
				id: item.id,
				title: item.title,
				description: item.description,
				slug: item.slug,
				requesterId: item.requesterId,
				preferredDistrictId: item.preferredDistrictId,
				preferredWardId: item.preferredWardId,
				preferredProvinceId: item.preferredProvinceId,
				minBudget: item.minBudget,
				maxBudget: item.maxBudget,
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
				requester: item.requester,
				amenities: item.amenities,
				preferredProvince: item.preferredProvince,
				preferredDistrict: item.preferredDistrict,
				preferredWard: item.preferredWard,
			})),
			total,
			page,
			limit,
		};
	}
}
