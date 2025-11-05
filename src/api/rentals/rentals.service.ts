import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { RentalStatus, RequestStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsNewService } from '../contracts/contracts-new.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRentalDto, QueryRentalDto, TerminateRentalDto, UpdateRentalDto } from './dto';

@Injectable()
export class RentalsService {
	private readonly logger = new Logger(RentalsService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
		private readonly contractsService: ContractsNewService,
	) {}

	private transformToResponseDto(rental: any): any {
		return {
			...rental,
			monthlyRent: rental.monthlyRent ? rental.monthlyRent.toString() : '0',
			depositPaid: rental.depositPaid ? rental.depositPaid.toString() : '0',
		};
	}

	async createRental(ownerId: string, dto: CreateRentalDto) {
		// Validate owner role
		const owner = await this.prisma.user.findUnique({
			where: { id: ownerId },
		});

		if (!owner || owner.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can create rentals');
		}

		// Validate tenant
		const tenant = await this.prisma.user.findUnique({
			where: { id: dto.tenantId },
		});

		if (!tenant || tenant.role !== UserRole.tenant) {
			throw new BadRequestException('Invalid tenant ID or tenant not found');
		}

		// Validate room instance and ownership
		const roomInstance = await this.prisma.roomInstance.findUnique({
			where: { id: dto.roomInstanceId },
			include: {
				room: {
					include: {
						building: true,
					},
				},
			},
		});

		if (!roomInstance) {
			throw new NotFoundException('Room instance not found');
		}

		if (roomInstance.room.building.ownerId !== ownerId) {
			throw new ForbiddenException('You can only create rentals for your own properties');
		}

		// Check for existing active rental for the same room instance
		const existingRental = await this.prisma.rental.findFirst({
			where: {
				roomInstanceId: dto.roomInstanceId,
				status: { in: ['active', 'pending_renewal'] },
			},
		});

		if (existingRental) {
			throw new BadRequestException('Room instance already has an active rental');
		}

		// Validate dates
		const contractStartDate = new Date(dto.contractStartDate);
		if (contractStartDate < new Date()) {
			throw new BadRequestException('Contract start date cannot be in the past');
		}

		let contractEndDate = null;
		if (dto.contractEndDate) {
			contractEndDate = new Date(dto.contractEndDate);
			if (contractEndDate <= contractStartDate) {
				throw new BadRequestException('Contract end date must be after start date');
			}
		}

		// If creating from booking request or invitation, validate and update status
		let bookingRequest = null;
		let invitation = null;

		if (dto.bookingRequestId) {
			bookingRequest = await this.prisma.roomBooking.findUnique({
				where: { id: dto.bookingRequestId },
			});

			if (!bookingRequest) {
				throw new NotFoundException('Room booking not found');
			}

			if (bookingRequest.status !== RequestStatus.accepted) {
				throw new BadRequestException('Can only create rental from accepted room booking');
			}

			if (bookingRequest.tenantId !== dto.tenantId) {
				throw new BadRequestException('Room booking tenant does not match rental tenant');
			}
		}

		if (dto.invitationId) {
			invitation = await this.prisma.roomInvitation.findUnique({
				where: { id: dto.invitationId },
			});

			if (!invitation) {
				throw new NotFoundException('Room invitation not found');
			}

			if (invitation.status !== RequestStatus.accepted) {
				throw new BadRequestException('Can only create rental from accepted invitation');
			}

			if (
				invitation.recipientId !== dto.tenantId ||
				invitation.roomInstanceId !== dto.roomInstanceId
			) {
				throw new BadRequestException('Invitation data does not match rental data');
			}
		}

		// Create rental
		const rental = await this.prisma.rental.create({
			data: {
				roomBookingId: dto.bookingRequestId,
				invitationId: dto.invitationId,
				roomInstanceId: dto.roomInstanceId,
				tenantId: dto.tenantId,
				ownerId: ownerId,
				contractStartDate: contractStartDate,
				contractEndDate: contractEndDate,
				monthlyRent: parseFloat(dto.monthlyRent),
				depositPaid: parseFloat(dto.depositPaid),
				contractDocumentUrl: dto.contractDocumentUrl,
				status: RentalStatus.active,
			},
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				roomBooking: true,
				invitation: true,
			},
		});

		// Update room instance status to occupied
		await this.prisma.roomInstance.update({
			where: { id: dto.roomInstanceId },
			data: { status: 'occupied' },
		});

		// Send notifications
		await this.notificationsService.notifyRentalCreated(dto.tenantId, {
			roomName: `${roomInstance.room.name} - ${roomInstance.roomNumber}`,
			startDate: contractStartDate.toISOString(),
			rentalId: rental.id,
		});

