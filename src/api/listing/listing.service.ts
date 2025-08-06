import { Injectable } from '@nestjs/common';
import { RoomType } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListingQueryDto } from './dto/listing-query.dto';
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
			floor: {
				building: {
					isActive: true,
				},
			},
		};

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{
					floor: {
						building: {
							name: { contains: search, mode: 'insensitive' },
						},
					},
				},
			];
		}

		if (provinceId) {
			where.floor = {
				...where.floor,
				building: {
					...where.floor?.building,
					provinceId: parseInt(provinceId),
				},
			};
		}

		if (districtId) {
			where.floor = {
				...where.floor,
				building: {
					...where.floor?.building,
					districtId: parseInt(districtId),
				},
			};
		}

		if (wardId) {
			where.floor = {
				...where.floor,
				building: {
					...where.floor?.building,
					wardId: parseInt(wardId),
				},
			};
		}

		if (roomType) {
			where.roomType = roomType as RoomType;
		}

		if (maxOccupancy) {
			where.maxOccupancy = { lte: parseInt(maxOccupancy) };
		}

		if (isVerified !== undefined) {
			where.isVerified = isVerified === 'true';
		}

		if (minArea || maxArea) {
			where.areaSqm = {};
			if (minArea) where.areaSqm.gte = parseFloat(minArea);
			if (maxArea) where.areaSqm.lte = parseFloat(maxArea);
		}

		if (minPrice || maxPrice) {
			where.pricing = {};
			if (minPrice) where.pricing.basePriceMonthly = { gte: parseFloat(minPrice) };
			if (maxPrice) {
				where.pricing.basePriceMonthly = {
					...where.pricing.basePriceMonthly,
					lte: parseFloat(maxPrice),
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
					floor: {
						include: {
							building: {
								include: {
									province: { select: { id: true, name: true, code: true } },
									district: { select: { id: true, name: true, code: true } },
									ward: { select: { id: true, name: true, code: true } },
									owner: {
										select: {
											id: true,
											firstName: true,
											lastName: true,
											phone: true,
											isVerifiedPhone: true,
											isVerifiedEmail: true,
											isVerifiedIdentity: true,
										},
									},
								},
							},
						},
					},
					images: {
						orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
						take: 5,
					},
					amenities: {
						include: {
							systemAmenity: {
								select: {
									id: true,
									name: true,
									nameEn: true,
									category: true,
									iconUrl: true,
								},
							},
						},
					},
					costs: {
						include: {
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
					pricing: true,
					rules: {
						include: {
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
			description: room.description,
			roomType: room.roomType,
			areaSqm: room.areaSqm?.toString(),
			maxOccupancy: room.maxOccupancy,
			isVerified: room.isVerified,
			createdAt: room.createdAt,
			updatedAt: room.updatedAt,
			floor: {
				floorNumber: room.floor.floorNumber,
				building: {
					id: room.floor.building.id,
					name: room.floor.building.name,
					description: room.floor.building.description,
					addressLine1: room.floor.building.addressLine1,
					addressLine2: room.floor.building.addressLine2,
					latitude: room.floor.building.latitude?.toString(),
					longitude: room.floor.building.longitude?.toString(),
					isVerified: room.floor.building.isVerified,
					owner: room.floor.building.owner,
					location: {
						province: room.floor.building.province,
						district: room.floor.building.district,
						ward: room.floor.building.ward,
					},
				},
			},
			images: room.images,
			amenities: room.amenities.map((amenity) => ({
				id: amenity.id,
				customValue: amenity.customValue,
				notes: amenity.notes,
				systemAmenity: amenity.systemAmenity,
			})),
			costs: room.costs.map((cost) => ({
				id: cost.id,
				baseRate: cost.baseRate.toString(),
				currency: cost.currency,
				notes: cost.notes,
				systemCostType: cost.systemCostType,
			})),
			pricing: room.pricing
				? {
						id: room.pricing.id,
						basePriceMonthly: room.pricing.basePriceMonthly.toString(),
						currency: room.pricing.currency,
						depositAmount: room.pricing.depositAmount.toString(),
						depositMonths: room.pricing.depositMonths,
						utilityIncluded: room.pricing.utilityIncluded,
						utilityCostMonthly: room.pricing.utilityCostMonthly?.toString(),
						cleaningFee: room.pricing.cleaningFee?.toString(),
						serviceFeePercentage: room.pricing.serviceFeePercentage?.toString(),
						minimumStayMonths: room.pricing.minimumStayMonths,
						maximumStayMonths: room.pricing.maximumStayMonths,
						priceNegotiable: room.pricing.priceNegotiable,
					}
				: undefined,
			rules: room.rules.map((rule) => ({
				id: rule.id,
				ruleType: rule.systemRule.ruleType,
				ruleText: rule.customValue || rule.systemRule.name,
			})),
		}));

		return PaginatedResponseDto.create(formattedRooms, page, limit, total);
	}

	async getFeaturedListings(limit: number = 10) {
		const featuredRooms = await this.prisma.room.findMany({
			where: {
				isActive: true,
				isVerified: true,
				floor: {
					building: {
						isActive: true,
						isVerified: true,
					},
				},
			},
			take: limit,
			orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
			include: {
				floor: {
					include: {
						building: {
							include: {
								province: { select: { id: true, name: true, code: true } },
								district: { select: { id: true, name: true, code: true } },
								ward: { select: { id: true, name: true, code: true } },
							},
						},
					},
				},
				images: {
					where: { isPrimary: true },
					take: 1,
				},
				pricing: {
					select: {
						basePriceMonthly: true,
						currency: true,
						depositAmount: true,
					},
				},
			},
		});

		return featuredRooms.map((room) => ({
			id: room.id,
			slug: room.slug,
			name: room.name,
			roomType: room.roomType,
			areaSqm: room.areaSqm?.toString(),
			maxOccupancy: room.maxOccupancy,
			floor: {
				floorNumber: room.floor.floorNumber,
				building: {
					name: room.floor.building.name,
					addressLine1: room.floor.building.addressLine1,
					location: {
						province: room.floor.building.province,
						district: room.floor.building.district,
						ward: room.floor.building.ward,
					},
				},
			},
			primaryImage: room.images[0] || null,
			pricing: room.pricing
				? {
						basePriceMonthly: room.pricing.basePriceMonthly.toString(),
						currency: room.pricing.currency,
						depositAmount: room.pricing.depositAmount.toString(),
					}
				: null,
		}));
	}

	async getNearbyListings(
		latitude: number,
		longitude: number,
		radiusKm: number = 5,
		limit: number = 20,
	) {
		const nearbyRooms = await this.prisma.room.findMany({
			where: {
				isActive: true,
				floor: {
					building: {
						isActive: true,
						latitude: { not: null },
						longitude: { not: null },
					},
				},
			},
			take: limit * 3,
			include: {
				floor: {
					include: {
						building: {
							include: {
								province: { select: { id: true, name: true, code: true } },
								district: { select: { id: true, name: true, code: true } },
								ward: { select: { id: true, name: true, code: true } },
							},
						},
					},
				},
				images: {
					where: { isPrimary: true },
					take: 1,
				},
				pricing: {
					select: {
						basePriceMonthly: true,
						currency: true,
						depositAmount: true,
					},
				},
			},
		});

		const roomsWithDistance = nearbyRooms
			.filter((room) => {
				const buildingLat = room.floor.building.latitude;
				const buildingLng = room.floor.building.longitude;
				if (!buildingLat || !buildingLng) return false;

				const distance = this.calculateDistance(
					latitude,
					longitude,
					parseFloat(buildingLat.toString()),
					parseFloat(buildingLng.toString()),
				);
				return distance <= radiusKm;
			})
			.map((room) => {
				const buildingLat = parseFloat(room.floor.building.latitude!.toString());
				const buildingLng = parseFloat(room.floor.building.longitude!.toString());
				const distance = this.calculateDistance(latitude, longitude, buildingLat, buildingLng);

				return {
					id: room.id,
					slug: room.slug,
					name: room.name,
					roomType: room.roomType,
					areaSqm: room.areaSqm?.toString(),
					maxOccupancy: room.maxOccupancy,
					distance: Math.round(distance * 100) / 100,
					floor: {
						floorNumber: room.floor.floorNumber,
						building: {
							name: room.floor.building.name,
							addressLine1: room.floor.building.addressLine1,
							latitude: buildingLat.toString(),
							longitude: buildingLng.toString(),
							location: {
								province: room.floor.building.province,
								district: room.floor.building.district,
								ward: room.floor.building.ward,
							},
						},
					},
					primaryImage: room.images[0] || null,
					pricing: room.pricing
						? {
								basePriceMonthly: room.pricing.basePriceMonthly.toString(),
								currency: room.pricing.currency,
								depositAmount: room.pricing.depositAmount.toString(),
							}
						: null,
				};
			})
			.sort((a, b) => a.distance - b.distance)
			.slice(0, limit);

		return roomsWithDistance;
	}

	private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371;
		const dLat = this.deg2rad(lat2 - lat1);
		const dLon = this.deg2rad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(this.deg2rad(lat1)) *
				Math.cos(this.deg2rad(lat2)) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const d = R * c;
		return d;
	}

	private deg2rad(deg: number): number {
		return deg * (Math.PI / 180);
	}
}
