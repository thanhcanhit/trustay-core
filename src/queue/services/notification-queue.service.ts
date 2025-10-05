import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';

export interface NotificationJobData {
	userId: string;
	title: string;
	message: string;
	type: 'booking' | 'message' | 'rating' | 'system' | 'payment';
	data?: Record<string, any>;
	channels?: ('push' | 'in-app' | 'email')[];
}

@Injectable()
export class NotificationQueueService {
	private readonly logger = new Logger(NotificationQueueService.name);

	constructor(@InjectQueue('notification-queue') private notificationQueue: Queue) {}

	/**
	 * Send notification
	 */
	async sendNotification(data: NotificationJobData, priority = 2): Promise<void> {
		await this.notificationQueue.add('send-notification', data, {
			priority,
		});

		this.logger.log(`Notification queued for user ${data.userId}: ${data.type}`);
	}

	/**
	 * Send booking notification
	 */
	async sendBookingNotification(
		userId: string,
		action: 'created' | 'approved' | 'rejected' | 'cancelled',
		bookingId: string,
		roomName: string,
	): Promise<void> {
		const messages = {
			created: `Yêu cầu đặt phòng "${roomName}" đã được gửi`,
			approved: `Yêu cầu đặt phòng "${roomName}" đã được chấp nhận`,
			rejected: `Yêu cầu đặt phòng "${roomName}" đã bị từ chối`,
			cancelled: `Yêu cầu đặt phòng "${roomName}" đã bị hủy`,
		};

		await this.sendNotification({
			userId,
			title: 'Thông báo đặt phòng',
			message: messages[action],
			type: 'booking',
			data: { bookingId, roomName, action },
			channels: ['push', 'in-app'],
		});
	}

	/**
	 * Send message notification
	 */
	async sendMessageNotification(
		userId: string,
		senderName: string,
		preview: string,
		conversationId: string,
	): Promise<void> {
		await this.sendNotification(
			{
				userId,
				title: `Tin nhắn mới từ ${senderName}`,
				message: preview,
				type: 'message',
				data: { conversationId, senderName },
				channels: ['push', 'in-app'],
			},
			1, // High priority for messages
		);
	}

	/**
	 * Send rating notification
	 */
	async sendRatingNotification(
		userId: string,
		rating: number,
		comment: string,
		reviewerName: string,
	): Promise<void> {
		await this.sendNotification({
			userId,
			title: 'Đánh giá mới',
			message: `${reviewerName} đã đánh giá bạn ${rating} sao${comment ? `: "${comment.substring(0, 50)}..."` : ''}`,
			type: 'rating',
			data: { rating, reviewerName },
			channels: ['push', 'in-app'],
		});
	}

	/**
	 * Send payment notification
	 */
	async sendPaymentNotification(
		userId: string,
		status: 'success' | 'failed',
		amount: number,
		billId: string,
	): Promise<void> {
		const message =
			status === 'success'
				? `Thanh toán ${amount.toLocaleString('vi-VN')}đ thành công`
				: `Thanh toán ${amount.toLocaleString('vi-VN')}đ thất bại`;

		await this.sendNotification({
			userId,
			title: 'Thông báo thanh toán',
			message,
			type: 'payment',
			data: { billId, amount, status },
			channels: ['push', 'in-app', 'email'],
		});
	}

	/**
	 * Bulk send notifications
	 */
	async sendBulkNotifications(notifications: NotificationJobData[]): Promise<void> {
		const jobs = notifications.map((data) => ({
			name: 'send-notification',
			data,
		}));

		await this.notificationQueue.addBulk(jobs);
		this.logger.log(`Bulk notifications queued: ${notifications.length} items`);
	}

	/**
	 * Get queue stats
	 */
	async getQueueStats() {
		const [waiting, active, completed, failed, delayed] = await Promise.all([
			this.notificationQueue.getWaitingCount(),
			this.notificationQueue.getActiveCount(),
			this.notificationQueue.getCompletedCount(),
			this.notificationQueue.getFailedCount(),
			this.notificationQueue.getDelayedCount(),
		]);

		return {
			waiting,
			active,
			completed,
			failed,
			delayed,
			total: waiting + active + completed + failed + delayed,
		};
	}
}
