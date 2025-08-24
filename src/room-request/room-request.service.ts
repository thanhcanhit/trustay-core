import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomRequest, RoomRequestAmenity, SearchPostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
	CreateRoomRequestDto,
	QueryRoomRequestDto,
	RoomRequestResponseDto,
	UpdateRoomRequestDto,
} from './dto';

@Injectable()
export class RoomRequestService {
	constructor(private readonly prisma: PrismaService) {}

	async create(
		createRoomRequestDto: CreateRoomRequestDto,
		requesterId: string,
	): Promise<RoomRequestResponseDto> {
		const { amenityIds, ...roomRequestData } = createRoomRequestDto;

		// Kiểm tra slug đã tồn tại chưa
		const existingRequest = await this.prisma.roomRequest.findUnique({
			where: { slug: roomRequestData.slug },
		});

		if (existingRequest) {
			throw new BadRequestException('Slug đã tồn tại');
		}

		// Tạo room request với amenities
		const roomRequest = await this.prisma.roomRequest.create({
			data: {
				...roomRequestData,
				requesterId,
				status: SearchPostStatus.active,
				currency: roomRequestData.currency || 'VND',
				isPublic: roomRequestData.isPublic ?? true,
				amenities:
					amenityIds && amenityIds.length > 0
						? {
								create: amenityIds.map((amenityId) => ({
									systemAmenityId: amenityId,
									isRequired: false,
								})),
							}
						: undefined,
			},
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
					include: {
						systemAmenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								description: true,
							},
						},
					},
				},
			},
		});

		return this.mapToResponseDto(roomRequest);
	}

	async findAll(
		query: QueryRoomRequestDto,
	): Promise<{ data: RoomRequestResponseDto[]; total: number; page: number; limit: number }> {
		const {
			page = 1,
			limit = 20,
			search,
			city,
			district,
			ward,
			minBudget,
			maxBudget,
			roomType,
			occupancy,
			status,
			isPublic,
			requesterId,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const where: Prisma.RoomRequestWhereInput = {
			...(search && {
				OR: [
					{ title: { contains: search, mode: 'insensitive' } },
					{ description: { contains: search, mode: 'insensitive' } },
				],
			}),
			...(city && { preferredCity: { contains: city, mode: 'insensitive' } }),
			...(district && { preferredDistrict: { contains: district, mode: 'insensitive' } }),
			...(ward && { preferredWard: { contains: ward, mode: 'insensitive' } }),
			...(minBudget !== undefined && { maxBudget: { gte: minBudget } }),
			...(maxBudget !== undefined && { maxBudget: { lte: maxBudget } }),
			...(roomType && { preferredRoomType: roomType }),
			...(occupancy && { occupancy: occupancy }),
			...(status && { status }),
			...(isPublic !== undefined && { isPublic }),
			...(requesterId && { requesterId }),
		};

		const orderBy: Prisma.RoomRequestOrderByWithRelationInput = {
			[sortBy]: sortOrder,
		};

		const [data, total] = await Promise.all([
			this.prisma.roomRequest.findMany({
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
						include: {
							systemAmenity: {
								select: {
									id: true,
									name: true,
									nameEn: true,
									category: true,
									description: true,
								},
							},
						},
					},
				},
			}),
			this.prisma.roomRequest.count({ where }),
		]);

		return {
			data: data.map((item) => this.mapToResponseDto(item)),
			total,
			page,
			limit,
		};
	}

	async findOne(id: string): Promise<RoomRequestResponseDto> {
		const roomRequest = await this.prisma.roomRequest.findUnique({
			where: { id },
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
					include: {
						systemAmenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								description: true,
							},
						},
					},
				},
			},
		});

		if (!roomRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		// Tăng view count
		await this.prisma.roomRequest.update({
			where: { id },
			data: { viewCount: { increment: 1 } },
		});

		return this.mapToResponseDto(roomRequest);
	}

	async update(
		id: string,
		updateRoomRequestDto: UpdateRoomRequestDto,
		requesterId: string,
	): Promise<RoomRequestResponseDto> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomRequest.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài đăng này');
		}

		const { amenityIds, ...updateData } = updateRoomRequestDto;

		// Kiểm tra slug mới nếu có thay đổi
		if (updateData.slug) {
			const slugExists = await this.prisma.roomRequest.findFirst({
				where: {
					slug: updateData.slug,
					id: { not: id },
				},
			});

			if (slugExists) {
				throw new BadRequestException('Slug đã tồn tại');
			}
		}

		// Cập nhật room request
		const updatedRequest = await this.prisma.roomRequest.update({
			where: { id },
			data: {
				...updateData,
				...(amenityIds && {
					amenities: {
						deleteMany: {},
						create: amenityIds.map((amenityId) => ({
							systemAmenityId: amenityId,
							isRequired: false,
						})),
					},
				}),
			},
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
					include: {
						systemAmenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								description: true,
							},
						},
					},
				},
			},
		});

		return this.mapToResponseDto(updatedRequest);
	}

	async remove(id: string, requesterId: string): Promise<void> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomRequest.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('Bạn không có quyền xóa bài đăng này');
		}

		await this.prisma.roomRequest.delete({
			where: { id },
		});
	}

	async incrementContactCount(id: string): Promise<void> {
		await this.prisma.roomRequest.update({
			where: { id },
			data: { contactCount: { increment: 1 } },
		});
	}

	async updateStatus(
		id: string,
		status: SearchPostStatus,
		requesterId: string,
	): Promise<RoomRequestResponseDto> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomRequest.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('Bạn không có quyền thay đổi trạng thái bài đăng này');
		}

		const updatedRequest = await this.prisma.roomRequest.update({
			where: { id },
			data: { status },
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
					include: {
						systemAmenity: {
							select: {
								id: true,
								name: true,
								nameEn: true,
								category: true,
								description: true,
							},
						},
					},
				},
			},
		});

		return this.mapToResponseDto(updatedRequest);
	}

	private mapToResponseDto(roomRequest: any): RoomRequestResponseDto {
		return {
			id: roomRequest.id,
			title: roomRequest.title,
			description: roomRequest.description,
			slug: roomRequest.slug,
			requesterId: roomRequest.requesterId,
			preferredDistrict: roomRequest.preferredDistrict,
			preferredWard: roomRequest.preferredWard,
			preferredCity: roomRequest.preferredCity,
			minBudget: roomRequest.minBudget,
			maxBudget: roomRequest.maxBudget,
			currency: roomRequest.currency,
			preferredRoomType: roomRequest.preferredRoomType,
			occupancy: roomRequest.occupancy,
			moveInDate: roomRequest.moveInDate,
			status: roomRequest.status,
			isPublic: roomRequest.isPublic,
			expiresAt: roomRequest.expiresAt,
			viewCount: roomRequest.viewCount,
			contactCount: roomRequest.contactCount,
			createdAt: roomRequest.createdAt,
			updatedAt: roomRequest.updatedAt,
			requester: roomRequest.requester,
			amenities: roomRequest.amenities,
		};
	}
}
