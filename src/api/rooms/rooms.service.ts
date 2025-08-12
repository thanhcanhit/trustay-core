import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomDetailDto } from './dto/room-detail.dto';

@Injectable()
export class RoomsService {
	constructor(private readonly prisma: PrismaService) {}

	async getRoomBySlug(slug: string): Promise<RoomDetailDto> {
		const room = await this.prisma.room.findFirst({
			where: {
				slug: slug,
				isActive: true,
			},
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
								avatarUrl: true,
								gender: true,
								phone: true,
								isVerifiedPhone: true,
								isVerifiedEmail: true,
								isVerifiedIdentity: true,
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
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		return {
			id: room.id,
			slug: room.slug,
			name: room.name,
			description: room.description,
			roomType: room.roomType,
			areaSqm: room.areaSqm?.toString(),
			maxOccupancy: room.maxOccupancy,
			isVerified: room.isVerified,
			isActive: room.isActive,
			floorNumber: room.floorNumber,
			buildingName: room.building.name,
			buildingDescription: room.building.description,
			address: room.building.addressLine1,
			addressLine2: room.building.addressLine2,
			latitude: room.building.latitude?.toString(),
			longitude: room.building.longitude?.toString(),
			location: {
				provinceId: room.building.province.id,
				provinceName: room.building.province.name,
				districtId: room.building.district.id,
				districtName: room.building.district.name,
				wardId: room.building.ward?.id,
				wardName: room.building.ward?.name,
			},
			owner: {
				id: room.building.owner.id,
				firstName: room.building.owner.firstName,
				lastName: room.building.owner.lastName,
				phone: room.building.owner.phone,
				isVerifiedPhone: room.building.owner.isVerifiedPhone,
				isVerifiedEmail: room.building.owner.isVerifiedEmail,
				isVerifiedIdentity: room.building.owner.isVerifiedIdentity,
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
				customValue: amenity.customValue,
				notes: amenity.notes,
			})),
			costs: room.costs.map((cost) => ({
				id: cost.systemCostType.id,
				name: cost.systemCostType.name,
				value: cost.baseRate.toString(),
				category: cost.systemCostType.category,
				notes: cost.notes,
			})),
			pricing: room.pricing
				? {
						basePriceMonthly: room.pricing.basePriceMonthly.toString(),
						depositAmount: room.pricing.depositAmount.toString(),
						depositMonths: room.pricing.depositMonths,
						utilityIncluded: room.pricing.utilityIncluded,
						utilityCostMonthly: room.pricing.utilityCostMonthly?.toString(),
						minimumStayMonths: room.pricing.minimumStayMonths,
						maximumStayMonths: room.pricing.maximumStayMonths,
						priceNegotiable: room.pricing.priceNegotiable,
					}
				: undefined,
			rules: room.rules.map((rule) => ({
				id: rule.systemRule.id,
				name: rule.customValue || rule.systemRule.name,
				type: rule.systemRule.ruleType,
				customValue: rule.customValue,
				notes: rule.notes,
				isEnforced: rule.isEnforced,
			})),
			lastUpdated: room.updatedAt,
		};
	}
}
