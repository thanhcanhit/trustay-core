import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { BookingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalsService } from '../rentals/rentals.service';
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
		private readonly rentalsService: RentalsService,
	) {}

	async createBookingRequest(tenantId: string, dto: CreateBookingRequestDto) {
		// Validate tenant role
		const tenant = await this.prisma.user.findUnique({
			where: { id: tenantId },
		});

		if (!tenant || tenant.role !== UserRole.tenant) {
			throw new ForbiddenException('Only tenants can create booking requests');
		}

		// Validate room exists and is available
		const room = await this.prisma.room.findUnique({
			where: { id: dto.roomId },
			include: {
				building: {
					include: {
						owner: true,
					},
				},
				roomInstances: {
					where: { status: 'available' },
					take: 1,
				},
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		if (!room.isActive) {
			throw new BadRequestException('Room is not active');
		}

		if (room.roomInstances.length === 0) {
			throw new BadRequestException('No available room instances for booking');
		}

		// Check for existing pending/approved booking from same tenant
		const existingBooking = await this.prisma.bookingRequest.findFirst({
			where: {
				tenantId,
				roomId: dto.roomId,
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
				roomId: dto.roomId,
				moveInDate: moveInDate,
				moveOutDate: dto.moveOutDate ? new Date(dto.moveOutDate) : null,
				messageToOwner: dto.messageToOwner,
				status: BookingStatus.pending,
				monthlyRent: 0, // Will be set from room pricing
				depositAmount: 0, // Will be calculated
				totalAmount: 0, // Will be calculated
				isConfirmedByTenant: false, // Cần xác nhận trước khi gửi đến landlord
			},
			include: {
				tenant: true,
				room: {
					include: {
						building: true,
					},
				},
			},
		});

		return bookingRequest;
	}

	async getBookingRequestsForLandlord(landlordId: string, query: QueryBookingRequestsDto) {
		const { page = 1, limit = 20, status, buildingId, roomId } = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where = {
			room: {
				building: {
					ownerId: landlordId,
					...(buildingId && { id: buildingId }),
				},
				...(roomId && { id: roomId }),
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

	async getMyBookingRequestsAsTenant(tenantId: string, query: QueryBookingRequestsDto) {
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

		if (!bookingRequest) {
			throw new NotFoundException('Booking request not found');
		}

		// Verify landlord ownership
		if (bookingRequest.room.building.ownerId !== landlordId) {
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

		// Send notifications based on status change
		if (dto.status === BookingStatus.approved) {
			await this.notificationsService.notifyBookingApproved(bookingRequest.tenantId, {
				roomName: updatedBooking.room.name,
				landlordName: `${updatedBooking.room.building.owner?.firstName} ${updatedBooking.room.building.owner?.lastName}`,
				bookingId: bookingRequest.id,
			});

			// Auto-create rental when booking is approved
			try {
				// pick an available room instance for the room
				const availableInstance = await this.prisma.roomInstance.findFirst({
					where: { roomId: bookingRequest.roomId, status: 'available' },
					orderBy: { createdAt: 'asc' },
				});

				if (!availableInstance) {
					throw new Error('No available room instances to create rental');
				}

				await this.rentalsService.createRental(updatedBooking.room.building.ownerId, {
					bookingRequestId: bookingRequest.id,
					roomInstanceId: availableInstance.id,
					tenantId: bookingRequest.tenantId,
					contractStartDate: updatedBooking.moveInDate.toISOString(),
					contractEndDate: updatedBooking.rentalMonths
						? new Date(
								updatedBooking.moveInDate.getTime() +
									updatedBooking.rentalMonths * 30 * 24 * 60 * 60 * 1000,
							).toISOString()
						: undefined,
					monthlyRent: updatedBooking.monthlyRent.toString(),
					depositPaid: updatedBooking.depositAmount.toString(),
				});
			} catch (error) {
				// Log error but don't fail the booking approval
				console.error('Failed to auto-create rental:', error);
			}
		} else if (dto.status === BookingStatus.rejected) {
			await this.notificationsService.notifyBookingRejected(bookingRequest.tenantId, {
				roomName: updatedBooking.room.name,
				reason: dto.ownerNotes,
				bookingId: bookingRequest.id,
			});
		}

		return updatedBooking;
	}

	async confirmBookingRequest(bookingRequestId: string, tenantId: string) {
		const bookingRequest = await this.prisma.bookingRequest.findUnique({
			where: { id: bookingRequestId },
			include: {
				tenant: true,
				room: {
					include: {
						building: {
							include: {
								owner: true,
							},
						},
						roomInstances: {
							where: { status: 'available' },
							take: 1,
						},
					},
				},
			},
		});

		if (!bookingRequest) {
			throw new NotFoundException('Booking request not found');
		}

		if (bookingRequest.tenantId !== tenantId) {
			throw new ForbiddenException('You can only confirm your own booking requests');
		}

		if (bookingRequest.isConfirmedByTenant) {
			throw new BadRequestException('Booking request is already confirmed');
		}

		if (bookingRequest.status !== BookingStatus.approved) {
			throw new BadRequestException(
				'Can only confirm booking requests that have been approved by landlord',
			);
		}

		// Update booking request to confirmed
		const updatedBooking = await this.prisma.bookingRequest.update({
			where: { id: bookingRequestId },
			data: {
				isConfirmedByTenant: true,
				confirmedAt: new Date(),
			},
			include: {
				tenant: true,
				room: {
					include: {
						building: true,
					},
				},
			},
		});

		// ===== TỰ ĐỘNG TẠO RENTAL AFTER FINAL CONFIRMATION =====

		// Check if room instance is still available
		if (bookingRequest.room.roomInstances.length === 0) {
			throw new BadRequestException('No available room instance for this booking');
		}

		const roomInstance = bookingRequest.room.roomInstances[0];

		// Tạo Rental tự động
		const rental = await this.prisma.rental.create({
			data: {
				bookingRequestId: bookingRequest.id,
				roomInstanceId: roomInstance.id,
				tenantId: bookingRequest.tenantId,
				ownerId: bookingRequest.room.building.ownerId,
				contractStartDate: bookingRequest.moveInDate,
				contractEndDate: bookingRequest.moveOutDate,
				monthlyRent: bookingRequest.monthlyRent,
				depositPaid: bookingRequest.depositAmount,
				status: 'active',
			},
		});

		// Gửi notification cho cả 2 bên
		await this.notificationsService.notifyRentalCreated(tenantId, {
			roomName: bookingRequest.room.name,
			rentalId: rental.id,
			startDate: bookingRequest.moveInDate.toISOString(),
		});

		await this.notificationsService.notifyRentalCreated(bookingRequest.room.building.ownerId, {
			roomName: bookingRequest.room.name,
			rentalId: rental.id,
			startDate: bookingRequest.moveInDate.toISOString(),
		});

		// Return booking với rental info
		return {
			...updatedBooking,
			rental,
		};
	}

	async cancelBookingRequest(
		bookingRequestId: string,
		tenantId: string,
		dto: CancelBookingRequestDto,
	) {
		const bookingRequest = await this.prisma.bookingRequest.findUnique({
			where: { id: bookingRequestId },
			include: {
				room: {
					include: {
						building: true,
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
		await this.notificationsService.notifyBookingCancelled(bookingRequest.room.building.ownerId, {
			roomName: bookingRequest.room.name,
			cancelledBy: 'Tenant',
			bookingId: bookingRequest.id,
		});

		return updatedBooking;
	}

	async getMyBookingRequests(userId: string, query: QueryBookingRequestsDto) {
		// Get user role to determine which booking requests to show
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// If user is landlord, show booking requests for their properties
		if (user.role === UserRole.landlord) {
			return this.getBookingRequestsForLandlord(userId, query);
		}
		// If user is tenant, show their own booking requests
		else if (user.role === UserRole.tenant) {
			return this.getMyBookingRequestsAsTenant(userId, query);
		}

		throw new ForbiddenException('Invalid user role');
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
		});

		if (!bookingRequest) {
			throw new NotFoundException('Booking request not found');
		}

		// Check access rights
		const isOwner = bookingRequest.room.building.ownerId === userId;
		const isTenant = bookingRequest.tenantId === userId;

		if (!isOwner && !isTenant) {
			throw new ForbiddenException('Access denied');
		}

		return bookingRequest;
	}
}
