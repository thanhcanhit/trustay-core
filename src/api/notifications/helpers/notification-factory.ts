import { Injectable } from '@nestjs/common';
import { NotificationType } from '../constants/notification-types';
import { CreateNotificationDto } from '../dto';
import {
	formatNotificationTemplate,
	NOTIFICATION_TEMPLATES,
} from '../templates/notification-templates';

@Injectable()
export class NotificationFactory {
	/**
	 * Tạo notification data từ template
	 */
	createFromTemplate(
		userId: string,
		type: NotificationType,
		templateData: Record<string, any> = {},
		customExpiryDays?: number,
	): CreateNotificationDto {
		const template = NOTIFICATION_TEMPLATES[type];

		if (!template) {
			throw new Error(`Notification template not found for type: ${type}`);
		}

		const { title, message } = formatNotificationTemplate(template, templateData);

		// Calculate expiry date
		let expiresAt: string | undefined;
		const expiryDays = customExpiryDays ?? template.expiresInDays;
		if (expiryDays) {
			const expiryDate = new Date();
			expiryDate.setDate(expiryDate.getDate() + expiryDays);
			expiresAt = expiryDate.toISOString();
		}

		return {
			userId,
			notificationType: type,
			title,
			message,
			data: templateData,
			expiresAt,
		};
	}

	// Authentication & User Notifications
	createAccountVerificationNotification(userId: string) {
		return this.createFromTemplate(userId, NotificationType.ACCOUNT_VERIFICATION);
	}

	createPasswordChangedNotification(userId: string) {
		return this.createFromTemplate(userId, NotificationType.PASSWORD_CHANGED);
	}

	createProfileUpdatedNotification(userId: string) {
		return this.createFromTemplate(userId, NotificationType.PROFILE_UPDATED);
	}

	createWelcomeNotification(userId: string, userName: string) {
		return this.createFromTemplate(userId, NotificationType.WELCOME, { userName });
	}

