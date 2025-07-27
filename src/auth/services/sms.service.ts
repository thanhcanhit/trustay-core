import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
	constructor(private readonly configService: ConfigService) {}

	/**
	 * Send verification SMS code
	 */
	async sendVerificationSms(phone: string, code: string): Promise<boolean> {
		try {
			console.log(`[SMS] Sending verification code ${code} to ${phone}`);

			// TODO: Implement SMS provider (Twilio, AWS SNS, or Vietnamese provider)
			// For now, just log the message
			const message = `Mã xác thực Trustay của bạn là: ${code}. Mã có hiệu lực trong 5 phút.`;

			// Placeholder implementation
			await this.sendSmsMessage(phone, message);

			return true;
		} catch (error) {
			console.error('Failed to send verification SMS:', error);
			return false;
		}
	}

	/**
	 * Send welcome SMS to new user
	 */
	async sendWelcomeSms(phone: string, firstName: string): Promise<boolean> {
		try {
			const message = `Chào mừng ${firstName} đến với Trustay! Cảm ơn bạn đã đăng ký tài khoản.`;

			await this.sendSmsMessage(phone, message);

			return true;
		} catch (error) {
			console.error('Failed to send welcome SMS:', error);
			return false;
		}
	}

	/**
	 * Send password reset SMS
	 */
	async sendPasswordResetSms(phone: string, code: string): Promise<boolean> {
		try {
			const message = `Mã đặt lại mật khẩu Trustay: ${code}. Mã có hiệu lực trong 10 phút.`;

			await this.sendSmsMessage(phone, message);

			return true;
		} catch (error) {
			console.error('Failed to send password reset SMS:', error);
			return false;
		}
	}

	/**
	 * Generic SMS sending method - implement with actual SMS provider
	 */
	private async sendSmsMessage(phone: string, message: string): Promise<void> {
		const nodeEnv = this.configService.get<string>('NODE_ENV');

		// In development, just log the SMS
		if (nodeEnv === 'development') {
			console.log(`[SMS Development] To: ${phone}, Message: ${message}`);
			return;
		}

		// TODO: Implement actual SMS sending
		// Example with Twilio:
		/*
		const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
		const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
		const fromPhone = this.configService.get<string>('TWILIO_PHONE_NUMBER');
		
		const client = twilio(accountSid, authToken);
		
		await client.messages.create({
			body: message,
			from: fromPhone,
			to: phone,
		});
		*/

		// Example with AWS SNS:
		/*
		const sns = new AWS.SNS({
			region: this.configService.get<string>('AWS_REGION'),
			accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
			secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
		});

		await sns.publish({
			PhoneNumber: phone,
			Message: message,
		}).promise();
		*/

		// For now, just log
		console.log(`[SMS] Would send to ${phone}: ${message}`);
	}
}