		await this.notificationsService.notifyRentalCreated(ownerId, {
			roomName: `${roomInstance.room.name} - ${roomInstance.roomNumber}`,
			startDate: contractStartDate.toISOString(),
			rentalId: rental.id,
		});

		// Auto-create contract when rental is created (new contracts flow)
		try {
			const contract = await this.contractsService.createContractFromRental(rental.id, ownerId);
			this.logger.log(
				`Contract ${contract.contractCode} created successfully for rental ${rental.id}`,
			);
		} catch (error) {
			// Log error but don't fail the rental creation
			this.logger.error(`Failed to create contract for rental ${rental.id}:`, error.message);
			// TODO: Consider adding to a retry queue or notification system
		}

		return this.transformToResponseDto(rental);
	}

	async getRentalsForOwner(ownerId: string, query: QueryRentalDto) {
		const { page = 1, limit = 20, status, buildingId, roomId, tenantId } = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = {
			ownerId,
			...(status && { status }),
			...(tenantId && { tenantId }),
		};

		if (buildingId || roomId) {
			where.roomInstance = {
				room: {
					...(roomId && { id: roomId }),
					building: {
						ownerId: ownerId,
						...(buildingId && { id: buildingId }),
					},
				},
			};
		}

		// Get all rentals first to group by room instance
		const allRentals = await this.prisma.rental.findMany({
			where,
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
				roomBooking: {
					select: {
						id: true,
						moveInDate: true,
						moveOutDate: true,
					},
				},
				invitation: {
					select: {
						id: true,
						moveInDate: true,
						message: true,
					},
				},
			},
		});

		// Group rentals by roomInstanceId, keep only the first rental per room instance
		const rentalsByRoomInstance = new Map<string, (typeof allRentals)[0]>();
		for (const rental of allRentals) {
			if (!rentalsByRoomInstance.has(rental.roomInstanceId)) {
				rentalsByRoomInstance.set(rental.roomInstanceId, rental);
			}
		}

		// Get paginated unique room instances
		const uniqueRentals = Array.from(rentalsByRoomInstance.values());
		const total = uniqueRentals.length;
		const paginatedRentals = uniqueRentals.slice(skip, skip + limit);

		// Get all room instance IDs for members lookup
		const roomInstanceIds = paginatedRentals.map((rental) => rental.roomInstanceId);

		// Fetch all active rentals for these room instances to get members
		let allRentalsForRooms: Array<{
			id: string;
			tenantId: string;
			roomInstanceId: string;
			tenant: {
				id: string;
				firstName: string | null;
				lastName: string | null;
				email: string;
				phone: string | null;
				avatarUrl: string | null;
			};
		}> = [];

		if (roomInstanceIds.length > 0) {
			allRentalsForRooms = await this.prisma.rental.findMany({
				where: {
					roomInstanceId: { in: roomInstanceIds },
					ownerId: ownerId,
					status: { in: [RentalStatus.active, RentalStatus.pending_renewal] },
				},
				include: {
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							avatarUrl: true,
						},
					},
				},
			});
		}

		// Group rentals by roomInstanceId for members
		const rentalsByRoomInstanceForMembers = allRentalsForRooms.reduce(
			(acc, rental) => {
				if (!acc[rental.roomInstanceId]) {
					acc[rental.roomInstanceId] = [];
				}
				acc[rental.roomInstanceId].push(rental);
				return acc;
			},
			{} as Record<
				string,
				Array<{
					id: string;
					tenantId: string;
					roomInstanceId: string;
					tenant: {
						id: string;
						firstName: string | null;
						lastName: string | null;
						email: string;
						phone: string | null;
						avatarUrl: string | null;
					};
				}>
			>,
		);

		// Transform rentals with members
		const transformedRentals = paginatedRentals.map((rental) => {
			const transformed = this.transformToResponseDto(rental);
			const roomMembers = rentalsByRoomInstanceForMembers[rental.roomInstanceId] || [];
			transformed.members = roomMembers
				.filter((memberRental) => memberRental.id !== rental.id)
				.map((memberRental) => ({
					tenantId: memberRental.tenantId,
					firstName: memberRental.tenant.firstName || undefined,
					lastName: memberRental.tenant.lastName || undefined,
					email: memberRental.tenant.email || undefined,
					phone: memberRental.tenant.phone || undefined,
					avatarUrl: memberRental.tenant.avatarUrl || undefined,
					rentalId: memberRental.id,
				}));
			return transformed;
		});

		return {
			data: transformedRentals,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getMyRentals(tenantId: string, query: QueryRentalDto) {
		const { page = 1, limit = 20, status } = query;
		const skip = (page - 1) * limit;

		const where = {
			tenantId,
			...(status && { status }),
		};

		// Get all rentals first to group by room instance
		const allRentals = await this.prisma.rental.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			include: {
				owner: {
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
				roomBooking: {
					select: {
						id: true,
						moveInDate: true,
						moveOutDate: true,
					},
				},
				invitation: {
					select: {
						id: true,
						moveInDate: true,
						message: true,
					},
				},
			},
		});

		// Group rentals by roomInstanceId, keep only the first rental per room instance
		const rentalsByRoomInstance = new Map<string, (typeof allRentals)[0]>();
		for (const rental of allRentals) {
			if (!rentalsByRoomInstance.has(rental.roomInstanceId)) {
				rentalsByRoomInstance.set(rental.roomInstanceId, rental);
			}
		}

		// Get paginated unique room instances
		const uniqueRentals = Array.from(rentalsByRoomInstance.values());
		const total = uniqueRentals.length;
		const paginatedRentals = uniqueRentals.slice(skip, skip + limit);

		// Get all room instance IDs for members lookup
		const roomInstanceIds = paginatedRentals.map((rental) => rental.roomInstanceId);

		// Fetch all active rentals for these room instances to get members
		let allRentalsForRooms: Array<{
			id: string;
			tenantId: string;
			roomInstanceId: string;
			tenant: {
				id: string;
				firstName: string | null;
				lastName: string | null;
				email: string;
				phone: string | null;
				avatarUrl: string | null;
			};
		}> = [];

		if (roomInstanceIds.length > 0) {
			allRentalsForRooms = await this.prisma.rental.findMany({
				where: {
					roomInstanceId: { in: roomInstanceIds },
					status: { in: [RentalStatus.active, RentalStatus.pending_renewal] },
				},
				include: {
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							avatarUrl: true,
						},
					},
				},
			});
		}

		// Group rentals by roomInstanceId for members
		const rentalsByRoomInstanceForMembers = allRentalsForRooms.reduce(
			(acc, rental) => {
				if (!acc[rental.roomInstanceId]) {
					acc[rental.roomInstanceId] = [];
				}
				acc[rental.roomInstanceId].push(rental);
				return acc;
			},
			{} as Record<
				string,
				Array<{
					id: string;
					tenantId: string;
					roomInstanceId: string;
					tenant: {
						id: string;
						firstName: string | null;
						lastName: string | null;
						email: string;
						phone: string | null;
						avatarUrl: string | null;
					};
				}>
			>,
		);

		// Transform rentals with members (exclude current user from members)
		const transformedRentals = paginatedRentals.map((rental) => {
			const transformed = this.transformToResponseDto(rental);
			const roomMembers = rentalsByRoomInstanceForMembers[rental.roomInstanceId] || [];
			transformed.members = roomMembers
				.filter((memberRental) => memberRental.tenantId !== tenantId)
				.map((memberRental) => ({
					tenantId: memberRental.tenantId,
					firstName: memberRental.tenant.firstName || undefined,
					lastName: memberRental.tenant.lastName || undefined,
					email: memberRental.tenant.email || undefined,
					phone: memberRental.tenant.phone || undefined,
					avatarUrl: memberRental.tenant.avatarUrl || undefined,
					rentalId: memberRental.id,
				}));
			return transformed;
		});

		return {
			data: transformedRentals,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getRentalById(rentalId: string, userId: string) {
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
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
				owner: {
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
				roomBooking: {
					select: {
						id: true,
						moveInDate: true,
						moveOutDate: true,
					},
				},
				invitation: {
					select: {
						id: true,
						moveInDate: true,
						message: true,
					},
				},
			},
		});

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		// Check access rights
		const isOwner = rental.ownerId === userId;
		const isTenant = rental.tenantId === userId;

		if (!isOwner && !isTenant) {
			throw new ForbiddenException('Access denied');
		}

		// Fetch all active rentals for the same room instance to get members
		const allRentalsForRoom = await this.prisma.rental.findMany({
			where: {
				roomInstanceId: rental.roomInstanceId,
				status: { in: [RentalStatus.active, RentalStatus.pending_renewal] },
			},
			include: {
				tenant: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						avatarUrl: true,
					},
				},
			},
		});

		// Transform rental with members (exclude current rental from members)
		const transformed = this.transformToResponseDto(rental);
		transformed.members = allRentalsForRoom
			.filter((memberRental) => memberRental.id !== rental.id)
			.map((memberRental) => ({
				tenantId: memberRental.tenantId,
				firstName: memberRental.tenant.firstName || undefined,
				lastName: memberRental.tenant.lastName || undefined,
				email: memberRental.tenant.email || undefined,
				phone: memberRental.tenant.phone || undefined,
				avatarUrl: memberRental.tenant.avatarUrl || undefined,
				rentalId: memberRental.id,
			}));

		return transformed;
	}

	async updateRental(rentalId: string, ownerId: string, dto: UpdateRentalDto) {
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
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

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		if (rental.ownerId !== ownerId) {
			throw new ForbiddenException('You can only update your own rentals');
		}

		// Validate contract end date
		let contractEndDate = null;
		if (dto.contractEndDate) {
			contractEndDate = new Date(dto.contractEndDate);
			if (contractEndDate <= rental.contractStartDate) {
				throw new BadRequestException('Contract end date must be after start date');
			}
		}

		const updatedRental = await this.prisma.rental.update({
			where: { id: rentalId },
			data: {
				contractEndDate,
				status: dto.status,
				contractDocumentUrl: dto.contractDocumentUrl,
			},
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				roomBooking: true,
				invitation: true,
			},
		});

		// Send notification if status changed
		if (dto.status && dto.status !== rental.status) {
			await this.notificationsService.notifyRentalStatusUpdated(rental.tenantId, {
				roomName: `${rental.roomInstance.room.name} - ${rental.roomInstance.roomNumber}`,
				newStatus: dto.status,
				rentalId: rental.id,
			});
		}

		return this.transformToResponseDto(updatedRental);
	}

	async terminateRental(rentalId: string, ownerId: string, dto: TerminateRentalDto) {
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
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

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		if (rental.ownerId !== ownerId) {
			throw new ForbiddenException('You can only terminate your own rentals');
		}

		if (rental.status === RentalStatus.terminated) {
			throw new BadRequestException('Rental is already terminated');
		}

		const updatedRental = await this.prisma.rental.update({
			where: { id: rentalId },
			data: {
				status: RentalStatus.terminated,
				terminationNoticeDate: new Date(dto.terminationNoticeDate),
				terminationReason: dto.terminationReason,
			},
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				roomBooking: true,
				invitation: true,
			},
		});

		// Update room instance status back to available
		await this.prisma.roomInstance.update({
			where: { id: rental.roomInstanceId },
			data: { status: 'available' },
		});

		// Send notification to tenant
		await this.notificationsService.notifyRentalTerminated(rental.tenantId, {
			roomName: `${rental.roomInstance.room.name} - ${rental.roomInstance.roomNumber}`,
			reason: dto.terminationReason,
			rentalId: rental.id,
		});

		return this.transformToResponseDto(updatedRental);
	}

	async renewRental(rentalId: string, tenantId: string, newEndDate: string) {
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: {
				owner: true,
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

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		if (rental.tenantId !== tenantId) {
			throw new ForbiddenException('You can only renew your own rentals');
		}

		if (rental.status !== RentalStatus.active) {
			throw new BadRequestException('Can only renew active rentals');
		}

		const contractEndDate = new Date(newEndDate);
		const currentDate = new Date();

		if (contractEndDate <= currentDate) {
			throw new BadRequestException('New end date must be in the future');
		}

		if (rental.contractEndDate && contractEndDate <= rental.contractEndDate) {
			throw new BadRequestException('New end date must be after current end date');
		}

		const updatedRental = await this.prisma.rental.update({
			where: { id: rentalId },
			data: {
				contractEndDate,
				status: RentalStatus.pending_renewal,
			},
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				roomBooking: true,
				invitation: true,
			},
		});

		// Send notification to owner
		await this.notificationsService.notifyRentalStatusUpdated(rental.ownerId, {
			roomName: `${rental.roomInstance.room.name} - ${rental.roomInstance.roomNumber}`,
			newStatus: RentalStatus.pending_renewal,
			rentalId: rental.id,
		});

		return this.transformToResponseDto(updatedRental);
	}

	/**
	 * Đếm số người ở trong một room instance (số active rentals)
	 * @param roomInstanceId - ID của room instance
	 * @returns Số lượng active rentals (số người ở)
	 */
	async getOccupancyCountByRoomInstance(roomInstanceId: string): Promise<number> {
		const activeRentalsCount = await this.prisma.rental.count({
			where: {
				roomInstanceId: roomInstanceId,
				status: { in: [RentalStatus.active, RentalStatus.pending_renewal] },
			},
		});
		return activeRentalsCount;
	}

	/**
	 * Tạo contract cho rental nếu chưa có
	 * Hữu ích cho việc migrate hoặc xử lý rental cũ
	 */
	async createContractForRental(rentalId: string, userId: string) {
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: { contract: true },
		});

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		// Check quyền (phải là landlord hoặc tenant)
		if (rental.ownerId !== userId && rental.tenantId !== userId) {
			throw new ForbiddenException('You are not authorized to create contract for this rental');
		}

		// Nếu đã có contract, return error
		if (rental.contract) {
			throw new BadRequestException(
				`Rental already has a contract (${rental.contract.contractCode})`,
			);
		}

		// Check rental phải active
		if (rental.status !== 'active') {
			throw new BadRequestException(
				`Cannot create contract for rental with status: ${rental.status}`,
			);
		}

		// Tạo contract
		return this.contractsService.createContractFromRental(rentalId, userId);
	}
}
