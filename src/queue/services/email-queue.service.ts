import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';

export interface EmailJobData {
	to: string;
	subject: string;
	template?: string;
	context?: Record<string, any>;
	html?: string;
	text?: string;
}

export interface VerificationEmailData {
	email: string;
	code: string;
	type: 'email' | 'phone' | 'password_reset';
	userName?: string;
}

export interface WelcomeEmailData {
	email: string;
	userName: string;
}

export interface BookingConfirmationData {
	email: string;
	userName: string;
	roomName: string;
	moveInDate: string;
	bookingId: string;
}

@Injectable()
export class EmailQueueService {
	private readonly logger = new Logger(EmailQueueService.name);

	constructor(@InjectQueue('email-queue') private emailQueue: Queue) {}

	/**
	 * Send verification code email
	 */
	async sendVerificationEmail(data: VerificationEmailData, priority = 1): Promise<void> {
		const jobData: EmailJobData = {
			to: data.email,
			subject: this.getVerificationSubject(data.type),
			template: 'verification-code',
			context: {
				code: data.code,
				userName: data.userName || data.email,
				type: data.type,
				expiresIn: '10 minutes',
			},
		};

		await this.addJob('verification-email', jobData, { priority });
		this.logger.log(`Verification email queued for ${data.email}`);
	}

	/**
	 * Send welcome email
	 */
	async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
		const jobData: EmailJobData = {
			to: data.email,
			subject: 'Chào mừng đến với Trustay!',
			template: 'welcome',
			context: {
				userName: data.userName,
			},
		};

		await this.addJob('welcome-email', jobData, { priority: 2 });
		this.logger.log(`Welcome email queued for ${data.email}`);
	}

	/**
	 * Send booking confirmation email
	 */
	async sendBookingConfirmation(data: BookingConfirmationData): Promise<void> {
		const jobData: EmailJobData = {
			to: data.email,
			subject: 'Xác nhận đặt phòng - Trustay',
			template: 'booking-confirmation',
			context: {
				userName: data.userName,
				roomName: data.roomName,
				moveInDate: data.moveInDate,
				bookingId: data.bookingId,
			},
		};

		await this.addJob('booking-confirmation', jobData, { priority: 1 });
		this.logger.log(`Booking confirmation email queued for ${data.email}`);
	}

	/**
	 * Send generic email
	 */
	async sendEmail(data: EmailJobData, jobName = 'generic-email'): Promise<void> {
		await this.addJob(jobName, data);
		this.logger.log(`Email queued: ${jobName} to ${data.to}`);
	}

	/**
	 * Add job to queue
	 */
	private async addJob(
		name: string,
		data: EmailJobData,
		opts?: { priority?: number; delay?: number },
	): Promise<void> {
		await this.emailQueue.add(name, data, {
			priority: opts?.priority || 3,
			delay: opts?.delay || 0,
		});
	}

	/**
	 * Get verification subject based on type
	 */
	private getVerificationSubject(type: string): string {
		switch (type) {
			case 'email':
				return 'Xác thực email - Trustay';
			case 'phone':
				return 'Xác thực số điện thoại - Trustay';
			case 'password_reset':
				return 'Đặt lại mật khẩu - Trustay';
			default:
				return 'Mã xác thực - Trustay';
		}
	}

	/**
	 * Get queue stats
	 */
	async getQueueStats() {
		const [waiting, active, completed, failed, delayed] = await Promise.all([
			this.emailQueue.getWaitingCount(),
			this.emailQueue.getActiveCount(),
			this.emailQueue.getCompletedCount(),
			this.emailQueue.getFailedCount(),
			this.emailQueue.getDelayedCount(),
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
