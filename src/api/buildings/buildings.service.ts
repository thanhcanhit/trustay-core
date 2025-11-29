import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { convertDecimalToNumber, generateBuildingSlug, generateUniqueSlug } from '@/common/utils';
import { PrismaService } from '@/prisma/prisma.service';
import {
	BuildingQuickItemDto,
	BuildingResponseDto,
	CreateBuildingDto,
	UpdateBuildingDto,
} from './dto';

@Injectable()
export class BuildingsService {
	constructor(private prisma: PrismaService) {}

	async create(userId: string, createBuildingDto: CreateBuildingDto): Promise<BuildingResponseDto> {
		// Verify user is landlord
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, role: true },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		if (user.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can create buildings');
		}

		// Validate location exists
		await this.validateLocation(
			createBuildingDto.districtId,
			createBuildingDto.provinceId,
			createBuildingDto.wardId,
		);

		// Get district name for slug generation
		const district = await this.prisma.district.findUnique({
			where: { id: createBuildingDto.districtId },
			select: { name: true },
		});

		if (!district) {
			throw new BadRequestException('District not found');
		}

		// Generate unique slug
		const baseSlug = generateBuildingSlug(createBuildingDto.name, district.name);
		const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
			const existing = await this.prisma.building.findUnique({
				where: { slug },
				select: { id: true },
			});
			return !!existing;
		});

		// Create building
		const building = await this.prisma.building.create({
			data: {
				id: uniqueSlug,
				slug: uniqueSlug,
				ownerId: userId,
				name: createBuildingDto.name,
				description: createBuildingDto.description,
				addressLine1: createBuildingDto.addressLine1,
				addressLine2: createBuildingDto.addressLine2,
				wardId: createBuildingDto.wardId,
				districtId: createBuildingDto.districtId,
				provinceId: createBuildingDto.provinceId,
				country: createBuildingDto.country || 'Vietnam',
				latitude: createBuildingDto.latitude,
				longitude: createBuildingDto.longitude,
				isActive: createBuildingDto.isActive ?? true,
			},
			include: {
				owner: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						avatarUrl: true,
						isVerifiedIdentity: true,
					},
				},
				ward: { select: { name: true } },
				district: { select: { name: true } },
				province: { select: { name: true } },
				_count: {
					select: {
						rooms: true,
					},
				},
			},
		});

		return this.transformBuildingResponse(building);
	}

	async findOne(buildingId: string): Promise<BuildingResponseDto> {
		const building = await this.prisma.building.findUnique({
			where: { id: buildingId },
			include: {
				owner: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						avatarUrl: true,
						isVerifiedIdentity: true,
					},
				},
				ward: { select: { name: true } },
				district: { select: { name: true } },
				province: { select: { name: true } },
				_count: {
					select: {
						rooms: true,
					},
				},
			},
		});

		if (!building) {
			throw new NotFoundException('Building not found');
		}

		return this.transformBuildingResponse(building);
	}

	private async validateLocation(
		districtId: number,
		provinceId: number,
		wardId?: number,
	): Promise<void> {
		// Check province exists
		const province = await this.prisma.province.findUnique({
			where: { id: provinceId },
			select: { id: true },
		});
		if (!province) {
			throw new BadRequestException('Province not found');
		}

		// Check district belongs to province
		const district = await this.prisma.district.findUnique({
			where: { id: districtId },
			select: { id: true, provinceId: true },
		});
		if (!district) {
			throw new BadRequestException('District not found');
		}
		if (district.provinceId !== provinceId) {
			throw new BadRequestException('District does not belong to the specified province');
		}

		// Check ward belongs to district (if provided)
		if (wardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: wardId },
				select: { id: true, districtId: true },
			});
			if (!ward) {
				throw new BadRequestException('Ward not found');
			}
			if (ward.districtId !== districtId) {
				throw new BadRequestException('Ward does not belong to the specified district');
			}
		}
	}

	async update(
		userId: string,
		buildingId: string,
		updateBuildingDto: UpdateBuildingDto,
	): Promise<BuildingResponseDto> {
		// Verify building ownership
		const existingBuilding = await this.prisma.building.findUnique({
			where: { id: buildingId },
			include: {
				owner: { select: { id: true, role: true } },
			},
		});

		if (!existingBuilding) {
			throw new NotFoundException('Building not found');
		}

		if (existingBuilding.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can update building');
		}

		if (existingBuilding.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can update buildings');
		}

		// Validate location if provided
		if (updateBuildingDto.districtId || updateBuildingDto.provinceId || updateBuildingDto.wardId) {
			const districtId = updateBuildingDto.districtId || existingBuilding.districtId;
			const provinceId = updateBuildingDto.provinceId || existingBuilding.provinceId;
			const wardId = updateBuildingDto.wardId || existingBuilding.wardId;

			await this.validateLocation(districtId, provinceId, wardId);
		}

		// Generate new slug if name or district changed
		let newSlug = existingBuilding.slug;
		if (updateBuildingDto.name || updateBuildingDto.districtId) {
			const newName = updateBuildingDto.name || existingBuilding.name;
			const newDistrictId = updateBuildingDto.districtId || existingBuilding.districtId;

			const district = await this.prisma.district.findUnique({
				where: { id: newDistrictId },
				select: { name: true },
			});

			if (!district) {
				throw new BadRequestException('District not found');
			}

			const baseSlug = generateBuildingSlug(newName, district.name);
			if (baseSlug !== existingBuilding.slug) {
				newSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
					if (slug === existingBuilding.slug) {
						return false;
					} // Same slug is OK
					const existing = await this.prisma.building.findUnique({
						where: { slug },
						select: { id: true },
					});
					return !!existing;
				});
			}
		}

		// Update building
		const building = await this.prisma.building.update({
			where: { id: buildingId },
			data: {
				...(newSlug !== existingBuilding.slug && { slug: newSlug }),
				...updateBuildingDto,
			},
			include: {
				owner: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						avatarUrl: true,
						isVerifiedIdentity: true,
					},
				},
				ward: { select: { name: true } },
				district: { select: { name: true } },
				province: { select: { name: true } },
				rooms: {
					include: {
						roomInstances: {
							select: {
								status: true,
							},
						},
					},
				},
			},
		});

		return this.transformBuildingResponse(building);
	}

	async remove(userId: string, buildingId: string): Promise<void> {
		// Verify building ownership
		const building = await this.prisma.building.findUnique({
			where: { id: buildingId },
			include: {
				owner: { select: { id: true, role: true } },
				rooms: {
					include: {
						roomInstances: {
							include: {
								rentals: {
									where: { status: { in: ['active', 'pending_renewal'] } },
									select: { id: true },
								},
							},
						},
					},
				},
			},
		});

		if (!building) {
			throw new NotFoundException('Building not found');
		}

		if (building.owner.id !== userId) {
			throw new ForbiddenException('Only building owner can delete building');
		}

		if (building.owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can delete buildings');
		}

		// Check if there are active rentals
		const hasActiveRentals = building.rooms.some((room) =>
			room.roomInstances.some((instance) => instance.rentals.length > 0),
		);

		if (hasActiveRentals) {
			throw new BadRequestException(
				'Cannot delete building with active rentals. Please terminate all rentals first.',
			);
		}

		// Delete building (cascade will handle rooms, instances, etc.)
		await this.prisma.building.delete({
			where: { id: buildingId },
		});
	}

	async findManyByOwner(
		userId: string,
		page: number = 1,
		limit: number = 10,
	): Promise<{
		buildings: BuildingResponseDto[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const skip = (page - 1) * limit;

		const [buildings, total] = await this.prisma.$transaction([
			this.prisma.building.findMany({
				where: { ownerId: userId },
				include: {
					owner: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
							isVerifiedIdentity: true,
						},
					},
					ward: { select: { name: true } },
					district: { select: { name: true } },
					province: { select: { name: true } },
					rooms: {
						include: {
							roomInstances: {
								select: {
									status: true,
								},
							},
						},
					},
				},
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.building.count({
				where: { ownerId: userId },
			}),
		]);

		return {
			buildings: buildings.map((building) => this.transformBuildingResponse(building)),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	async findQuickListByOwner(userId: string): Promise<BuildingQuickItemDto[]> {
		const buildings = await this.prisma.building.findMany({
			where: { ownerId: userId },
			include: {
				ward: { select: { name: true } },
				district: { select: { name: true } },
				province: { select: { name: true } },
				rooms: { select: { id: true } },
			},
			orderBy: { createdAt: 'desc' },
		});

		// First image is derived from room images; pick the first primary image if available, else first image
		// To avoid heavy joins, fetch a single image per building via a second query using rooms' ids
		const roomIds = buildings.flatMap((b) => b.rooms.map((r) => r.id));
		const coverByRoomId: Record<string, string | undefined> = {};
		if (roomIds.length > 0) {
			const images = await this.prisma.roomImage.findMany({
				where: { roomId: { in: roomIds } },
				select: { roomId: true, imageUrl: true, isPrimary: true, sortOrder: true },
				orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
			});
			for (const img of images) {
				if (coverByRoomId[img.roomId] === undefined) {
					coverByRoomId[img.roomId] = img.imageUrl;
				}
			}
		}

		const result: BuildingQuickItemDto[] = buildings.map((b) => {
			const firstRoomId = b.rooms[0]?.id;
			const coverImage = firstRoomId ? coverByRoomId[firstRoomId] : undefined;
			return {
				id: b.id,
				name: b.name,
				coverImage,
				location: { districtName: b.district?.name || '', provinceName: b.province?.name || '' },
				roomCount: b.rooms.length,
			};
		});

		return result;
	}

	private transformBuildingResponse(building: any): BuildingResponseDto {
		// Calculate room counts
		const roomCount = building.rooms?.length || building._count?.rooms || 0;
		const availableRoomCount =
			building.rooms?.reduce((count: number, room: any) => {
				const availableInstances =
					room.roomInstances?.filter((instance: any) => instance.status === 'available').length ||
					0;
				return count + availableInstances;
			}, 0) || undefined;

		// Build owner object manually to avoid Decimal issues
		const owner = building.owner
			? {
					id: building.owner.id,
					firstName: building.owner.firstName,
					lastName: building.owner.lastName,
					avatarUrl: building.owner.avatarUrl,
					isVerifiedIdentity: building.owner.isVerifiedIdentity,
				}
			: undefined;

		// Safely handle undefined values for Decimal fields and exclude rooms array
		const latitudeValue = building.latitude ? convertDecimalToNumber(building.latitude) : undefined;
		const longitudeValue = building.longitude
			? convertDecimalToNumber(building.longitude)
			: undefined;
		const safeBuilding: any = {
			id: building.id,
			slug: building.slug,
			ownerId: building.ownerId,
			name: building.name,
			description: building.description,
			addressLine1: building.addressLine1,
			addressLine2: building.addressLine2,
			wardId: building.wardId,
			districtId: building.districtId,
			provinceId: building.provinceId,
			country: building.country,
			isActive: building.isActive,
			isVerified: building.isVerified,
			createdAt: building.createdAt,
			updatedAt: building.updatedAt,
			owner,
			location: {
				wardName: building.ward?.name,
				districtName: building.district?.name,
				provinceName: building.province?.name,
			},
			roomCount,
			availableRoomCount,
		};
		// Only include latitude/longitude if they have values
		if (latitudeValue !== undefined) {
			safeBuilding.latitude = latitudeValue;
		}
		if (longitudeValue !== undefined) {
			safeBuilding.longitude = longitudeValue;
		}

		const response = plainToInstance(BuildingResponseDto, safeBuilding);

		return response;
	}
}
