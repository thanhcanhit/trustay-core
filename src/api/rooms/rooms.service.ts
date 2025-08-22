import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { plainToClass } from 'class-transformer';
import { generateRoomSlug, generateUniqueSlug } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto, RoomResponseDto } from './dto';
import { RoomDetailDto } from './dto/room-detail.dto';

@Injectable()
export class RoomsService {
	constructor(private readonly prisma: PrismaService) {}

	async create(
		userId: string,
		buildingId: string,
		createRoomDto: CreateRoomDto,
	): Promise<RoomResponseDto> {
		// Verify building ownership and existence
		const building = await this.prisma.building.findUnique({
			where: { id: buildingId },
			include: {
				owner: { select: { id: true, role: true } },
			},
		});

		if (!building) {
			throw new NotFoundException('Building not found');
		}

		if (building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can create rooms');
		}

		if (building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can create rooms');
		}

		// Validate system references exist
		await this.validateSystemReferences(createRoomDto);

		// Generate unique room slug
		const baseSlug = generateRoomSlug(building.slug, createRoomDto.name);
		const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
			const existing = await this.prisma.room.findUnique({
				where: { slug },
				select: { id: true },
			});
			return !!existing;
		});

		// Create room with related data in transaction
		const result = await this.prisma.$transaction(async (tx) => {
			// 1. Create room
			const room = await tx.room.create({
				data: {
					slug: uniqueSlug,
					buildingId,
					floorNumber: createRoomDto.floorNumber,
					name: createRoomDto.name,
					description: createRoomDto.description,
					roomType: createRoomDto.roomType,
					areaSqm: createRoomDto.areaSqm,
					maxOccupancy: createRoomDto.maxOccupancy || 1,
					totalRooms: createRoomDto.totalRooms,
					isActive: createRoomDto.isActive ?? true,
				},
			});

			// 2. Create pricing
			await tx.roomPricing.create({
				data: {
					roomId: room.id,
					basePriceMonthly: createRoomDto.pricing.basePriceMonthly,
					depositAmount: createRoomDto.pricing.depositAmount,
					depositMonths: createRoomDto.pricing.depositMonths || 1,
					utilityIncluded: createRoomDto.pricing.utilityIncluded || false,
					utilityCostMonthly: createRoomDto.pricing.utilityCostMonthly,
					cleaningFee: createRoomDto.pricing.cleaningFee,
					serviceFeePercentage: createRoomDto.pricing.serviceFeePercentage,
					minimumStayMonths: createRoomDto.pricing.minimumStayMonths || 1,
					maximumStayMonths: createRoomDto.pricing.maximumStayMonths,
					priceNegotiable: createRoomDto.pricing.priceNegotiable || false,
				},
			});

			// 3. Create amenities
			if (createRoomDto.amenities?.length) {
				await tx.roomAmenity.createMany({
					data: createRoomDto.amenities.map((amenity) => ({
						roomId: room.id,
						systemAmenityId: amenity.systemAmenityId,
						customValue: amenity.customValue,
						notes: amenity.notes,
					})),
				});
			}

			// 4. Create costs
			if (createRoomDto.costs?.length) {
				await tx.roomCost.createMany({
					data: createRoomDto.costs.map((cost) => ({
						roomId: room.id,
						systemCostTypeId: cost.systemCostTypeId,
						costType: cost.costType || 'fixed',
						// Map value to appropriate field based on costType
						fixedAmount: cost.costType === 'fixed' ? cost.value : null,
						unitPrice: cost.costType === 'per_unit' ? cost.value : null,
						baseRate: ['metered', 'percentage', 'tiered'].includes(cost.costType || 'fixed')
							? cost.value
							: null,
						unit: cost.unit,
						billingCycle: cost.billingCycle || 'monthly',
						includedInRent: cost.includedInRent || false,
						isOptional: cost.isOptional || false,
						notes: cost.notes,
					})),
				});
			}

			// 5. Create rules
			if (createRoomDto.rules?.length) {
				await tx.roomRule.createMany({
					data: createRoomDto.rules.map((rule) => ({
						roomId: room.id,
						systemRuleId: rule.systemRuleId,
						customValue: rule.customValue,
						isEnforced: rule.isEnforced ?? true,
						notes: rule.notes,
					})),
				});
			}

			// 6. Create room instances (batch)
			const roomInstances = this.generateRoomNumbers(
				createRoomDto.totalRooms,
				createRoomDto.roomNumberPrefix,
				createRoomDto.roomNumberStart || 1,
			);

			await tx.roomInstance.createMany({
				data: roomInstances.map((roomNumber) => ({
					roomId: room.id,
					roomNumber,
					status: 'available',
					isActive: true,
				})),
			});

			return room.id;
		});

		// Return created room with full details
		return this.findOne(result);
	}

	async findOne(roomId: string): Promise<RoomResponseDto> {
		const room = await this.prisma.room.findUnique({
			where: { id: roomId },
			include: {
				building: {
					select: {
						id: true,
						name: true,
						addressLine1: true,
					},
				},
				pricing: true,
				amenities: {
					include: {
						systemAmenity: {
							select: {
								name: true,
								nameEn: true,
								category: true,
							},
						},
					},
				},
				costs: {
					include: {
						systemCostType: {
							select: {
								name: true,
								nameEn: true,
								category: true,
							},
						},
					},
				},
				rules: {
					include: {
						systemRule: {
							select: {
								name: true,
								nameEn: true,
								category: true,
								ruleType: true,
							},
						},
					},
				},
				roomInstances: {
					orderBy: { roomNumber: 'asc' },
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		return this.transformRoomResponse(room);
	}

	private async validateSystemReferences(createRoomDto: CreateRoomDto): Promise<void> {
		// Validate amenities
		if (createRoomDto.amenities?.length) {
			const amenityIds = createRoomDto.amenities.map((a) => a.systemAmenityId);
			const existingAmenities = await this.prisma.systemAmenity.findMany({
				where: { id: { in: amenityIds }, isActive: true },
				select: { id: true },
			});

			if (existingAmenities.length !== amenityIds.length) {
				throw new BadRequestException('Some amenities not found or inactive');
			}
		}

		// Validate cost types
		if (createRoomDto.costs?.length) {
			const costTypeIds = createRoomDto.costs.map((c) => c.systemCostTypeId);
			const existingCostTypes = await this.prisma.systemCostType.findMany({
				where: { id: { in: costTypeIds }, isActive: true },
				select: { id: true },
			});

			if (existingCostTypes.length !== costTypeIds.length) {
				throw new BadRequestException('Some cost types not found or inactive');
			}
		}

		// Validate rules
		if (createRoomDto.rules?.length) {
			const ruleIds = createRoomDto.rules.map((r) => r.systemRuleId);
			const existingRules = await this.prisma.systemRoomRule.findMany({
				where: { id: { in: ruleIds }, isActive: true },
				select: { id: true },
			});

			if (existingRules.length !== ruleIds.length) {
				throw new BadRequestException('Some rules not found or inactive');
			}
		}
	}

	private generateRoomNumbers(
		totalRooms: number,
		prefix?: string,
		startNumber: number = 1,
	): string[] {
		const roomNumbers: string[] = [];

		for (let i = 0; i < totalRooms; i++) {
			const number = startNumber + i;
			const roomNumber = prefix ? `${prefix}${number}` : number.toString();
			roomNumbers.push(roomNumber);
		}

		return roomNumbers;
	}

	private transformRoomResponse(room: any): RoomResponseDto {
		const availableInstancesCount =
			room.roomInstances?.filter((instance: any) => instance.status === 'available').length || 0;

		const occupiedInstancesCount =
			room.roomInstances?.filter((instance: any) => instance.status === 'occupied').length || 0;

		return plainToClass(RoomResponseDto, {
			...room,
			building: room.building,
			availableInstancesCount,
			occupiedInstancesCount,
		});
	}

	async getRoomBySlug(slug: string): Promise<RoomDetailDto> {
		// Find room type by slug
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
				roomInstances: {
					select: {
						id: true,
						roomNumber: true,
						status: true,
						isActive: true,
					},
					where: { isActive: true },
					orderBy: { roomNumber: 'asc' },
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
			totalRooms: room.totalRooms,
			availableRooms: room.roomInstances.filter((instance) => instance.status === 'available')
				.length,
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
			roomInstances: room.roomInstances.map((instance) => ({
				id: instance.id,
				roomNumber: instance.roomNumber,
				isOccupied: instance.status === 'occupied',
				isActive: instance.isActive,
			})),
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
