import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationJobData } from '../services/notification-queue.service';

@Processor('notification-queue')
export class NotificationQueueProcessor {
	private readonly logger = new Logger(NotificationQueueProcessor.name);

	@Process('send-notification')
	async processNotification(job: Job<NotificationJobData>) {
		this.logger.debug(
			`Processing notification: ${job.data.type} for user ${job.data.userId} (Attempt: ${job.attemptsMade + 1})`,
		);

		try {
			const { userId, title, message, type, data, channels = ['in-app'] } = job.data;

			// Process each channel
			const results = await Promise.allSettled(
				channels.map((channel) => this.sendToChannel(channel, job.data)),
			);

			// Check if at least one channel succeeded
			const hasSuccess = results.some((r) => r.status === 'fulfilled');

			if (!hasSuccess) {
				throw new Error('All notification channels failed');
			}

			this.logger.log(`✅ Notification sent to user ${userId} via ${channels.join(', ')}`);

			return { success: true, userId, channels, results };
		} catch (error) {
			this.logger.error(`❌ Failed to send notification: ${error.message}`, error.stack);
			throw error; // Will trigger retry
		}
	}

	/**
	 * Send notification to specific channel
	 */
	private async sendToChannel(
		channel: 'push' | 'in-app' | 'email',
		data: NotificationJobData,
	): Promise<void> {
		switch (channel) {
			case 'push':
				return this.sendPushNotification(data);
			case 'in-app':
				return this.sendInAppNotification(data);
			case 'email':
				return this.sendEmailNotification(data);
			default:
				throw new Error(`Unknown notification channel: ${channel}`);
		}
	}

	/**
	 * Send push notification (FCM, APNs, etc.)
	 */
	private async sendPushNotification(data: NotificationJobData): Promise<void> {
		this.logger.debug(`📱 Sending push notification to user ${data.userId}`);

		// TODO: Integrate with FCM/APNs
		// const messaging = getMessaging();
		// await messaging.send({
		//   token: userDeviceToken,
		//   notification: {
		//     title: data.title,
		//     body: data.message,
		//   },
		//   data: data.data,
		// });

		// Simulate push send
		await new Promise((resolve) => setTimeout(resolve, 300));
		this.logger.debug(`✅ Push notification sent to user ${data.userId}`);
	}

	/**
	 * Save in-app notification to database
	 */
	private async sendInAppNotification(data: NotificationJobData): Promise<void> {
		this.logger.debug(`🔔 Creating in-app notification for user ${data.userId}`);

		// TODO: Save to Notifications table
		// await this.prisma.notification.create({
		//   data: {
		//     userId: data.userId,
		//     title: data.title,
		//     message: data.message,
		//     type: data.type,
		//     data: data.data,
		//     isRead: false,
		//   },
		// });

		// Simulate DB save
		await new Promise((resolve) => setTimeout(resolve, 200));

		// TODO: Emit real-time event via WebSocket
		// this.eventEmitter.emit('notification.created', {
		//   userId: data.userId,
		//   notification: {...},
		// });

		this.logger.debug(`✅ In-app notification saved for user ${data.userId}`);
	}

	/**
	 * Send email notification
	 */
	private async sendEmailNotification(data: NotificationJobData): Promise<void> {
		this.logger.debug(`📧 Sending email notification to user ${data.userId}`);

		// TODO: Queue email or send directly
		// await this.emailService.send({
		//   to: userEmail,
		//   subject: data.title,
		//   text: data.message,
		// });

		// Simulate email send
		await new Promise((resolve) => setTimeout(resolve, 400));
		this.logger.debug(`✅ Email notification sent to user ${data.userId}`);
	}
}
