import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { RequestStatus, UserRole } from '@prisma/client';
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
		const existingBooking = await this.prisma.roomBooking.findFirst({
			where: {
				tenantId,
				roomId: dto.roomId,
				status: { in: [RequestStatus.pending, RequestStatus.accepted] },
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
		const roomBooking = await this.prisma.roomBooking.create({
			data: {
				tenantId,
				roomId: dto.roomId,
				moveInDate: moveInDate,
				moveOutDate: dto.moveOutDate ? new Date(dto.moveOutDate) : null,
				messageToOwner: dto.messageToOwner,
				status: RequestStatus.pending,
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

		return roomBooking;
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

		const [roomBookings, total, pendingCount, approvedCount, rejectedCount, cancelledCount] =
			await Promise.all([
				this.prisma.roomBooking.findMany({
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
				this.prisma.roomBooking.count({ where }),
				this.prisma.roomBooking.count({
					where: {
						...where,
						status: RequestStatus.pending,
					},
				}),
				this.prisma.roomBooking.count({
					where: {
						...where,
						status: RequestStatus.accepted,
					},
				}),
				this.prisma.roomBooking.count({
					where: {
						...where,
						status: RequestStatus.rejected,
					},
				}),
				this.prisma.roomBooking.count({
					where: {
						...where,
						status: RequestStatus.cancelled,
					},
				}),
			]);

		return {
			data: roomBookings,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
			counts: {
				pending: pendingCount,
				approved: approvedCount,
				rejected: rejectedCount,
				cancelled: cancelledCount,
				total,
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

		const [roomBookings, total] = await Promise.all([
			this.prisma.roomBooking.findMany({
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
			this.prisma.roomBooking.count({ where }),
		]);

		return {
			data: roomBookings,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async updateBookingRequest(
		roomBookingId: string,
		landlordId: string,
		dto: UpdateBookingRequestDto,
	) {
		const roomBooking = await this.prisma.roomBooking.findUnique({
			where: { id: roomBookingId },
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

		if (!roomBooking) {
			throw new NotFoundException('Booking request not found');
		}

		// Verify landlord ownership
		if (roomBooking.room.building.ownerId !== landlordId) {
			throw new ForbiddenException('You can only update booking requests for your properties');
		}

		// Status transition validation
		if (dto.status && roomBooking.status !== RequestStatus.pending) {
			throw new BadRequestException('Can only approve/reject pending booking requests');
		}

		const updatedBooking = await this.prisma.roomBooking.update({
			where: { id: roomBookingId },
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
		if (dto.status === RequestStatus.accepted) {
			await this.notificationsService.notifyBookingApproved(roomBooking.tenantId, {
				roomName: updatedBooking.room.name,
				landlordName: `${updatedBooking.room.building.owner?.firstName} ${updatedBooking.room.building.owner?.lastName}`,
				bookingId: roomBooking.id,
			});
		} else if (dto.status === RequestStatus.rejected) {
			await this.notificationsService.notifyBookingRejected(roomBooking.tenantId, {
				roomName: updatedBooking.room.name,
				reason: dto.ownerNotes,
				bookingId: roomBooking.id,
			});
		}

		return updatedBooking;
	}

	async confirmBookingRequest(roomBookingId: string, tenantId: string) {
		const roomBooking = await this.prisma.roomBooking.findUnique({
			where: { id: roomBookingId },
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
						pricing: true,
					},
				},
			},
		});

		if (!roomBooking) {
			throw new NotFoundException('Booking request not found');
		}

		if (roomBooking.tenantId !== tenantId) {
			throw new ForbiddenException('You can only confirm your own booking requests');
		}

		if (roomBooking.isConfirmedByTenant) {
			throw new BadRequestException('Booking request is already confirmed');
		}

		if (roomBooking.status !== RequestStatus.accepted) {
			throw new BadRequestException(
				'Can only confirm booking requests that have been approved by landlord',
			);
		}

		// ===== BƯỚC 1: LUÔN ĐÁNH DẤU CONFIRMED (không rollback) =====
		const updatedBooking = await this.prisma.roomBooking.update({
			where: { id: roomBookingId },
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

		// ===== BƯỚC 2: TẠO RENTAL (có thể fail nếu phòng đã hết) =====
		let rental = null;
		let rentalCreationError = null;

		try {
			// Check if room instance is still available
			if (roomBooking.room.roomInstances.length === 0) {
				throw new BadRequestException('No available room instance');
			}

			const roomInstance = roomBooking.room.roomInstances[0];

			// Kiểm tra room instance status phải là available
			if (roomInstance.status !== 'available') {
				throw new BadRequestException(
					`Room ${roomInstance.roomNumber} is no longer available (status: ${roomInstance.status})`,
				);
			}

			// Kiểm tra không có active rental nào cho roomInstance này
			const existingRoomRental = await this.prisma.rental.findFirst({
				where: {
					roomInstanceId: roomInstance.id,
					status: 'active',
				},
			});

			if (existingRoomRental) {
				throw new BadRequestException(
					`Room ${roomInstance.roomNumber} has been rented by someone else`,
				);
			}

			// Kiểm tra tenant chưa có active rental nào khác (1 người chỉ ở 1 rental tại 1 thời điểm)
			const existingTenantRental = await this.prisma.rental.findFirst({
				where: {
					tenantId: roomBooking.tenantId,
					status: 'active',
				},
				include: {
					roomInstance: {
						include: {
							room: true,
						},
					},
				},
			});

			if (existingTenantRental) {
				throw new BadRequestException(
					`Tenant already has an active rental at ${existingTenantRental.roomInstance.room.name} - ${existingTenantRental.roomInstance.roomNumber}`,
				);
			}

			// Determine pricing with fallback chain: roomBooking → room pricing → 0
			let monthlyRent = roomBooking.monthlyRent;
			let depositAmount = roomBooking.depositAmount;

			// If booking request has 0 values, try to get from room pricing
			if (roomBooking.monthlyRent.toNumber() === 0 && roomBooking.room.pricing) {
				monthlyRent = roomBooking.room.pricing.basePriceMonthly;
			}

			if (roomBooking.depositAmount.toNumber() === 0 && roomBooking.room.pricing) {
				depositAmount = roomBooking.room.pricing.depositAmount;
			}

			// Tạo Rental và update RoomInstance status trong transaction
			rental = await this.prisma.$transaction(async (tx) => {
				// Create rental - ACCEPT giá trị 0
				const newRental = await tx.rental.create({
					data: {
						roomBookingId: roomBooking.id,
						roomInstanceId: roomInstance.id,
						tenantId: roomBooking.tenantId,
						ownerId: roomBooking.room.building.ownerId,
						contractStartDate: roomBooking.moveInDate,
						contractEndDate: roomBooking.moveOutDate,
						monthlyRent: monthlyRent,
						depositPaid: depositAmount,
						status: 'active',
					},
				});

				// Update room instance status to occupied
				await tx.roomInstance.update({
					where: { id: roomInstance.id },
					data: { status: 'occupied' },
				});

				return newRental;
			});
		} catch (error) {
			rentalCreationError = error.message || 'Failed to create rental';
		}

		// Gửi notification cho landlord về việc tenant confirm
		await this.notificationsService.notifyBookingConfirmed(roomBooking.room.building.ownerId, {
			roomName: roomBooking.room.name,
			tenantName: `${roomBooking.tenant.firstName} ${roomBooking.tenant.lastName}`,
			bookingId: roomBooking.id,
		});

		if (rental) {
			// SUCCESS: Gửi notification cho cả 2 bên về rental được tạo
			await this.notificationsService.notifyRentalCreated(tenantId, {
				roomName: roomBooking.room.name,
				rentalId: rental.id,
				startDate: roomBooking.moveInDate.toISOString(),
			});

			await this.notificationsService.notifyRentalCreated(roomBooking.room.building.ownerId, {
				roomName: roomBooking.room.name,
				rentalId: rental.id,
				startDate: roomBooking.moveInDate.toISOString(),
			});

			// Return booking với rental info
			return {
				...updatedBooking,
				rental,
			};
		} else {
			// FAILED: Thông báo cho cả 2 bên về lỗi

			// Notify tenant
			await this.notificationsService.notifyRentalCreationFailed(tenantId, {
				roomName: roomBooking.room.name,
				error: rentalCreationError,
				bookingId: roomBooking.id,
			});

			// Notify landlord
			await this.notificationsService.notifyRentalCreationFailed(
				roomBooking.room.building.ownerId,
				{
					roomName: roomBooking.room.name,
					error: rentalCreationError,
					bookingId: roomBooking.id,
				},
			);

			// Return booking without rental, with error info
			return {
				...updatedBooking,
				rental: null,
				rentalCreationError,
			};
		}
	}

	async cancelBookingRequest(
		roomBookingId: string,
		tenantId: string,
		dto: CancelBookingRequestDto,
	) {
		const roomBooking = await this.prisma.roomBooking.findUnique({
			where: { id: roomBookingId },
			include: {
				room: {
					include: {
						building: true,
					},
				},
			},
		});

		if (!roomBooking) {
			throw new NotFoundException('Booking request not found');
		}

		if (roomBooking.tenantId !== tenantId) {
			throw new ForbiddenException('You can only cancel your own booking requests');
		}

		if (roomBooking.status === RequestStatus.cancelled) {
			throw new BadRequestException('Booking request is already cancelled');
		}

		const updatedBooking = await this.prisma.roomBooking.update({
			where: { id: roomBookingId },
			data: {
				status: RequestStatus.cancelled,
				ownerNotes: dto.cancellationReason
					? `Cancelled by tenant: ${dto.cancellationReason}`
					: 'Cancelled by tenant',
			},
		});

		// Notify landlord
		await this.notificationsService.notifyBookingCancelled(roomBooking.room.building.ownerId, {
			roomName: roomBooking.room.name,
			cancelledBy: 'Tenant',
			bookingId: roomBooking.id,
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

	async getBookingRequestById(roomBookingId: string, userId: string) {
		const roomBooking = await this.prisma.roomBooking.findUnique({
			where: { id: roomBookingId },
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

		if (!roomBooking) {
			throw new NotFoundException('Booking request not found');
		}

		// Check access rights
		const isOwner = roomBooking.room.building.ownerId === userId;
		const isTenant = roomBooking.tenantId === userId;

		if (!isOwner && !isTenant) {
			throw new ForbiddenException('Access denied');
		}

		return roomBooking;
	}
}
