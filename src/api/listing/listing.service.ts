import { Injectable } from '@nestjs/common';
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
			where.floor.building.provinceId = parseInt(provinceId);
		}

		if (districtId) {
			where.floor.building.districtId = parseInt(districtId);
		}

		if (wardId) {
			where.floor.building.wardId = parseInt(wardId);
		}

		if (roomType) {
			where.roomType = roomType;
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
						select: {
							floorNumber: true,
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
						},
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
			buildingName: room.floor.building.name,
			buildingVerified: room.floor.building.isVerified,
			address: room.floor.building.addressLine1,
			owner: {
				name: `${room.floor.building.owner.firstName} ${room.floor.building.owner.lastName}`,
				avatarUrl: room.floor.building.owner.avatarUrl,
				gender: room.floor.building.owner.gender,
				verifiedPhone: room.floor.building.owner.isVerifiedPhone,
				verifiedEmail: room.floor.building.owner.isVerifiedEmail,
				verifiedIdentity: room.floor.building.owner.isVerifiedIdentity,
			},
			location: {
				provinceId: room.floor.building.province.id,
				provinceName: room.floor.building.province.name,
				districtId: room.floor.building.district.id,
				districtName: room.floor.building.district.name,
				wardId: room.floor.building.ward?.id,
				wardName: room.floor.building.ward?.name,
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
}
