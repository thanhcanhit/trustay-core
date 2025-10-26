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
import { CreateRoomInvitationDto, QueryRoomInvitationDto, UpdateRoomInvitationDto } from './dto';

@Injectable()
export class RoomInvitationsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
		private readonly rentalsService: RentalsService,
	) {}

	private transformToResponseDto(invitation: any): any {
		return {
			...invitation,
			monthlyRent: invitation.monthlyRent ? invitation.monthlyRent.toString() : '0',
			depositAmount: invitation.depositAmount ? invitation.depositAmount.toString() : '0',
		};
	}

	async createRoomInvitation(senderId: string, dto: CreateRoomInvitationDto) {
		// Validate sender role
		const sender = await this.prisma.user.findUnique({
			where: { id: senderId },
		});

		if (!sender || sender.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can create room invitations');
		}

		// Validate recipient exists and has correct role
		const recipient = await this.prisma.user.findUnique({
			where: { id: dto.tenantId },
		});

		if (!recipient || recipient.role !== UserRole.tenant) {
			throw new BadRequestException('Invalid tenant ID or tenant not found');
		}

		// Validate room exists and belongs to landlord; ensure availability
		const room = await this.prisma.room.findUnique({
			where: { id: dto.roomId },
			include: {
				building: { include: { owner: true } },
				roomInstances: true,
			},
		});

		if (!room) {
			throw new NotFoundException('Room not found');
		}

		if (room.building.ownerId !== senderId) {
			throw new ForbiddenException('You can only invite tenants to your own properties');
		}

		if (!room.roomInstances.some((ri) => ri.status === 'available')) {
			throw new BadRequestException('No available room instances for invitation');
		}

		// Check for existing pending/accepted invitation
		const existingInvitation = await this.prisma.roomInvitation.findFirst({
			where: {
				senderId,
				recipientId: dto.tenantId,
				roomId: dto.roomId,
				status: { in: [RequestStatus.pending, RequestStatus.accepted] },
			},
		});

		if (existingInvitation) {
			throw new BadRequestException(
				'You already have a pending/accepted invitation for this tenant and room',
			);
		}

		// Check for existing booking request from same tenant for same room
		const existingBooking = await this.prisma.roomBooking.findFirst({
			where: {
				tenantId: dto.tenantId,
				roomId: dto.roomId,
				status: { in: [RequestStatus.pending, RequestStatus.accepted] },
			},
		});

		if (existingBooking) {
			throw new BadRequestException(
				'This tenant already has a pending/approved booking for this room',
			);
		}

		// Validate dates
		const moveInDate = new Date(dto.availableFrom);
		if (moveInDate < new Date()) {
			throw new BadRequestException('Move-in date cannot be in the past');
		}

		let rentalMonths = null;
		if (dto.availableUntil) {
			const availableUntil = new Date(dto.availableUntil);
			if (availableUntil <= moveInDate) {
				throw new BadRequestException('Available until date must be after move-in date');
			}
			// Calculate rental months
			rentalMonths = Math.ceil(
				(availableUntil.getTime() - moveInDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
			);
		}

		// Validate optional roomSeekingPostId
		if (dto.roomSeekingPostId) {
			const post = await this.prisma.roomSeekingPost.findUnique({
				where: { id: dto.roomSeekingPostId },
				select: { id: true, requesterId: true, status: true },
			});
			if (!post) {
				throw new NotFoundException('Room seeking post not found');
			}
			if (post.requesterId !== dto.tenantId) {
				throw new ForbiddenException('Post does not belong to this tenant');
			}
			if (post.status === 'closed' || post.status === 'expired') {
				throw new BadRequestException('Room seeking post is not active');
			}
		}

		// Create room invitation
		const roomInvitation = await this.prisma.roomInvitation.create({
			data: {
				senderId,
				recipientId: dto.tenantId,
				roomId: dto.roomId,
				moveInDate: moveInDate,
				message: dto.invitationMessage,
				monthlyRent: dto.proposedRent ? parseFloat(dto.proposedRent) : 0,
				depositAmount: 0, // Will be calculated based on monthly rent
				rentalMonths,
				...(dto.roomSeekingPostId && { roomSeekingPostId: dto.roomSeekingPostId }),
				status: RequestStatus.pending,
			},
			include: {
				recipient: true,
				sender: true,
				room: { include: { building: true } },
			},
		});

		return this.transformToResponseDto(roomInvitation);
	}

	async getSentInvitations(senderId: string, query: QueryRoomInvitationDto) {
		const { page = 1, limit = 20, status, buildingId, roomId } = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = {
			senderId,
			...(status && { status }),
		};

		if (buildingId || roomId) {
			where.room = {
				...(roomId && { id: roomId }),
				building: {
					ownerId: senderId,
					...(buildingId && { id: buildingId }),
				},
			};
		}

		const [invitations, total, pendingCount, acceptedCount, declinedCount, withdrawnCount] =
			await Promise.all([
				this.prisma.roomInvitation.findMany({
					where,
					skip,
					take: limit,
					orderBy: { createdAt: 'desc' },
					include: {
						recipient: {
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
									select: { id: true, name: true },
								},
							},
						},
					},
				}),
				this.prisma.roomInvitation.count({ where }),
				this.prisma.roomInvitation.count({ where: { ...where, status: RequestStatus.pending } }),
				this.prisma.roomInvitation.count({
					where: { ...where, status: RequestStatus.accepted },
				}),
				this.prisma.roomInvitation.count({
					where: { ...where, status: RequestStatus.rejected },
				}),
				this.prisma.roomInvitation.count({
					where: { ...where, status: RequestStatus.cancelled },
				}),
			]);

		return {
			data: invitations.map((invitation) => this.transformToResponseDto(invitation)),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
			counts: {
				pending: pendingCount,
				accepted: acceptedCount,
				rejected: declinedCount,
				cancelled: withdrawnCount,
				total,
			},
		};
	}

	async getReceivedInvitations(recipientId: string, query: QueryRoomInvitationDto) {
		const { page = 1, limit = 20, status } = query;
		const skip = (page - 1) * limit;

		const where = {
			recipientId,
			...(status && { status }),
		};

		const [invitations, total, pendingCount, acceptedCount, declinedCount, withdrawnCount] =
			await Promise.all([
				this.prisma.roomInvitation.findMany({
					where,
					skip,
					take: limit,
					orderBy: { createdAt: 'desc' },
					include: {
						sender: {
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
									select: { id: true, name: true },
								},
							},
						},
					},
				}),
				this.prisma.roomInvitation.count({ where }),
				this.prisma.roomInvitation.count({ where: { ...where, status: RequestStatus.pending } }),
				this.prisma.roomInvitation.count({
					where: { ...where, status: RequestStatus.accepted },
				}),
				this.prisma.roomInvitation.count({
					where: { ...where, status: RequestStatus.rejected },
				}),
				this.prisma.roomInvitation.count({
					where: { ...where, status: RequestStatus.cancelled },
				}),
			]);

		return {
			data: invitations.map((invitation) => this.transformToResponseDto(invitation)),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
			counts: {
				pending: pendingCount,
				accepted: acceptedCount,
				rejected: declinedCount,
				cancelled: withdrawnCount,
				total,
			},
		};
	}

	async updateRoomInvitation(
		invitationId: string,
		recipientId: string,
		dto: UpdateRoomInvitationDto,
	) {
		const invitation = await this.prisma.roomInvitation.findUnique({
			where: { id: invitationId },
			include: {
				recipient: true,
				sender: true,
				room: { include: { building: { include: { owner: true } } } },
			},
		});

		if (!invitation) {
			throw new NotFoundException('Room invitation not found');
		}

		// Verify recipient ownership
		if (invitation.recipientId !== recipientId) {
			throw new ForbiddenException('You can only respond to your own invitations');
		}

		// Status transition validation
		if (dto.status && invitation.status !== RequestStatus.pending) {
			throw new BadRequestException('Can only accept/reject pending invitations');
		}

		// If accepting, just verify room is still available (rental will be created on landlord confirm)
		if (dto.status === RequestStatus.accepted) {
			const availableInstance = await this.prisma.roomInstance.findFirst({
				where: { roomId: invitation.roomId, status: 'available' },
				orderBy: { createdAt: 'asc' },
			});

			if (!availableInstance) {
				throw new BadRequestException('No available room instances for this invitation');
			}
		} else if (dto.status === RequestStatus.rejected) {
			await this.notificationsService.notifyInvitationRejected(invitation.senderId, {
				roomName: invitation.room.name,
				tenantName: `${invitation.recipient?.firstName} ${invitation.recipient?.lastName}`,
				invitationId: invitation.id,
			});
		}

		const updatedInvitation = await this.prisma.roomInvitation.update({
			where: { id: invitationId },
			data: {
				status: dto.status,
				// Note: Prisma schema doesn't have tenantNotes, using message field
				...(dto.tenantNotes && { message: dto.tenantNotes }),
				...(dto.status && { respondedAt: new Date() }),
			},
			include: {
				recipient: true,
				sender: true,
				room: { include: { building: { include: { owner: true } } } },
			},
		});

		return this.transformToResponseDto(updatedInvitation);
	}

	async confirmRoomInvitation(invitationId: string, senderId: string) {
		const invitation = await this.prisma.roomInvitation.findUnique({
			where: { id: invitationId },
			include: {
				recipient: true,
				sender: true,
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

		if (!invitation) {
			throw new NotFoundException('Room invitation not found');
		}

		if (invitation.senderId !== senderId) {
			throw new ForbiddenException('You can only confirm your own invitations');
		}

		if (invitation.status === RequestStatus.awaiting_confirmation) {
			throw new BadRequestException('Invitation is already confirmed');
		}

		if (invitation.status !== RequestStatus.accepted) {
			throw new BadRequestException(
				'Can only confirm invitations that have been accepted by tenant',
			);
		}

		// ===== BƯỚC 1: LUÔN ĐÁNH DẤU CONFIRMED (không rollback) =====
		const updatedInvitation = await this.prisma.roomInvitation.update({
			where: { id: invitationId },
			data: {
				status: RequestStatus.accepted, // Keep as accepted since rental will be created
				confirmedAt: new Date(),
			},
			include: {
				recipient: true,
				sender: true,
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
			if (invitation.room.roomInstances.length === 0) {
				throw new BadRequestException('No available room instance');
			}

			const roomInstance = invitation.room.roomInstances[0];

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
			if (invitation.recipientId) {
				const existingTenantRental = await this.prisma.rental.findFirst({
					where: {
						tenantId: invitation.recipientId,
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
			}

			// Tạo Rental và update RoomInstance status trong transaction
			rental = await this.prisma.$transaction(async (tx) => {
				// Create rental - ACCEPT giá trị 0
				const newRental = await tx.rental.create({
					data: {
						invitationId: invitation.id,
						roomInstanceId: roomInstance.id,
						tenantId: invitation.recipientId!,
						ownerId: invitation.room.building.ownerId,
						contractStartDate: invitation.moveInDate || new Date(),
						contractEndDate: invitation.rentalMonths
							? new Date(
									(invitation.moveInDate || new Date()).getTime() +
										invitation.rentalMonths * 30 * 24 * 60 * 60 * 1000,
								)
							: null,
						monthlyRent: invitation.monthlyRent,
						depositPaid: invitation.depositAmount,
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

		// Gửi notification cho tenant về việc landlord confirm
		if (invitation.recipientId) {
			await this.notificationsService.notifyInvitationConfirmed(invitation.recipientId, {
				roomName: invitation.room.name,
				invitationId: invitation.id,
			});
		}

		if (rental) {
			// SUCCESS: Gửi notification cho cả 2 bên về rental được tạo
			if (invitation.recipientId) {
				await this.notificationsService.notifyRentalCreated(invitation.recipientId, {
					roomName: invitation.room.name,
					rentalId: rental.id,
					startDate: (invitation.moveInDate || new Date()).toISOString(),
				});
			}

			await this.notificationsService.notifyRentalCreated(invitation.room.building.ownerId, {
				roomName: invitation.room.name,
				rentalId: rental.id,
				startDate: (invitation.moveInDate || new Date()).toISOString(),
			});

			return this.transformToResponseDto(updatedInvitation);
		} else {
			// FAILED: Thông báo cho cả 2 bên

			// Notify tenant
			if (invitation.recipientId) {
				await this.notificationsService.notifyRentalCreationFailedInvitation(
					invitation.recipientId,
					{
						roomName: invitation.room.name,
						error: rentalCreationError,
						invitationId: invitation.id,
					},
				);
			}

			// Notify landlord
			await this.notificationsService.notifyRentalCreationFailedInvitation(
				invitation.room.building.ownerId,
				{
					roomName: invitation.room.name,
					error: rentalCreationError,
					invitationId: invitation.id,
				},
			);

			// Return invitation without rental, with error info
			return {
				...this.transformToResponseDto(updatedInvitation),
				rental: null,
				rentalCreationError,
			};
		}
	}

	async withdrawRoomInvitation(invitationId: string, senderId: string) {
		const invitation = await this.prisma.roomInvitation.findUnique({
			where: { id: invitationId },
			include: {
				recipient: true,
				sender: true,
				room: { include: { building: true } },
			},
		});

		if (!invitation) {
			throw new NotFoundException('Room invitation not found');
		}

		if (invitation.senderId !== senderId) {
			throw new ForbiddenException('You can only withdraw your own invitations');
		}

		if (invitation.status === RequestStatus.cancelled) {
			throw new BadRequestException('Invitation is already withdrawn');
		}

		if (invitation.status === RequestStatus.accepted) {
			throw new BadRequestException('Cannot withdraw accepted invitation');
		}

		const updatedInvitation = await this.prisma.roomInvitation.update({
			where: { id: invitationId },
			data: {
				status: RequestStatus.cancelled,
			},
			include: {
				recipient: true,
				sender: true,
				room: { include: { building: true } },
			},
		});

		// Notify recipient if invitation was pending
		if (invitation.status === RequestStatus.pending && invitation.recipientId) {
			await this.notificationsService.notifyInvitationWithdrawn(invitation.recipientId, {
				roomName: invitation.room.name,
				landlordName: `${invitation.sender?.firstName} ${invitation.sender?.lastName}`,
				invitationId: invitation.id,
			});
		}

		return this.transformToResponseDto(updatedInvitation);
	}

	async getMyInvitations(userId: string, query: QueryRoomInvitationDto) {
		// Get user role to determine which invitations to show
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// If user is landlord, show sent invitations
		if (user.role === UserRole.landlord) {
			return this.getSentInvitations(userId, query);
		}
		// If user is tenant, show received invitations
		else if (user.role === UserRole.tenant) {
			return this.getReceivedInvitations(userId, query);
		}

		throw new ForbiddenException('Invalid user role');
	}

	async getRoomInvitationById(invitationId: string, userId: string) {
		const invitation = await this.prisma.roomInvitation.findUnique({
			where: { id: invitationId },
			include: {
				recipient: {
					select: { id: true, firstName: true, lastName: true, email: true, phone: true },
				},
				sender: {
					select: { id: true, firstName: true, lastName: true, email: true, phone: true },
				},
				room: { include: { building: { select: { id: true, name: true, ownerId: true } } } },
			},
		});

		if (!invitation) {
			throw new NotFoundException('Room invitation not found');
		}

		// Check access rights
		const isSender = invitation.senderId === userId;
		const isRecipient = invitation.recipientId === userId;

		if (!isSender && !isRecipient) {
			throw new ForbiddenException('Access denied');
		}

		return this.transformToResponseDto(invitation);
	}
}
