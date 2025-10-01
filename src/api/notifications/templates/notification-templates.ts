import { NotificationType } from '../constants/notification-types';

export interface NotificationTemplate {
	type: NotificationType;
	title: string;
	message: string;
	expiresInDays?: number;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
	// Authentication & User
	[NotificationType.ACCOUNT_VERIFICATION]: {
		type: NotificationType.ACCOUNT_VERIFICATION,
		title: 'Xác thực tài khoản thành công',
		message: 'Tài khoản của bạn đã được xác thực thành công. Chào mừng bạn đến với Trustay!',
	},

	[NotificationType.PASSWORD_CHANGED]: {
		type: NotificationType.PASSWORD_CHANGED,
		title: 'Mật khẩu đã được thay đổi',
		message: 'Mật khẩu tài khoản của bạn đã được cập nhật thành công.',
	},

	[NotificationType.PROFILE_UPDATED]: {
		type: NotificationType.PROFILE_UPDATED,
		title: 'Hồ sơ đã được cập nhật',
		message: 'Thông tin hồ sơ của bạn đã được cập nhật thành công.',
	},

	// Booking Related
	[NotificationType.BOOKING_REQUEST_CREATED]: {
		type: NotificationType.BOOKING_REQUEST_CREATED,
		title: 'Yêu cầu booking mới',
		message: 'Bạn có một yêu cầu booking mới cho phòng {{roomName}}',
		expiresInDays: 7,
	},

	[NotificationType.BOOKING_REQUEST_APPROVED]: {
		type: NotificationType.BOOKING_REQUEST_APPROVED,
		title: 'Yêu cầu booking được chấp nhận',
		message: 'Yêu cầu booking phòng {{roomName}} của bạn đã được chấp nhận!',
	},

	[NotificationType.BOOKING_REQUEST_REJECTED]: {
		type: NotificationType.BOOKING_REQUEST_REJECTED,
		title: 'Yêu cầu booking bị từ chối',
		message: 'Yêu cầu booking phòng {{roomName}} của bạn đã bị từ chối. {{reason}}',
	},

	[NotificationType.BOOKING_REQUEST_CANCELLED]: {
		type: NotificationType.BOOKING_REQUEST_CANCELLED,
		title: 'Yêu cầu booking đã hủy',
		message: 'Yêu cầu booking phòng {{roomName}} đã được hủy bởi {{cancelledBy}}',
	},

	[NotificationType.BOOKING_REQUEST_CONFIRMED]: {
		type: NotificationType.BOOKING_REQUEST_CONFIRMED,
		title: 'Yêu cầu booking được xác nhận',
		message:
			'{{tenantName}} đã xác nhận booking phòng {{roomName}}. Hợp đồng thuê đã được tạo tự động.',
	},

	// Invitation Related
	[NotificationType.ROOM_INVITATION_RECEIVED]: {
		type: NotificationType.ROOM_INVITATION_RECEIVED,
		title: 'Lời mời thuê phòng',
		message: 'Bạn được mời thuê phòng {{roomName}} tại {{buildingName}}',
		expiresInDays: 7,
	},

	[NotificationType.ROOM_INVITATION_ACCEPTED]: {
		type: NotificationType.ROOM_INVITATION_ACCEPTED,
		title: 'Lời mời được chấp nhận',
		message: 'Lời mời thuê phòng {{roomName}} của bạn đã được {{tenantName}} chấp nhận',
	},

	[NotificationType.ROOM_INVITATION_DECLINED]: {
		type: NotificationType.ROOM_INVITATION_DECLINED,
		title: 'Lời mời bị từ chối',
		message: 'Lời mời thuê phòng {{roomName}} của bạn đã bị {{tenantName}} từ chối',
	},

	[NotificationType.ROOM_INVITATION_REJECTED]: {
		type: NotificationType.ROOM_INVITATION_REJECTED,
		title: 'Lời mời bị từ chối',
		message:
			'Lời mời thuê phòng {{roomName}} của bạn đã bị {{tenantName}} từ chối{{#reason}} với lý do: {{reason}}{{/reason}}',
	},

	[NotificationType.ROOM_INVITATION_WITHDRAWN]: {
		type: NotificationType.ROOM_INVITATION_WITHDRAWN,
		title: 'Lời mời đã bị thu hồi',
		message: 'Lời mời thuê phòng {{roomName}} từ {{landlordName}} đã bị thu hồi',
	},

