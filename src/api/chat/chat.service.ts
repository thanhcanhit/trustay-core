import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { REALTIME_EVENT } from '../../realtime/realtime.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly realtimeService: RealtimeService,
	) {}

	public async createConversation(input: CreateConversationDto) {
		const { userAId, userBId } = input;
		const existing = await this.prisma.conversation.findFirst({
			where: {
				OR: [
					{ userAId, userBId },
					{ userAId: userBId, userBId: userAId },
				],
			},
		});
		if (existing) {
			return existing;
		}
		return this.prisma.conversation.create({ data: { userAId, userBId } });
	}

	public async sendMessage(senderId: string, dto: SendMessageDto) {
		let conversation: { id: string; userAId: string; userBId: string } | null = null;
		if (dto.conversationId) {
			conversation = await this.prisma.conversation.findUnique({
				where: { id: dto.conversationId },
			});
			if (!conversation) {
				throw new NotFoundException('Conversation not found');
			}
		} else if (dto.recipientId) {
			conversation = await this.createConversation({
				userAId: senderId < dto.recipientId ? senderId : dto.recipientId,
				userBId: senderId < dto.recipientId ? dto.recipientId : senderId,
			});
		} else {
			throw new NotFoundException('Either conversationId or recipientId is required');
		}
		const type = dto.type as unknown as 'text' | 'invitation' | 'request';
		const created = await this.prisma.message.create({
			data: {
				conversationId: conversation.id,
				senderId,
				type: type as any,
				content: dto.content ?? null,
				attachments:
					dto.attachmentUrls && dto.attachmentUrls.length > 0
						? {
								create: dto.attachmentUrls.map((url) => ({
									url,
									mimeType: 'image/*',
									isImage: true,
								})),
							}
						: undefined,
			},
			include: { attachments: true },
		});
		await this.prisma.conversation.update({
			where: { id: conversation.id },
			data: { lastMessageAt: new Date() },
		});
		const recipientId =
			conversation.userAId === senderId ? conversation.userBId : conversation.userAId;
		this.realtimeService.emitChatMessage({
			fromUserId: senderId,
			toUserId: recipientId,
			conversationId: conversation.id,
			message: created,
			messageId: created.id,
			sentAt: created.sentAt.toISOString(),
		});
		// Also generic notify if consumers prefer one channel
		this.realtimeService.emitNotify({
			userId: recipientId,
			event: REALTIME_EVENT.CHAT_MESSAGE,
			data: created,
		});
		return created;
	}

	public async listMessages(conversationId: string, query: ListMessagesQueryDto) {
		const take = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
		return this.prisma.message.findMany({
			where: { conversationId },
			orderBy: { sentAt: 'desc' },
			take,
			cursor: query.cursor ? { id: query.cursor } : undefined,
			skip: query.cursor ? 1 : 0,
			include: { attachments: true },
		});
	}

	public async getUnreadCount(userId: string) {
		const count = await this.prisma.message.count({
			where: {
				readAt: null,
				senderId: { not: userId },
				conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
			},
		});
		return { unreadCount: count };
	}

	public async markAllAsRead(userId: string, conversationId: string) {
		await this.prisma.message.updateMany({
			where: { conversationId, senderId: { not: userId }, readAt: null },
			data: { readAt: new Date() },
		});
		return { success: true };
	}

	public async listConversations(userId: string) {
		const conversations = await this.prisma.conversation.findMany({
			where: { OR: [{ userAId: userId }, { userBId: userId }] },
			orderBy: { updatedAt: 'desc' },
			include: {
				userA: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
				userB: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
				messages: {
					take: 1,
					orderBy: { sentAt: 'desc' },
					select: { id: true, content: true, type: true, sentAt: true },
				},
			},
		});
		const counterpartIds = conversations
			.map((conversation) => {
				const counterpart =
					conversation.userAId === userId ? conversation.userB : conversation.userA;
				return counterpart?.id;
			})
			.filter((id): id is string => Boolean(id));
		const rentalDetails = await this.findActiveRentalsByTenantIds({
			ownerId: userId,
			tenantIds: counterpartIds,
		});
		const withUnread = await Promise.all(
			conversations.map(async (c) => {
				const counterpart = c.userAId === userId ? c.userB : c.userA;
				const lastMessage = c.messages[0] ?? null;
				const unreadCount = await this.prisma.message.count({
					where: {
						conversationId: c.id,
						readAt: null,
						senderId: { not: userId },
					},
				});
				return {
					conversationId: c.id,
					counterpart,
					lastMessage,
					unreadCount,
					counterpartDisplayName: counterpart
						? this.buildCounterpartDisplayName({
								firstName: counterpart.firstName,
								lastName: counterpart.lastName,
								rentalInfo: rentalDetails.get(counterpart.id),
							})
						: '',
				};
			}),
		);
		return withUnread;
	}

	private async findActiveRentalsByTenantIds(params: { ownerId: string; tenantIds: string[] }) {
		if (params.tenantIds.length === 0) {
			return new Map<string, RentalDisplayInfo>();
		}
		const rentals = await this.prisma.rental.findMany({
			where: {
				ownerId: params.ownerId,
				status: RentalStatus.active,
				tenantId: { in: params.tenantIds },
			},
			orderBy: { updatedAt: 'desc' },
			select: {
				tenantId: true,
				roomInstance: {
					select: {
						roomNumber: true,
						room: {
							select: {
								building: { select: { name: true } },
							},
						},
					},
				},
			},
		});
		const map = new Map<string, RentalDisplayInfo>();
		rentals.forEach((rental) => {
			if (!rental.roomInstance || !rental.roomInstance.room.building) {
				return;
			}
			if (map.has(rental.tenantId)) {
				return;
			}
			map.set(rental.tenantId, {
				roomNumber: rental.roomInstance.roomNumber,
				buildingName: rental.roomInstance.room.building.name,
			});
		});
		return map;
	}

	private buildCounterpartDisplayName(params: BuildCounterpartDisplayNameParams) {
		const baseName =
			[params.firstName, params.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
		if (!params.rentalInfo) {
			return baseName;
		}
		const sanitizedBuildingName = this.sanitizeBuildingName(params.rentalInfo.buildingName);
		return `${baseName} - ${params.rentalInfo.roomNumber} - ${sanitizedBuildingName}`;
	}

	private sanitizeBuildingName(buildingName: string) {
		const cleaned = buildingName.replace(/dãy\s*trọ\s*/gi, '').trim();
		return cleaned.length > 0 ? cleaned : buildingName.trim();
	}
}

interface RentalDisplayInfo {
	readonly roomNumber: string;
	readonly buildingName: string;
}

interface BuildCounterpartDisplayNameParams {
	readonly firstName: string | null;
	readonly lastName: string | null;
	readonly rentalInfo?: RentalDisplayInfo;
}
