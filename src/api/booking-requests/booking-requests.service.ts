import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { BookingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
	CancelBookingRequestDto,
	CreateBookingRequestDto,
	QueryBookingRequestsDto,
	UpdateBookingRequestDto,
} from './dto';

@Injectable()
export class BookingRequestsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
	) {}

	async createBookingRequest(tenantId: string, dto: CreateBookingRequestDto) {
		// Validate tenant role
		const tenant = await this.prisma.user.findUnique({
			where: { id: tenantId },
		});

		if (!tenant || tenant.role !== UserRole.tenant) {
			throw new ForbiddenException('Only tenants can create booking requests');
		}

		// Validate room instance exists and is available
		const roomInstance = await this.prisma.roomInstance.findUnique({
			where: { id: dto.roomInstanceId },
			include: {
				room: {
					include: {
						building: {
							include: {
								owner: true,
							},
						},
					},
				},
			},
		});

		if (!roomInstance) {
			throw new NotFoundException('Room instance not found');
		}

		if (roomInstance.status !== 'available') {
			throw new BadRequestException('Room is not available for booking');
		}

		// Check for existing pending/approved booking from same tenant
		const existingBooking = await this.prisma.bookingRequest.findFirst({
			where: {
				tenantId,
				roomInstanceId: dto.roomInstanceId,
				status: { in: ['pending', 'approved'] },
			},
		});

		if (existingBooking) {
			throw new BadRequestException('You already have a pending/approved booking for this room');
		}

		// Validate dates
		const moveInDate = new Date(dto.moveInDate);
		if (moveInDate < new Date()) {
			throw new BadRequestException('Move-in date cannot be in the past');
		}

		if (dto.moveOutDate) {
			const moveOutDate = new Date(dto.moveOutDate);
			if (moveOutDate <= moveInDate) {
				throw new BadRequestException('Move-out date must be after move-in date');
			}
		}

		// Create booking request
		const bookingRequest = await this.prisma.bookingRequest.create({
			data: {
				tenantId,
				roomInstanceId: dto.roomInstanceId,
				moveInDate: moveInDate,
				moveOutDate: dto.moveOutDate ? new Date(dto.moveOutDate) : null,
				messageToOwner: dto.messageToOwner,
				status: BookingStatus.pending,
				monthlyRent: 0, // Will be set from room pricing
				depositAmount: 0, // Will be calculated
				totalAmount: 0, // Will be calculated
			},
			include: {
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		// Send notification to landlord
		await this.notificationsService.notifyBookingRequest(roomInstance.room.building.ownerId, {
			roomName: `${roomInstance.room.name} - ${roomInstance.roomNumber}`,
			tenantName: `${tenant.firstName} ${tenant.lastName}`,
			bookingId: bookingRequest.id,
			roomId: roomInstance.room.id,
		});

		return bookingRequest;
	}

	async getBookingRequestsForLandlord(landlordId: string, query: QueryBookingRequestsDto) {
		const { page = 1, limit = 20, status, buildingId, roomId } = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where = {
			roomInstance: {
				room: {
					building: {
						ownerId: landlordId,
						...(buildingId && { id: buildingId }),
					},
					...(roomId && { id: roomId }),
				},
			},
			...(status && { status }),
		};

		const [bookingRequests, total] = await Promise.all([
			this.prisma.bookingRequest.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
				include: {
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
						},
					},
					roomInstance: {
						include: {
							room: {
								include: {
									building: {
										select: {
											id: true,
											name: true,
										},
									},
								},
							},
						},
					},
				},
			}),
			this.prisma.bookingRequest.count({ where }),
		]);

		return {
			data: bookingRequests,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getMyBookingRequests(tenantId: string, query: QueryBookingRequestsDto) {
		const { page = 1, limit = 20, status } = query;
		const skip = (page - 1) * limit;

		const where = {
			tenantId,
			...(status && { status }),
		};

		const [bookingRequests, total] = await Promise.all([
			this.prisma.bookingRequest.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
				include: {
					roomInstance: {
						include: {
							room: {
								include: {
									building: {
										select: {
											id: true,
											name: true,
										},
									},
								},
							},
						},
					},
				},
			}),
			this.prisma.bookingRequest.count({ where }),
		]);

		return {
			data: bookingRequests,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async updateBookingRequest(
		bookingRequestId: string,
		landlordId: string,
		dto: UpdateBookingRequestDto,
	) {
		const bookingRequest = await this.prisma.bookingRequest.findUnique({
			where: { id: bookingRequestId },
			include: {
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									include: {
										owner: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!bookingRequest) {
			throw new NotFoundException('Booking request not found');
		}

		// Verify landlord ownership
		if (bookingRequest.roomInstance.room.building.ownerId !== landlordId) {
			throw new ForbiddenException('You can only update booking requests for your properties');
		}

		// Status transition validation
		if (dto.status && bookingRequest.status !== BookingStatus.pending) {
			throw new BadRequestException('Can only approve/reject pending booking requests');
		}

		const updatedBooking = await this.prisma.bookingRequest.update({
			where: { id: bookingRequestId },
			data: {
				ownerNotes: dto.ownerNotes,
				status: dto.status,
			},
			include: {
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									include: {
										owner: true,
									},
								},
							},
						},
					},
				},
			},
		});

		// Send notifications based on status change
		if (dto.status === BookingStatus.approved) {
			await this.notificationsService.notifyBookingApproved(bookingRequest.tenantId, {
				roomName: `${updatedBooking.roomInstance.room.name} - ${updatedBooking.roomInstance.roomNumber}`,
				landlordName: `${updatedBooking.roomInstance.room.building.owner?.firstName} ${updatedBooking.roomInstance.room.building.owner?.lastName}`,
				bookingId: bookingRequest.id,
			});

			// TODO: Auto-create rental contract in Phase 2
		} else if (dto.status === BookingStatus.rejected) {
			await this.notificationsService.notifyBookingRejected(bookingRequest.tenantId, {
				roomName: `${updatedBooking.roomInstance.room.name} - ${updatedBooking.roomInstance.roomNumber}`,
				reason: dto.ownerNotes,
				bookingId: bookingRequest.id,
			});
		}

		return updatedBooking;
	}

	async cancelBookingRequest(
		bookingRequestId: string,
		tenantId: string,
		dto: CancelBookingRequestDto,
	) {
		const bookingRequest = await this.prisma.bookingRequest.findUnique({
			where: { id: bookingRequestId },
			include: {
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		if (!bookingRequest) {
			throw new NotFoundException('Booking request not found');
		}

		if (bookingRequest.tenantId !== tenantId) {
			throw new ForbiddenException('You can only cancel your own booking requests');
		}

		if (bookingRequest.status === BookingStatus.cancelled) {
			throw new BadRequestException('Booking request is already cancelled');
		}

		const updatedBooking = await this.prisma.bookingRequest.update({
			where: { id: bookingRequestId },
			data: {
				status: BookingStatus.cancelled,
				ownerNotes: dto.cancellationReason
					? `Cancelled by tenant: ${dto.cancellationReason}`
					: 'Cancelled by tenant',
			},
		});

		// Notify landlord
		await this.notificationsService.notifyBookingCancelled(
			bookingRequest.roomInstance.room.building.ownerId,
			{
				roomName: `${bookingRequest.roomInstance.room.name} - ${bookingRequest.roomInstance.roomNumber}`,
				cancelledBy: 'Tenant',
				bookingId: bookingRequest.id,
			},
		);

		return updatedBooking;
	}

	async getBookingRequestById(bookingRequestId: string, userId: string) {
		const bookingRequest = await this.prisma.bookingRequest.findUnique({
			where: { id: bookingRequestId },
			include: {
				tenant: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
					},
				},
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									select: {
										id: true,
										name: true,
										ownerId: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!bookingRequest) {
			throw new NotFoundException('Booking request not found');
		}

		// Check access rights
		const isOwner = bookingRequest.roomInstance.room.building.ownerId === userId;
		const isTenant = bookingRequest.tenantId === userId;

		if (!isOwner && !isTenant) {
			throw new ForbiddenException('Access denied');
		}

		return bookingRequest;
	}
}