	[NotificationType.ROOM_INVITATION_EXPIRED]: {
		type: NotificationType.ROOM_INVITATION_EXPIRED,
		title: 'Lời mời hết hạn',
		message: 'Lời mời thuê phòng {{roomName}} đã hết hạn',
	},

	[NotificationType.ROOM_INVITATION_CONFIRMED]: {
		type: NotificationType.ROOM_INVITATION_CONFIRMED,
		title: 'Lời mời được xác nhận',
		message:
			'Chủ nhà đã xác nhận lời mời thuê phòng {{roomName}}. Hợp đồng thuê đã được tạo tự động.',
	},

	// Rental Related
	[NotificationType.RENTAL_CREATED]: {
		type: NotificationType.RENTAL_CREATED,
		title: 'Hợp đồng thuê được tạo',
		message: 'Hợp đồng thuê phòng {{roomName}} đã được tạo thành công. Bắt đầu từ {{startDate}}',
	},

	[NotificationType.RENTAL_STATUS_UPDATED]: {
		type: NotificationType.RENTAL_STATUS_UPDATED,
		title: 'Trạng thái hợp đồng cập nhật',
		message: 'Trạng thái hợp đồng thuê phòng {{roomName}} đã được cập nhật: {{newStatus}}',
	},

	[NotificationType.RENTAL_TERMINATED]: {
		type: NotificationType.RENTAL_TERMINATED,
		title: 'Hợp đồng thuê kết thúc',
		message: 'Hợp đồng thuê phòng {{roomName}} đã kết thúc. {{reason}}',
	},

	[NotificationType.RENTAL_EXPIRING_SOON]: {
		type: NotificationType.RENTAL_EXPIRING_SOON,
		title: 'Hợp đồng sắp hết hạn',
		message: 'Hợp đồng thuê phòng {{roomName}} sẽ hết hạn vào {{expiryDate}}',
		expiresInDays: 30,
	},

	// Payment & Billing
	[NotificationType.MONTHLY_BILL_CREATED]: {
		type: NotificationType.MONTHLY_BILL_CREATED,
		title: 'Hóa đơn tháng mới',
		message:
			'Hóa đơn tháng {{month}}/{{year}} cho phòng {{roomName}} đã sẵn sàng. Tổng: {{amount}}đ',
		expiresInDays: 30,
	},

	[NotificationType.PAYMENT_RECEIVED]: {
		type: NotificationType.PAYMENT_RECEIVED,
		title: 'Đã nhận thanh toán',
		message: 'Đã nhận thanh toán {{amount}}đ cho {{paymentType}} phòng {{roomName}}',
	},

	[NotificationType.PAYMENT_FAILED]: {
		type: NotificationType.PAYMENT_FAILED,
		title: 'Thanh toán thất bại',
		message:
			'Thanh toán {{amount}}đ cho {{paymentType}} phòng {{roomName}} đã thất bại. {{reason}}',
	},

	[NotificationType.PAYMENT_OVERDUE]: {
		type: NotificationType.PAYMENT_OVERDUE,
		title: 'Thanh toán quá hạn',
		message: 'Hóa đơn {{billId}} đã quá hạn {{days}} ngày. Vui lòng thanh toán sớm!',
		expiresInDays: 60,
	},

	[NotificationType.PAYMENT_REMINDER]: {
		type: NotificationType.PAYMENT_REMINDER,
		title: 'Nhắc nhở thanh toán',
		message: 'Hóa đơn {{billId}} sẽ đến hạn vào {{dueDate}}. Tổng: {{amount}}đ',
		expiresInDays: 15,
	},

	// Review Related
	[NotificationType.REVIEW_RECEIVED]: {
		type: NotificationType.REVIEW_RECEIVED,
		title: 'Đánh giá mới',
		message: 'Bạn nhận được đánh giá mới {{stars}} sao từ {{reviewerName}} cho {{subject}}',
	},

	[NotificationType.REVIEW_REQUEST]: {
		type: NotificationType.REVIEW_REQUEST,
		title: 'Yêu cầu đánh giá',
		message: 'Vui lòng đánh giá trải nghiệm thuê phòng {{roomName}} của bạn',
		expiresInDays: 30,
	},

	// Roommate Related
	[NotificationType.ROOMMATE_APPLICATION_RECEIVED]: {
		type: NotificationType.ROOMMATE_APPLICATION_RECEIVED,
		title: 'Đơn ứng tuyển roommate mới',
		message: '{{applicantName}} đã ứng tuyển làm roommate cho phòng {{roomName}}',
		expiresInDays: 7,
	},

