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
								iconUrl: true,
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
			floorNumber: room.floor.floorNumber,
			buildingName: room.floor.building.name,
			buildingDescription: room.floor.building.description,
			address: room.floor.building.addressLine1,
			addressLine2: room.floor.building.addressLine2,
			latitude: room.floor.building.latitude?.toString(),
			longitude: room.floor.building.longitude?.toString(),
			location: {
				provinceId: room.floor.building.province.id,
				provinceName: room.floor.building.province.name,
				districtId: room.floor.building.district.id,
				districtName: room.floor.building.district.name,
				wardId: room.floor.building.ward?.id,
				wardName: room.floor.building.ward?.name,
			},
			owner: {
				id: room.floor.building.owner.id,
				firstName: room.floor.building.owner.firstName,
				lastName: room.floor.building.owner.lastName,
				phone: room.floor.building.owner.phone,
				isVerifiedPhone: room.floor.building.owner.isVerifiedPhone,
				isVerifiedEmail: room.floor.building.owner.isVerifiedEmail,
				isVerifiedIdentity: room.floor.building.owner.isVerifiedIdentity,
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
