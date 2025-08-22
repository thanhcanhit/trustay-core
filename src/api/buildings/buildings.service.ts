import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { plainToClass } from 'class-transformer';
import { generateBuildingSlug, generateUniqueSlug } from '@/common/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { BuildingResponseDto, CreateBuildingDto } from './dto';

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

		const response = plainToClass(BuildingResponseDto, {
			...building,
			location: {
				wardName: building.ward?.name,
				districtName: building.district?.name,
				provinceName: building.province?.name,
			},
			roomCount,
			availableRoomCount,
		});

		return response;
	}
}