	[NotificationType.ROOMMATE_APPLICATION_APPROVED]: {
		type: NotificationType.ROOMMATE_APPLICATION_APPROVED,
		title: 'Đơn ứng tuyển được chấp nhận',
		message: 'Đơn ứng tuyển roommate của bạn cho phòng {{roomName}} đã được chấp nhận!',
	},

	[NotificationType.ROOMMATE_APPLICATION_REJECTED]: {
		type: NotificationType.ROOMMATE_APPLICATION_REJECTED,
		title: 'Đơn ứng tuyển bị từ chối',
		message: 'Đơn ứng tuyển roommate của bạn cho phòng {{roomName}} đã bị từ chối. {{reason}}',
	},

	[NotificationType.ROOMMATE_APPLICATION_CONFIRMED]: {
		type: NotificationType.ROOMMATE_APPLICATION_CONFIRMED,
		title: 'Đơn ứng tuyển được xác nhận',
		message:
			'Đơn ứng tuyển roommate cho phòng {{roomName}} đã được xác nhận. Hợp đồng thuê đã được tạo tự động.',
	},

	// Room Seeking Posts
	[NotificationType.ROOM_SEEKING_POST_CONTACTED]: {
		type: NotificationType.ROOM_SEEKING_POST_CONTACTED,
		title: 'Có người liên hệ',
		message: 'Chủ nhà {{landlordName}} quan tâm đến bài đăng tìm trọ của bạn: "{{postTitle}}"',
	},

	[NotificationType.ROOM_SEEKING_POST_EXPIRING]: {
		type: NotificationType.ROOM_SEEKING_POST_EXPIRING,
		title: 'Bài đăng sắp hết hạn',
		message: 'Bài đăng tìm trọ "{{postTitle}}" sẽ hết hạn vào {{expiryDate}}',
		expiresInDays: 7,
	},

	// Property Related
	[NotificationType.ROOM_STATUS_CHANGED]: {
		type: NotificationType.ROOM_STATUS_CHANGED,
		title: 'Trạng thái phòng thay đổi',
		message: 'Phòng {{roomName}} đã chuyển trạng thái: {{oldStatus}} → {{newStatus}}',
	},

	[NotificationType.NEW_ROOM_AVAILABLE]: {
		type: NotificationType.NEW_ROOM_AVAILABLE,
		title: 'Phòng mới có sẵn',
		message: 'Có phòng mới phù hợp với tiêu chí tìm kiếm: {{roomName}} tại {{location}}',
		expiresInDays: 7,
	},

	// System
	[NotificationType.SYSTEM_MAINTENANCE]: {
		type: NotificationType.SYSTEM_MAINTENANCE,
		title: 'Bảo trì hệ thống',
		message: 'Hệ thống sẽ bảo trì từ {{startTime}} đến {{endTime}} ngày {{date}}',
		expiresInDays: 1,
	},

	[NotificationType.SYSTEM_ANNOUNCEMENT]: {
		type: NotificationType.SYSTEM_ANNOUNCEMENT,
		title: '{{announcementTitle}}',
		message: '{{announcementContent}}',
		expiresInDays: 7,
	},

	// General
	[NotificationType.WELCOME]: {
		type: NotificationType.WELCOME,
		title: 'Chào mừng đến với Trustay!',
		message:
			'Xin chào {{userName}}! Cảm ơn bạn đã tham gia cộng đồng Trustay. Hãy khám phá và tìm kiếm không gian sống lý tưởng!',
	},

	[NotificationType.MESSAGE_RECEIVED]: {
		type: NotificationType.MESSAGE_RECEIVED,
		title: 'Tin nhắn mới',
		message: 'Bạn có tin nhắn mới từ {{senderName}}: "{{messagePreview}}"',
		expiresInDays: 30,
	},
};

// Helper function to format template with data
export function formatNotificationTemplate(
	template: NotificationTemplate,
	data: Record<string, any>,
): { title: string; message: string } {
	let title = template.title;
	let message = template.message;

	// Replace placeholders with actual data
	Object.entries(data).forEach(([key, value]) => {
		const placeholder = `{{${key}}}`;
		title = title.replace(new RegExp(placeholder, 'g'), String(value));
		message = message.replace(new RegExp(placeholder, 'g'), String(value));
	});

	return { title, message };
}
