import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { VerificationStatus, VerificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

export interface VerificationTokenPayload {
	email?: string;
	phone?: string;
	type: VerificationType;
	iat: number;
	exp: number;
}

export interface VerificationValidationResult {
	isValid: boolean;
	email?: string;
	phone?: string;
	type?: VerificationType;
}

@Injectable()
export class VerificationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly emailService: EmailService,
		private readonly smsService: SmsService,
	) {}

	/**
	 * Send verification code to email or phone
	 */
	async sendVerificationCode(
		type: VerificationType,
		email?: string,
		phone?: string,
	): Promise<{
		message: string;
		verificationId: string;
		expiresInMinutes: number;
		remainingAttempts: number;
	}> {
		if (type === 'email' && !email) {
			throw new BadRequestException('Email is required for email verification');
		}
		if (type === 'phone' && !phone) {
			throw new BadRequestException('Phone is required for phone verification');
		}

		// Check if user already exists
		if (email) {
			const existingUser = await this.prisma.user.findUnique({ where: { email } });
			if (existingUser) {
				throw new BadRequestException('Email is already registered');
			}
		}
		if (phone) {
			const existingUser = await this.prisma.user.findUnique({ where: { phone } });
			if (existingUser) {
				throw new BadRequestException('Phone number is already registered');
			}
		}

		// Check rate limiting
		await this.checkRateLimit(type, email, phone);

		// Generate 6-digit code
		const code = this.generateVerificationCode();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

		// Save verification code to database
		const verification = await this.prisma.verificationCode.create({
			data: {
				email,
				phone,
				type,
				code,
				status: VerificationStatus.pending,
				expiresAt,
				attempts: 0,
				maxAttempts: 5,
			},
		});

		// Send verification code
		if (type === 'email' && email) {
			await this.emailService.sendVerificationEmail(email, code);
		} else if (type === 'phone' && phone) {
			await this.smsService.sendVerificationSms(phone, code);
		}

		return {
			message: `Verification code sent to ${type} successfully`,
			verificationId: verification.id,
			expiresInMinutes: 5,
			remainingAttempts: 5,
		};
	}

	/**
	 * Verify the code and return a verification token
	 */
	async verifyCode(
		type: VerificationType,
		email: string | undefined,
		phone: string | undefined,
		code: string,
	): Promise<{
		message: string;
		canProceedToRegister: boolean;
		verificationToken: string;
	}> {
		// Find pending verification
		const verification = await this.prisma.verificationCode.findFirst({
			where: {
				type,
				email,
				phone,
				status: VerificationStatus.pending,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: 'desc' },
		});

		if (!verification) {
			throw new BadRequestException('No valid verification code found. Please request a new code.');
		}

		// Check attempts
		if (verification.attempts >= verification.maxAttempts) {
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: { status: VerificationStatus.failed },
			});
			throw new BadRequestException(
				'Maximum verification attempts exceeded. Please request a new code.',
			);
		}

		// Increment attempts
		await this.prisma.verificationCode.update({
			where: { id: verification.id },
			data: { attempts: verification.attempts + 1 },
		});

		// Check code
		if (verification.code !== code) {
			const remainingAttempts = verification.maxAttempts - verification.attempts - 1;
			throw new BadRequestException(
				`Invalid verification code. ${remainingAttempts} attempts remaining.`,
			);
		}

		// Mark as verified
		await this.prisma.verificationCode.update({
			where: { id: verification.id },
			data: {
				status: VerificationStatus.verified,
				verifiedAt: new Date(),
			},
		});

		// Generate verification token (short-lived, 10 minutes)
		const tokenPayload: Partial<VerificationTokenPayload> = {
			type,
			...(email && { email }),
			...(phone && { phone }),
		};

		const verificationToken = this.jwtService.sign(tokenPayload, { expiresIn: '10m' });

		return {
			message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully`,
			canProceedToRegister: true,
			verificationToken,
		};
	}

	/**
	 * Validate verification token
	 */
	async validateVerificationToken(token: string): Promise<VerificationValidationResult> {
		try {
			const payload = this.jwtService.verify<VerificationTokenPayload>(token);

			// Check if token is from verification flow
			if (!payload.type || !['email', 'phone'].includes(payload.type)) {
				return { isValid: false };
			}

			return {
				isValid: true,
				email: payload.email,
				phone: payload.phone,
				type: payload.type,
			};
		} catch (error) {
			return { isValid: false };
		}
	}

	/**
	 * Generate 6-digit verification code
	 */
	private generateVerificationCode(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	/**
	 * Check rate limiting for verification requests
	 */
	private async checkRateLimit(
		type: VerificationType,
		email?: string,
		phone?: string,
	): Promise<void> {
		const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

		const recentRequest = await this.prisma.verificationCode.findFirst({
			where: {
				type,
				email,
				phone,
				createdAt: { gt: oneMinuteAgo },
			},
		});

		if (recentRequest) {
			throw new BadRequestException(
				'Please wait 1 minute before requesting another verification code',
			);
		}
	}

	/**
	 * Clean up expired verification codes (can be called by a cron job)
	 */
	async cleanupExpiredCodes(): Promise<void> {
		const now = new Date();
		await this.prisma.verificationCode.deleteMany({
			where: {
				OR: [
					{ expiresAt: { lt: now } },
					{ status: VerificationStatus.verified },
					{ status: VerificationStatus.failed },
				],
			},
		});
	}
}
