import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { SearchPostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
	CreateRoomSeekingPostDto,
	QueryRoomSeekingPostDto,
	RoomRoomSeekingPostDto,
	UpdateRoomSeekingPostDto,
} from './dto';

@Injectable()
export class RoomSeekingPostService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll(query: QueryRoomSeekingPostDto): Promise<{
		data: RoomRoomSeekingPostDto[];
		total: number;
		page: number;
		limit: number;
	}> {
		const {
			page = 1,
			limit = 20,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			search,
			provinceId,
			districtId,
			wardId,
			minBudget,
			maxBudget,
			roomType,
			occupancy,
			status,
			isPublic,
			requesterId,
		} = query;

		const where: any = {
			...(typeof requesterId === 'string' && { requesterId }),
			...(typeof isPublic === 'boolean' && { isPublic }),
			...(status && { status }),
			...(typeof occupancy === 'number' && { occupancy }),
			...(roomType && { preferredRoomType: roomType }),
			...(typeof provinceId === 'number' && { preferredProvinceId: provinceId }),
			...(typeof districtId === 'number' && { preferredDistrictId: districtId }),
			...(typeof wardId === 'number' && { preferredWardId: wardId }),
			...(typeof minBudget === 'number' && { maxBudget: { gte: minBudget } }),
			...(typeof maxBudget === 'number' && { maxBudget: { lte: maxBudget } }),
			...(search && {
				OR: [
					{ title: { contains: search, mode: 'insensitive' } },
					{ description: { contains: search, mode: 'insensitive' } },
				],
			}),
		};

		const [items, total] = await Promise.all([
			this.prisma.roomSeekingPost.findMany({
				where,
				orderBy: { [sortBy]: sortOrder },
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
					preferredProvince: { select: { id: true, name: true, nameEn: true } },
					preferredDistrict: { select: { id: true, name: true, nameEn: true } },
					preferredWard: { select: { id: true, name: true, nameEn: true } },
				},
			}),
			this.prisma.roomSeekingPost.count({ where }),
		]);

		return {
			data: items.map((it) => this.mapToResponseDto(it)),
			total,
			page,
			limit,
		};
	}

	async create(
		createRoomRequestDto: CreateRoomSeekingPostDto,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		const { amenityIds, ...roomRequestData } = createRoomRequestDto;

		// Kiểm tra slug đã tồn tại chưa
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { slug: roomRequestData.slug },
		});

		if (existingRequest) {
			throw new BadRequestException('Slug đã tồn tại');
		}

		// Tạo room request với amenities
		const roomRequest = await this.prisma.roomSeekingPost.create({
			data: {
				...roomRequestData,
				requesterId,
				status: SearchPostStatus.active,
				currency: roomRequestData.currency || 'VND',
				isPublic: roomRequestData.isPublic ?? true,
				amenities:
					amenityIds && amenityIds.length > 0
						? {
								connect: amenityIds.map((amenityId) => ({ id: amenityId })),
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
		});

		return this.mapToResponseDto(roomRequest);
	}

	async findOne(id: string): Promise<RoomRoomSeekingPostDto> {
		const roomRequest = await this.prisma.roomSeekingPost.findUnique({
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
		});

		if (!roomRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		// Tăng view count
		await this.prisma.roomSeekingPost.update({
			where: { id },
			data: { viewCount: { increment: 1 } },
		});

		return this.mapToResponseDto(roomRequest);
	}

	async update(
		id: string,
		updateRoomRequestDto: UpdateRoomSeekingPostDto,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
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
			const slugExists = await this.prisma.roomSeekingPost.findFirst({
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
		const updatedRequest = await this.prisma.roomSeekingPost.update({
			where: { id },
			data: {
				...updateData,
				...(amenityIds && {
					amenities: {
						set: amenityIds.map((amenityId) => ({ id: amenityId })),
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
		});

		return this.mapToResponseDto(updatedRequest);
	}

	async remove(id: string, requesterId: string): Promise<void> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('Bạn không có quyền xóa bài đăng này');
		}

		await this.prisma.roomSeekingPost.delete({
			where: { id },
		});
	}

	async incrementContactCount(id: string): Promise<void> {
		await this.prisma.roomSeekingPost.update({
			where: { id },
			data: { contactCount: { increment: 1 } },
		});
	}

	async updateStatus(
		id: string,
		status: SearchPostStatus,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Không tìm thấy bài đăng tìm trọ');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('Bạn không có quyền thay đổi trạng thái bài đăng này');
		}

		const updatedRequest = await this.prisma.roomSeekingPost.update({
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
		});

		return this.mapToResponseDto(updatedRequest);
	}

	private mapToResponseDto(roomRequest: any): RoomRoomSeekingPostDto {
		return {
			id: roomRequest.id,
			title: roomRequest.title,
			description: roomRequest.description,
			slug: roomRequest.slug,
			requesterId: roomRequest.requesterId,
			preferredDistrictId: roomRequest.preferredDistrictId,
			preferredWardId: roomRequest.preferredWardId,
			preferredProvinceId: roomRequest.preferredProvinceId,
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
			preferredProvince: roomRequest.preferredProvince,
			preferredDistrict: roomRequest.preferredDistrict,
			preferredWard: roomRequest.preferredWard,
		};
	}
}