	// Booking Related Notifications
	createBookingRequestNotification(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			bookingId: string;
			roomId: string;
		},
	) {
		return this.createFromTemplate(landlordId, NotificationType.BOOKING_REQUEST_CREATED, data);
	}

	createBookingAcceptedNotification(
		tenantId: string,
		data: {
			roomName: string;
			landlordName: string;
			bookingId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.BOOKING_REQUEST_ACCEPTED, data);
	}

	createBookingRejectedNotification(
		tenantId: string,
		data: {
			roomName: string;
			reason?: string;
			bookingId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.BOOKING_REQUEST_REJECTED, data);
	}

	createBookingCancelledNotification(
		userId: string,
		data: {
			roomName: string;
			cancelledBy: string;
			bookingId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.BOOKING_REQUEST_CANCELLED, data);
	}

	createBookingConfirmedNotification(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			bookingId: string;
		},
	) {
		return this.createFromTemplate(landlordId, NotificationType.BOOKING_REQUEST_CONFIRMED, data);
	}

	// Invitation Related Notifications
	createRoomInvitationNotification(
		tenantId: string,
		data: {
			roomName: string;
			buildingName: string;
			landlordName: string;
			invitationId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.ROOM_INVITATION_RECEIVED, data);
	}

	createInvitationAcceptedNotification(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			invitationId: string;
		},
	) {
		return this.createFromTemplate(landlordId, NotificationType.ROOM_INVITATION_ACCEPTED, data);
	}

	createInvitationRejectedNotification(
		landlordId: string,
		data: {
			roomName: string;
			tenantName: string;
			invitationId: string;
		},
	) {
		return this.createFromTemplate(landlordId, NotificationType.ROOM_INVITATION_REJECTED, data);
	}

	createInvitationWithdrawnNotification(
		tenantId: string,
		data: {
			roomName: string;
			landlordName: string;
			invitationId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.ROOM_INVITATION_WITHDRAWN, data);
	}

	createInvitationConfirmedNotification(
		tenantId: string,
		data: {
			roomName: string;
			invitationId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.ROOM_INVITATION_CONFIRMED, data);
	}

	// Rental Related Notifications
	createRentalCreatedNotification(
		userId: string,
		data: {
			roomName: string;
			startDate: string;
			rentalId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.RENTAL_CREATED, data);
	}

	createRentalCreationFailedNotification(
		userId: string,
		data: {
			roomName: string;
			error: string;
			bookingId?: string;
			invitationId?: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.RENTAL_CREATION_FAILED, data);
	}

	createRentalCreationFailedInvitationNotification(
		userId: string,
		data: {
			roomName: string;
			error: string;
			invitationId?: string;
		},
	) {
		return this.createFromTemplate(
			userId,
			NotificationType.RENTAL_CREATION_FAILED_INVITATION,
			data,
		);
	}

	createRentalStatusUpdatedNotification(
		userId: string,
		data: {
			roomName: string;
			newStatus: string;
			rentalId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.RENTAL_STATUS_UPDATED, data);
	}

	createRentalTerminatedNotification(
		userId: string,
		data: {
			roomName: string;
			reason?: string;
			rentalId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.RENTAL_TERMINATED, data);
	}

	createRentalExpiringNotification(
		userId: string,
		data: {
			roomName: string;
			expiryDate: string;
			rentalId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.RENTAL_EXPIRING_SOON, data);
	}

	// Payment & Billing Notifications
	createBillNotification(
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
		return this.createFromTemplate(tenantId, NotificationType.MONTHLY_BILL_CREATED, data);
	}

	createPaymentReceivedNotification(
		landlordId: string,
		data: {
			amount: number;
			paymentType: string;
			roomName: string;
			tenantName: string;
			paymentId: string;
		},
	) {
		return this.createFromTemplate(landlordId, NotificationType.PAYMENT_RECEIVED, data);
	}

	createPaymentCompletedNotification(
		tenantId: string,
		data: {
			amount: number;
			paymentType: string;
			roomName: string;
			paidDate: string;
			paymentId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.PAYMENT_COMPLETED, data);
	}

	createPaymentFailedNotification(
		tenantId: string,
		data: {
			amount: number;
			paymentType: string;
			roomName: string;
			reason?: string;
			paymentId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.PAYMENT_FAILED, data);
	}

	createPaymentOverdueNotification(
		tenantId: string,
		data: {
			billId: string;
			days: number;
			amount: number;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.PAYMENT_OVERDUE, data);
	}

	createPaymentReminderNotification(
		tenantId: string,
		data: {
			billId: string;
			dueDate: string;
			amount: number;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.PAYMENT_REMINDER, data);
	}

	// Roommate Related Notifications
	createRoommateApplicationReceivedNotification(
		tenantId: string,
		data: {
			applicantName: string;
			roomName: string;
			applicationId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.ROOMMATE_APPLICATION_RECEIVED, data);
	}

	createRoommateApplicationApprovedNotification(
		applicantId: string,
		data: {
			roomName: string;
			applicationId: string;
		},
	) {
		return this.createFromTemplate(
			applicantId,
			NotificationType.ROOMMATE_APPLICATION_APPROVED,
			data,
		);
	}

	createRoommateApplicationRejectedNotification(
		applicantId: string,
		data: {
			roomName: string;
			reason?: string;
			applicationId: string;
		},
	) {
		return this.createFromTemplate(
			applicantId,
			NotificationType.ROOMMATE_APPLICATION_REJECTED,
			data,
		);
	}

	createRoommateApplicationConfirmedNotification(
		userId: string,
		data: {
			roomName: string;
			applicationId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.ROOMMATE_APPLICATION_CONFIRMED, data);
	}

	// Room Seeking Posts Notifications
	createRoomSeekingContactedNotification(
		tenantId: string,
		data: {
			landlordName: string;
			postTitle: string;
			postId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.ROOM_SEEKING_POST_CONTACTED, data);
	}

	createRoomSeekingExpiringNotification(
		tenantId: string,
		data: {
			postTitle: string;
			expiryDate: string;
			postId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.ROOM_SEEKING_POST_EXPIRING, data);
	}

	// Property Related Notifications
	createRoomStatusChangedNotification(
		landlordId: string,
		data: {
			roomName: string;
			oldStatus: string;
			newStatus: string;
			roomId: string;
		},
	) {
		return this.createFromTemplate(landlordId, NotificationType.ROOM_STATUS_CHANGED, data);
	}

	createNewRoomAvailableNotification(
		tenantId: string,
		data: {
			roomName: string;
			location: string;
			roomId: string;
		},
	) {
		return this.createFromTemplate(tenantId, NotificationType.NEW_ROOM_AVAILABLE, data);
	}

	// System Notifications
	createSystemMaintenanceNotification(
		userId: string,
		data: {
			startTime: string;
			endTime: string;
			date: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.SYSTEM_MAINTENANCE, data);
	}

	createSystemAnnouncementNotification(
		userId: string,
		data: {
			announcementTitle: string;
			announcementContent: string;
		},
		expiryDays?: number,
	) {
		return this.createFromTemplate(userId, NotificationType.SYSTEM_ANNOUNCEMENT, data, expiryDays);
	}

	// General Notifications
	createMessageReceivedNotification(
		userId: string,
		data: {
			senderName: string;
			messagePreview: string;
			messageId: string;
		},
	) {
		return this.createFromTemplate(userId, NotificationType.MESSAGE_RECEIVED, data);
	}

	/**
	 * Tạo multiple notifications cùng lúc
	 */
	createBulkNotifications(
		userIds: string[],
		type: NotificationType,
		templateData: Record<string, any> = {},
		customExpiryDays?: number,
	): CreateNotificationDto[] {
		return userIds.map((userId) =>
			this.createFromTemplate(userId, type, templateData, customExpiryDays),
		);
	}
}
