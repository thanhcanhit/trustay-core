import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { PaginatedListingResponseDto } from './dto/paginated-listing-response.dto';
import { PaginatedRoomSeekingResponseDto } from './dto/paginated-room-seeking-response.dto';

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
			latitude,
			longitude,
			radius,
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
			const amenityIds = amenities
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
		if (latitude && longitude && radius) {
			const earthRadius = 6371; // Earth's radius in km
			const latRad = latitude * (Math.PI / 180);
			const lonRad = longitude * (Math.PI / 180);
			const radiusRad = radius / earthRadius;

			const minLat = latitude - radius / 111.32; // 1 degree ≈ 111.32 km
			const maxLat = latitude + radius / 111.32;
			const minLon = longitude - radius / (111.32 * Math.cos(latRad));
			const maxLon = longitude + radius / (111.32 * Math.cos(latRad));

			where.building = {
				...where.building,
				latitude: { gte: minLat, lte: maxLat },
				longitude: { gte: minLon, lte: maxLon },
			};
		}

		const orderBy: any = {};
		if (sortBy === 'price') {
			orderBy.pricing = { basePriceMonthly: sortOrder };
		} else if (sortBy === 'area') {
			orderBy.areaSqm = sortOrder;
		} else if (sortBy === 'distance' && latitude && longitude) {
			// For distance sorting, we'll need to calculate distance in the application layer
			// For now, just use createdAt as fallback
			orderBy.createdAt = sortOrder;
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
							latitude: true,
							longitude: true,
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

		const formattedRooms = rooms.map((room) => {
			let distance: number | undefined;
			if (latitude && longitude && room.building.latitude && room.building.longitude) {
				// Calculate distance using Haversine formula
				const lat1Rad = latitude * (Math.PI / 180);
				const lon1Rad = longitude * (Math.PI / 180);
				const lat2Rad = Number(room.building.latitude) * (Math.PI / 180);
				const lon2Rad = Number(room.building.longitude) * (Math.PI / 180);

				const dLat = lat2Rad - lat1Rad;
				const dLon = lon2Rad - lon1Rad;

				const a =
					Math.sin(dLat / 2) * Math.sin(dLat / 2) +
					Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
				const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
				distance = 6371 * c; // Distance in km
			}

			return {
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
				...(distance !== undefined && { distance: Number(distance.toFixed(2)) }),
			};
		});

		return PaginatedResponseDto.create(formattedRooms, page, limit, total);
	}

	async findAllRoomRequests(query: RoomRequestSearchDto): Promise<PaginatedRoomSeekingResponseDto> {
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

		const formattedData = data.map((item) => ({
			id: item.id,
			title: item.title,
			description: item.description,
			slug: item.slug,
			requesterId: item.requesterId,
			preferredDistrictId: item.preferredDistrictId,
			preferredWardId: item.preferredWardId,
			preferredProvinceId: item.preferredProvinceId,
			minBudget: item.minBudget != null ? Number(item.minBudget) : undefined,
			maxBudget: item.maxBudget != null ? Number(item.maxBudget) : undefined,
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
		}));

		return PaginatedResponseDto.create(formattedData, page, limit, total);
	}
}
