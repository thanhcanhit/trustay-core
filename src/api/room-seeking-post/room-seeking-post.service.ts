import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { SearchPostStatus } from '@prisma/client';
import { generateSlug, generateUniqueSlug } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomSeekingPostDto, RoomRoomSeekingPostDto, UpdateRoomSeekingPostDto } from './dto';

@Injectable()
export class RoomSeekingPostService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Converts date string to Date object with validation
	 * @param dateString - Date string in ISO format
	 * @returns Date object or undefined if input is falsy
	 */
	private convertToDate(dateString?: string): Date | undefined {
		if (!dateString) {
			return undefined;
		}

		const date = new Date(dateString);
		if (Number.isNaN(date.getTime())) {
			throw new BadRequestException(
				`Invalid date format: ${dateString}. Expected ISO-8601 format.`,
			);
		}

		return date;
	}

	/**
	 * Validates that location IDs exist in the database
	 * @param roomRequestData - Room request data containing location IDs
	 */
	private async validateLocationIds(roomRequestData: any): Promise<void> {
		const { preferredProvinceId, preferredDistrictId, preferredWardId } = roomRequestData;

		// Validate province exists
		if (preferredProvinceId) {
			const province = await this.prisma.province.findUnique({
				where: { id: preferredProvinceId },
			});
			if (!province) {
				throw new BadRequestException(`Province with ID ${preferredProvinceId} not found`);
			}
		}

		// Validate district exists and belongs to province
		if (preferredDistrictId) {
			const district = await this.prisma.district.findUnique({
				where: { id: preferredDistrictId },
				include: { province: true },
			});
			if (!district) {
				throw new BadRequestException(`District with ID ${preferredDistrictId} not found`);
			}
			if (preferredProvinceId && district.provinceId !== preferredProvinceId) {
				throw new BadRequestException(
					`District with ID ${preferredDistrictId} does not belong to province with ID ${preferredProvinceId}`,
				);
			}
		}

		// Validate ward exists and belongs to district
		if (preferredWardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: preferredWardId },
				include: { district: true },
			});
			if (!ward) {
				throw new BadRequestException(`Ward with ID ${preferredWardId} not found`);
			}
			if (preferredDistrictId && ward.districtId !== preferredDistrictId) {
				throw new BadRequestException(
					`Ward with ID ${preferredWardId} does not belong to district with ID ${preferredDistrictId}`,
				);
			}
		}
	}

	async create(
		createRoomRequestDto: CreateRoomSeekingPostDto,
		requesterId: string,
	): Promise<RoomRoomSeekingPostDto> {
		const { amenityIds, ...roomRequestData } = createRoomRequestDto;

		// Generate unique slug from title
		const baseSlug = generateSlug(roomRequestData.title);
		const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
			const existing = await this.prisma.roomSeekingPost.findUnique({
				where: { slug },
				select: { id: true },
			});
			return !!existing;
		});

		// Validate location IDs exist
		await this.validateLocationIds(roomRequestData);

		// Convert date strings to Date objects
		const processedData = {
			...roomRequestData,
			moveInDate: this.convertToDate(roomRequestData.moveInDate),
			expiresAt: this.convertToDate(roomRequestData.expiresAt),
		};

		// Tạo room request với amenities
		let roomRequest: any;
		try {
			roomRequest = await this.prisma.roomSeekingPost.create({
				data: {
					...processedData,
					slug: uniqueSlug,
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
		} catch (error) {
			// Handle Prisma foreign key constraint errors
			if (error.code === 'P2003') {
				throw new BadRequestException(
					'Invalid location data. Please check province, district, and ward IDs.',
				);
			}
			// Re-throw other errors
			throw error;
		}

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
			throw new NotFoundException('Room seeking post not found');
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
			throw new NotFoundException('Room seeking post not found');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('You do not have permission to edit this post');
		}

		const { amenityIds, ...updateData } = updateRoomRequestDto;

		// Generate new slug if title changed
		let newSlug: string | undefined;
		if (updateData.title) {
			const baseSlug = generateSlug(updateData.title);
			newSlug = await generateUniqueSlug(baseSlug, async (slug: string) => {
				const existing = await this.prisma.roomSeekingPost.findFirst({
					where: {
						slug,
						id: { not: id },
					},
					select: { id: true },
				});
				return !!existing;
			});
		}

		// Validate location IDs if they are being updated
		if (
			updateData.preferredProvinceId ||
			updateData.preferredDistrictId ||
			updateData.preferredWardId
		) {
			await this.validateLocationIds(updateData);
		}

		// Convert date strings to Date objects
		const processedUpdateData = {
			...updateData,
			moveInDate: this.convertToDate(updateData.moveInDate),
			expiresAt: this.convertToDate(updateData.expiresAt),
		};

		// Cập nhật room request
		let updatedRequest: any;
		try {
			updatedRequest = await this.prisma.roomSeekingPost.update({
				where: { id },
				data: {
					...processedUpdateData,
					...(newSlug && { slug: newSlug }),
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
		} catch (error) {
			// Handle Prisma foreign key constraint errors
			if (error.code === 'P2003') {
				throw new BadRequestException(
					'Invalid location data. Please check province, district, and ward IDs.',
				);
			}
			// Re-throw other errors
			throw error;
		}

		return this.mapToResponseDto(updatedRequest);
	}

	async remove(id: string, requesterId: string): Promise<void> {
		// Kiểm tra quyền sở hữu
		const existingRequest = await this.prisma.roomSeekingPost.findUnique({
			where: { id },
			select: { requesterId: true },
		});

		if (!existingRequest) {
			throw new NotFoundException('Room seeking post not found');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('You do not have permission to delete this post');
		}

		await this.prisma.roomSeekingPost.delete({
			where: { id },
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
			throw new NotFoundException('Room seeking post not found');
		}

		if (existingRequest.requesterId !== requesterId) {
			throw new ForbiddenException('You do not have permission to change the status of this post');
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
