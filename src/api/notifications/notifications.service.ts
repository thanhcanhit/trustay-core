import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { NotifyEnvelope, REALTIME_EVENT } from '../../realtime/realtime.types';
import { NotificationType } from './constants/notification-types';
import { CreateNotificationDto, QueryNotificationsDto } from './dto';
import { NotificationFactory } from './helpers/notification-factory';

@Injectable()
export class NotificationsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationFactory: NotificationFactory,
		private readonly realtimeService: RealtimeService,
	) {}

	async createNotification(createNotificationDto: CreateNotificationDto) {
		const { userId, notificationType, title, message, data, expiresAt } = createNotificationDto;

		// Verify user exists
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		const created = await this.prisma.notification.create({
			data: {
				userId,
				notificationType,
				title,
				message,
				data: data || {},
				expiresAt: expiresAt ? new Date(expiresAt) : null,
				isRead: false,
			},
		});
		const envelope: NotifyEnvelope<typeof created> = {
			type: notificationType,
			data: created,
		};
		this.realtimeService.emitNotify({ userId, event: REALTIME_EVENT.NOTIFY, data: envelope });
		return created;
	}

	async getUserNotifications(userId: string, query: QueryNotificationsDto) {
		const { page = 1, limit = 20, isRead, notificationType } = query;
		const skip = (page - 1) * limit;

		const where = {
			userId,
			...(isRead !== undefined && { isRead }),
			...(notificationType && { notificationType }),
			OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
		};

		const [notifications, total] = await Promise.all([
			this.prisma.notification.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.notification.count({ where }),
		]);

		return {
			data: notifications,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async markAsRead(notificationId: string, userId: string) {
		const notification = await this.prisma.notification.findUnique({
			where: { id: notificationId },
		});

		if (!notification) {
			throw new NotFoundException('Notification not found');
		}

		if (notification.userId !== userId) {
			throw new ForbiddenException('You can only mark your own notifications as read');
		}

		return this.prisma.notification.update({
			where: { id: notificationId },
			data: { isRead: true },
		});
	}

	async markAllAsRead(userId: string) {
		return this.prisma.notification.updateMany({
			where: {
				userId,
				isRead: false,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			data: { isRead: true },
		});
	}

	async deleteNotification(notificationId: string, userId: string) {
		const notification = await this.prisma.notification.findUnique({
			where: { id: notificationId },
		});

		if (!notification) {
			throw new NotFoundException('Notification not found');
		}

		if (notification.userId !== userId) {
			throw new ForbiddenException('You can only delete your own notifications');
		}

		return this.prisma.notification.delete({
			where: { id: notificationId },
		});
	}

	async getUnreadCount(userId: string) {
		const count = await this.prisma.notification.count({
			where: {
				userId,
				isRead: false,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		});

		return { unreadCount: count };
	}

	// Helper method for system to create notifications
	async createSystemNotification(
		userId: string,
		type: string,
		title: string,
		message: string,
		data?: any,
		expiresAt?: Date,
	) {
		return this.createNotification({
			userId,
			notificationType: type,
			title,
			message,
			data,
			expiresAt: expiresAt?.toISOString(),
		});
	}

	// Bulk create notifications (for system use)
	async createBulkNotifications(notifications: CreateNotificationDto[]) {
		return this.prisma.notification.createMany({
			data: notifications.map((notification) => ({
				...notification,
				data: notification.data || {},
				expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : null,
				isRead: false,
			})),
		});
	}

	// Clean up expired notifications (for scheduled tasks)
	async cleanupExpiredNotifications() {
		return this.prisma.notification.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});
	}

	// ==================== BUSINESS LOGIC METHODS ====================
	// Authentication & User Notifications
	async notifyAccountVerification(userId: string) {
		const notification = this.notificationFactory.createAccountVerificationNotification(userId);
		return this.createNotification(notification);
	}

	async notifyPasswordChanged(userId: string) {
		const notification = this.notificationFactory.createPasswordChangedNotification(userId);
		return this.createNotification(notification);
	}

	async notifyProfileUpdated(userId: string) {
		const notification = this.notificationFactory.createProfileUpdatedNotification(userId);
		return this.createNotification(notification);
	}

	async notifyWelcome(userId: string, userName: string) {
		const notification = this.notificationFactory.createWelcomeNotification(userId, userName);
		return this.createNotification(notification);
	}

	// Booking Related Notifications
	async notifyBookingRequest(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			bookingId: string;
			roomId: string;
		},
	) {
		const notification = this.notificationFactory.createBookingRequestNotification(
			landlordId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyBookingAccepted(
		tenantId: string,
		data: {
			roomName: string;
			landlordName: string;
			bookingId: string;
		},
	) {
		const notification = this.notificationFactory.createBookingAcceptedNotification(tenantId, data);
		return this.createNotification(notification);
	}

	async notifyBookingRejected(
		tenantId: string,
		data: {
			roomName: string;
			reason?: string;
			bookingId: string;
		},
	) {
		const notification = this.notificationFactory.createBookingRejectedNotification(tenantId, data);
		return this.createNotification(notification);
	}

	async notifyBookingCancelled(
		userId: string,
		data: {
			roomName: string;
			cancelledBy: string;
			bookingId: string;
		},
	) {
		const notification = this.notificationFactory.createBookingCancelledNotification(userId, data);
		return this.createNotification(notification);
	}

	async notifyBookingConfirmed(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			bookingId: string;
		},
	) {
		const notification = this.notificationFactory.createBookingConfirmedNotification(
			landlordId,
			data,
		);
		return this.createNotification(notification);
	}

	// Invitation Related Notifications
	async notifyRoomInvitation(
		tenantId: string,
		data: {
			roomName: string;
			buildingName: string;
			landlordName: string;
			invitationId: string;
		},
	) {
		const notification = this.notificationFactory.createRoomInvitationNotification(tenantId, data);
		return this.createNotification(notification);
	}

	async notifyInvitationAccepted(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			invitationId: string;
		},
	) {
		const notification = this.notificationFactory.createInvitationAcceptedNotification(
			landlordId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyInvitationRejected(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			invitationId: string;
		},
	) {
		const notification = this.notificationFactory.createInvitationRejectedNotification(
			landlordId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyInvitationWithdrawn(
		tenantId: string,
		data: {
			roomName: string;
			landlordName: string;
			invitationId: string;
		},
	) {
		const notification = this.notificationFactory.createInvitationWithdrawnNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyInvitationConfirmed(
		tenantId: string,
		data: {
			roomName: string;
			invitationId: string;
		},
	) {
		const notification = this.notificationFactory.createInvitationConfirmedNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	// Rental Related Notifications
	async notifyRentalCreated(
		userId: string,
		data: {
			roomName: string;
			startDate: string;
			rentalId: string;
		},
	) {
		const notification = this.notificationFactory.createRentalCreatedNotification(userId, data);
		return this.createNotification(notification);
	}

	async notifyRentalCreationFailed(
		userId: string,
		data: {
			roomName: string;
			error: string;
			bookingId?: string;
			invitationId?: string;
		},
	) {
		const notification = this.notificationFactory.createRentalCreationFailedNotification(
			userId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRentalCreationFailedInvitation(
		userId: string,
		data: {
			roomName: string;
			error: string;
			invitationId?: string;
		},
	) {
		const notification = this.notificationFactory.createRentalCreationFailedInvitationNotification(
			userId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRentalStatusUpdated(
		userId: string,
		data: {
			roomName: string;
			newStatus: string;
			rentalId: string;
		},
	) {
		const notification = this.notificationFactory.createRentalStatusUpdatedNotification(
			userId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRentalTerminated(
		userId: string,
		data: {
			roomName: string;
			reason?: string;
			rentalId: string;
		},
	) {
		const notification = this.notificationFactory.createRentalTerminatedNotification(userId, data);
		return this.createNotification(notification);
	}

	async notifyRentalExpiring(
		userId: string,
		data: {
			roomName: string;
			expiryDate: string;
			rentalId: string;
		},
	) {
		const notification = this.notificationFactory.createRentalExpiringNotification(userId, data);
		return this.createNotification(notification);
	}

	// Payment & Billing Notifications
	async notifyBill(
		tenantId: string,
		data: {
			month: number;
			year: number;
			roomName: string;
			amount: number;
			billId: string;
			dueDate: Date;
			landlordName: string;
		},
	) {
		const notification = this.notificationFactory.createBillNotification(tenantId, data);
		return this.createNotification(notification);
	}

	async notifyPaymentReceived(
		landlordId: string,
		data: {
			amount: number;
			paymentType: string;
			roomName: string;
			tenantName: string;
			paymentId: string;
		},
	) {
		const notification = this.notificationFactory.createPaymentReceivedNotification(
			landlordId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyPaymentCompleted(
		tenantId: string,
		data: {
			amount: number;
			paymentType: string;
			roomName: string;
			paidDate: string;
			paymentId: string;
		},
	) {
		const notification = this.notificationFactory.createPaymentCompletedNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyPaymentFailed(
		tenantId: string,
		data: {
			amount: number;
			paymentType: string;
			roomName: string;
			reason?: string;
			paymentId: string;
		},
	) {
		const notification = this.notificationFactory.createPaymentFailedNotification(tenantId, data);
		return this.createNotification(notification);
	}

	async notifyPaymentOverdue(
		tenantId: string,
		data: {
			billId: string;
			days: number;
			amount: number;
		},
	) {
		const notification = this.notificationFactory.createPaymentOverdueNotification(tenantId, data);
		return this.createNotification(notification);
	}

	async notifyPaymentReminder(
		tenantId: string,
		data: {
			billId: string;
			dueDate: string;
			amount: number;
		},
	) {
		const notification = this.notificationFactory.createPaymentReminderNotification(tenantId, data);
		return this.createNotification(notification);
	}

	// Roommate Related Notifications
	async notifyRoommateApplicationReceived(
		tenantId: string,
		data: {
			applicantName: string;
			roomName: string;
			applicationId: string;
		},
	) {
		const notification = this.notificationFactory.createRoommateApplicationReceivedNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRoommateApplicationApproved(
		applicantId: string,
		data: {
			roomName: string;
			applicationId: string;
		},
	) {
		const notification = this.notificationFactory.createRoommateApplicationApprovedNotification(
			applicantId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRoommateApplicationRejected(
		applicantId: string,
		data: {
			roomName: string;
			reason?: string;
			applicationId: string;
		},
	) {
		const notification = this.notificationFactory.createRoommateApplicationRejectedNotification(
			applicantId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRoommateApplicationConfirmed(
		userId: string,
		data: {
			roomName: string;
			applicationId: string;
		},
	) {
		const notification = this.notificationFactory.createRoommateApplicationConfirmedNotification(
			userId,
			data,
		);
		return this.createNotification(notification);
	}

	// Room Seeking Posts Notifications
	async notifyRoomSeekingContacted(
		tenantId: string,
		data: {
			landlordName: string;
			postTitle: string;
			postId: string;
		},
	) {
		const notification = this.notificationFactory.createRoomSeekingContactedNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyRoomSeekingExpiring(
		tenantId: string,
		data: {
			postTitle: string;
			expiryDate: string;
			postId: string;
		},
	) {
		const notification = this.notificationFactory.createRoomSeekingExpiringNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	// Property Related Notifications
	async notifyRoomStatusChanged(
		landlordId: string,
		data: {
			roomName: string;
			oldStatus: string;
			newStatus: string;
			roomId: string;
		},
	) {
		const notification = this.notificationFactory.createRoomStatusChangedNotification(
			landlordId,
			data,
		);
		return this.createNotification(notification);
	}

	async notifyNewRoomAvailable(
		tenantId: string,
		data: {
			roomName: string;
			location: string;
			roomId: string;
		},
	) {
		const notification = this.notificationFactory.createNewRoomAvailableNotification(
			tenantId,
			data,
		);
		return this.createNotification(notification);
	}

	// System Notifications
	async notifySystemMaintenance(
		userId: string,
		data: {
			startTime: string;
			endTime: string;
			date: string;
		},
	) {
		const notification = this.notificationFactory.createSystemMaintenanceNotification(userId, data);
		return this.createNotification(notification);
	}

	async notifySystemAnnouncement(
		userId: string,
		data: {
			announcementTitle: string;
			announcementContent: string;
		},
		expiryDays?: number,
	) {
		const notification = this.notificationFactory.createSystemAnnouncementNotification(
			userId,
			data,
			expiryDays,
		);
		return this.createNotification(notification);
	}

	// General Notifications
	async notifyMessageReceived(
		userId: string,
		data: {
			senderName: string;
			messagePreview: string;
			messageId: string;
		},
	) {
		const notification = this.notificationFactory.createMessageReceivedNotification(userId, data);
		return this.createNotification(notification);
	}

	// Bulk notification methods
	async notifyBulkSystemMaintenance(
		userIds: string[],
		data: {
			startTime: string;
			endTime: string;
			date: string;
		},
	) {
		const notifications = this.notificationFactory.createBulkNotifications(
			userIds,
			NotificationType.SYSTEM_MAINTENANCE,
			data,
		);
		return this.createBulkNotifications(notifications);
	}

	async notifyBulkSystemAnnouncement(
		userIds: string[],
		data: {
			announcementTitle: string;
			announcementContent: string;
		},
		expiryDays?: number,
	) {
		const notifications = this.notificationFactory.createBulkNotifications(
			userIds,
			NotificationType.SYSTEM_ANNOUNCEMENT,
			data,
			expiryDays,
		);
		return this.createBulkNotifications(notifications);
	}
}
