import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailJobData } from '../services/email-queue.service';

@Processor('email-queue')
export class EmailQueueProcessor {
	private readonly logger = new Logger(EmailQueueProcessor.name);

	@Process()
	async processEmail(job: Job<EmailJobData>) {
		this.logger.debug(
			`Processing email job: ${job.name} (ID: ${job.id}, Attempt: ${job.attemptsMade + 1})`,
		);

		try {
			const { to, subject, template, context, html, text } = job.data;

			// TODO: Integrate with actual email service (Resend, SendGrid, etc.)
			// For now, just log
			this.logger.log(`📧 Sending email to ${to}`);
			this.logger.debug(`Subject: ${subject}`);

			if (template) {
				this.logger.debug(`Template: ${template}, Context:`, context);
			} else if (html) {
				this.logger.debug(`HTML content: ${html.substring(0, 100)}...`);
			} else if (text) {
				this.logger.debug(`Text content: ${text.substring(0, 100)}...`);
			}

			// Simulate email sending
			await this.simulateEmailSend(to, subject);

			this.logger.log(`✅ Email sent successfully to ${to}`);

			return { success: true, to, subject };
		} catch (error) {
			this.logger.error(`❌ Failed to send email: ${error.message}`, error.stack);
			throw error; // Will trigger retry
		}
	}

	/**
	 * Simulate email sending (replace with actual service)
	 */
	private async simulateEmailSend(to: string, subject: string): Promise<void> {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Simulate occasional failures for testing retry logic
		if (Math.random() < 0.1) {
			// 10% failure rate for testing
			throw new Error('Simulated email service error');
		}

		// TODO: Replace with actual email service
		// Example with Resend:
		// const resend = new Resend(process.env.RESEND_API_KEY);
		// await resend.emails.send({
		//   from: 'noreply@trustay.com',
		//   to,
		//   subject,
		//   html: renderTemplate(template, context),
		// });
	}
}
