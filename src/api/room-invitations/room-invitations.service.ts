import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRoomInvitationDto, QueryRoomInvitationDto, UpdateRoomInvitationDto } from './dto';

@Injectable()
export class RoomInvitationsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
	) {}

	private transformToResponseDto(invitation: any): any {
		return {
			...invitation,
			monthlyRent: invitation.monthlyRent ? Number(invitation.monthlyRent) : 0,
			depositAmount: invitation.depositAmount ? Number(invitation.depositAmount) : 0,
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

		// Validate room instance exists and belongs to landlord
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

		if (roomInstance.room.building.ownerId !== senderId) {
			throw new ForbiddenException('You can only invite tenants to your own properties');
		}

		if (roomInstance.status !== 'available') {
			throw new BadRequestException('Room is not available for invitation');
		}

		// Check for existing pending/accepted invitation
		const existingInvitation = await this.prisma.roomInvitation.findFirst({
			where: {
				senderId,
				recipientId: dto.tenantId,
				roomInstanceId: dto.roomInstanceId,
				status: { in: ['pending', 'accepted'] },
			},
		});

		if (existingInvitation) {
			throw new BadRequestException(
				'You already have a pending/accepted invitation for this tenant and room',
			);
		}

		// Check for existing booking request from same tenant for same room
		const existingBooking = await this.prisma.bookingRequest.findFirst({
			where: {
				tenantId: dto.tenantId,
				roomInstanceId: dto.roomInstanceId,
				status: { in: ['pending', 'approved'] },
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

		// Create room invitation
		const roomInvitation = await this.prisma.roomInvitation.create({
			data: {
				senderId,
				recipientId: dto.tenantId,
				roomInstanceId: dto.roomInstanceId,
				moveInDate: moveInDate,
				message: dto.invitationMessage,
				monthlyRent: dto.proposedRent ? parseFloat(dto.proposedRent) : 0,
				depositAmount: 0, // Will be calculated based on monthly rent
				rentalMonths,
				status: InvitationStatus.pending,
			},
			include: {
				recipient: true,
				sender: true,
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

		// Send notification to tenant
		await this.notificationsService.notifyRoomInvitation(dto.tenantId, {
			roomName: `${roomInstance.room.name} - ${roomInstance.roomNumber}`,
			buildingName: roomInstance.room.building.name,
			landlordName: `${sender.firstName} ${sender.lastName}`,
			invitationId: roomInvitation.id,
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
			where.roomInstance = {
				room: {
					...(roomId && { id: roomId }),
					building: {
						ownerId: senderId,
						...(buildingId && { id: buildingId }),
					},
				},
			};
		}

		const [invitations, total] = await Promise.all([
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
			this.prisma.roomInvitation.count({ where }),
		]);

		return {
			data: invitations.map((invitation) => this.transformToResponseDto(invitation)),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
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

		const [invitations, total] = await Promise.all([
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
			this.prisma.roomInvitation.count({ where }),
		]);

		return {
			data: invitations.map((invitation) => this.transformToResponseDto(invitation)),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
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

		if (!invitation) {
			throw new NotFoundException('Room invitation not found');
		}

		// Verify recipient ownership
		if (invitation.recipientId !== recipientId) {
			throw new ForbiddenException('You can only respond to your own invitations');
		}

		// Status transition validation
		if (dto.status && invitation.status !== InvitationStatus.pending) {
			throw new BadRequestException('Can only accept/reject pending invitations');
		}

		// If accepting, check if room is still available
		if (dto.status === InvitationStatus.accepted) {
			const roomInstance = await this.prisma.roomInstance.findUnique({
				where: { id: invitation.roomInstanceId },
			});

			if (!roomInstance || roomInstance.status !== 'available') {
				throw new BadRequestException('Room is no longer available');
			}
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
		if (dto.status === InvitationStatus.accepted) {
			await this.notificationsService.notifyInvitationAccepted(invitation.senderId, {
				roomName: `${updatedInvitation.roomInstance.room.name} - ${updatedInvitation.roomInstance.roomNumber}`,
				tenantName: `${updatedInvitation.recipient?.firstName} ${updatedInvitation.recipient?.lastName}`,
				invitationId: invitation.id,
			});

			// TODO: Auto-create rental contract or booking request in Phase 2
		} else if (dto.status === InvitationStatus.declined) {
			await this.notificationsService.notifyInvitationRejected(invitation.senderId, {
				roomName: `${updatedInvitation.roomInstance.room.name} - ${updatedInvitation.roomInstance.roomNumber}`,
				tenantName: `${updatedInvitation.recipient?.firstName} ${updatedInvitation.recipient?.lastName}`,
				reason: dto.tenantNotes,
				invitationId: invitation.id,
			});
		}

		return this.transformToResponseDto(updatedInvitation);
	}

	async withdrawRoomInvitation(invitationId: string, senderId: string) {
		const invitation = await this.prisma.roomInvitation.findUnique({
			where: { id: invitationId },
			include: {
				recipient: true,
				sender: true,
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

		if (!invitation) {
			throw new NotFoundException('Room invitation not found');
		}

		if (invitation.senderId !== senderId) {
			throw new ForbiddenException('You can only withdraw your own invitations');
		}

		if (invitation.status === InvitationStatus.withdrawn) {
			throw new BadRequestException('Invitation is already withdrawn');
		}

		if (invitation.status === InvitationStatus.accepted) {
			throw new BadRequestException('Cannot withdraw accepted invitation');
		}

		const updatedInvitation = await this.prisma.roomInvitation.update({
			where: { id: invitationId },
			data: {
				status: InvitationStatus.withdrawn,
			},
			include: {
				recipient: true,
				sender: true,
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

		// Notify recipient if invitation was pending
		if (invitation.status === InvitationStatus.pending && invitation.recipientId) {
			await this.notificationsService.notifyInvitationWithdrawn(invitation.recipientId, {
				roomName: `${invitation.roomInstance.room.name} - ${invitation.roomInstance.roomNumber}`,
				landlordName: `${invitation.sender?.firstName} ${invitation.sender?.lastName}`,
				invitationId: invitation.id,
			});
		}

		return this.transformToResponseDto(updatedInvitation);
	}

	async getRoomInvitationById(invitationId: string, userId: string) {
		const invitation = await this.prisma.roomInvitation.findUnique({
			where: { id: invitationId },
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
				sender: {
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
