export enum NotificationType {
	// Authentication & User
	ACCOUNT_VERIFICATION = 'account_verification',
	PASSWORD_CHANGED = 'password_changed',
	PROFILE_UPDATED = 'profile_updated',

	// Booking Related
	BOOKING_REQUEST_CREATED = 'booking_request_created',
	BOOKING_REQUEST_APPROVED = 'booking_request_approved',
	BOOKING_REQUEST_REJECTED = 'booking_request_rejected',
	BOOKING_REQUEST_CANCELLED = 'booking_request_cancelled',
	BOOKING_REQUEST_CONFIRMED = 'booking_request_confirmed',

	// Invitation Related
	ROOM_INVITATION_RECEIVED = 'room_invitation_received',
	ROOM_INVITATION_ACCEPTED = 'room_invitation_accepted',
	ROOM_INVITATION_DECLINED = 'room_invitation_declined',
	ROOM_INVITATION_REJECTED = 'room_invitation_rejected',
	ROOM_INVITATION_WITHDRAWN = 'room_invitation_withdrawn',
	ROOM_INVITATION_EXPIRED = 'room_invitation_expired',
	ROOM_INVITATION_CONFIRMED = 'room_invitation_confirmed',

	// Rental Related
	RENTAL_CREATED = 'rental_created',
	RENTAL_STATUS_UPDATED = 'rental_status_updated',
	RENTAL_TERMINATED = 'rental_terminated',
	RENTAL_EXPIRING_SOON = 'rental_expiring_soon',

	// Payment & Billing
	MONTHLY_BILL_CREATED = 'monthly_bill_created',
	PAYMENT_RECEIVED = 'payment_received',
	PAYMENT_FAILED = 'payment_failed',
	PAYMENT_OVERDUE = 'payment_overdue',
	PAYMENT_REMINDER = 'payment_reminder',

	// Review Related
	REVIEW_RECEIVED = 'review_received',
	REVIEW_REQUEST = 'review_request',

	// Room Seeking Posts
	ROOM_SEEKING_POST_CONTACTED = 'room_seeking_post_contacted',
	ROOM_SEEKING_POST_EXPIRING = 'room_seeking_post_expiring',

	// Property Related
	ROOM_STATUS_CHANGED = 'room_status_changed',
	NEW_ROOM_AVAILABLE = 'new_room_available',

	// System
	SYSTEM_MAINTENANCE = 'system_maintenance',
	SYSTEM_ANNOUNCEMENT = 'system_announcement',

	// General
	WELCOME = 'welcome',
	MESSAGE_RECEIVED = 'message_received',
}
