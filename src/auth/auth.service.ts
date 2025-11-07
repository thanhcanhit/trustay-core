import * as crypto from 'node:crypto';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { PreRegisterDto } from './dto/pre-register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from './services/email.service';
import { PasswordService } from './services/password.service';
import { SmsService } from './services/sms.service';
import { VerificationService } from './services/verification.service';

const EMAIL_IDENTIFIER_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_USER_SELECT = {
	id: true,
	email: true,
	phone: true,
	firstName: true,
	lastName: true,
	avatarUrl: true,
	dateOfBirth: true,
	gender: true,
	role: true,
	bio: true,
	idCardNumber: true,
	bankAccount: true,
	bankName: true,
	isVerifiedPhone: true,
	isVerifiedEmail: true,
	isVerifiedIdentity: true,
	isVerifiedBank: true,
	overallRating: true,
	totalRatings: true,
	lastActiveAt: true,
	createdAt: true,
	updatedAt: true,
} as const;

const LOGIN_USER_SELECT = {
	...AUTH_USER_SELECT,
	passwordHash: true,
} as const;

type LoginUser = Prisma.UserGetPayload<{ select: typeof LOGIN_USER_SELECT }>;

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly passwordService: PasswordService,
		private readonly verificationService: VerificationService,
		private readonly emailService: EmailService,
		private readonly smsService: SmsService,
		private readonly logger: LoggerService,
	) {}

	private normalizeEmailIdentifier(identifier: string): string {
		return identifier.trim().toLowerCase();
	}

	private normalizePhoneIdentifier(identifier: string): string {
		const stripped = identifier.replace(/[\s()-]/g, '');
		if (stripped.startsWith('00')) {
			return `+${stripped.slice(2)}`;
		}
		return stripped;
	}

	private isEmailIdentifier(identifier: string): boolean {
		return EMAIL_IDENTIFIER_REGEX.test(identifier);
	}

	private async findLoginUser(identifier: string): Promise<LoginUser | null> {
		const trimmedIdentifier = identifier.trim();
		if (!trimmedIdentifier) {
			return null;
		}
		if (this.isEmailIdentifier(trimmedIdentifier)) {
			const normalizedEmail = this.normalizeEmailIdentifier(trimmedIdentifier);
			return this.prisma.user.findFirst({
				where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
				select: LOGIN_USER_SELECT,
			});
		}
		const normalizedPhone = this.normalizePhoneIdentifier(trimmedIdentifier);
		return this.prisma.user.findFirst({
			where: { phone: normalizedPhone },
			select: LOGIN_USER_SELECT,
		});
	}

	private transformUserResponse(user: any): any {
		return {
			...user,
			overallRating: user.overallRating ? parseFloat(user.overallRating.toString()) : 0,
		};
	}

	async preRegister(
		preRegisterDto: PreRegisterDto,
		verificationToken: string,
	): Promise<AuthResponseDto> {
		// Validate verification token
		const tokenValidation =
			await this.verificationService.validateVerificationToken(verificationToken);
		if (!tokenValidation.isValid) {
			throw new UnauthorizedException(
				'Invalid or expired verification token. Please verify your email/phone again.',
			);
		}

		// Check that the email/phone matches the verified one
		if (tokenValidation.email && tokenValidation.email !== preRegisterDto.email) {
			throw new BadRequestException('Email does not match the verified email');
		}

		if (tokenValidation.phone && tokenValidation.phone !== preRegisterDto.phone) {
			throw new BadRequestException('Phone does not match the verified phone');
		}

		// Ensure required verification is done
		if (!tokenValidation.email && !tokenValidation.phone) {
			throw new BadRequestException('Either email or phone must be verified');
		}
		// Check if email already exists (double check)
		const existingUserByEmail = await this.prisma.user.findUnique({
			where: { email: preRegisterDto.email },
		});

		if (existingUserByEmail) {
			throw new ConflictException('Email is already in use');
		}

		// Check if phone already exists (if provided)
		if (preRegisterDto.phone) {
			const existingUserByPhone = await this.prisma.user.findUnique({
				where: { phone: preRegisterDto.phone },
			});

			if (existingUserByPhone) {
				throw new ConflictException('Phone number is already in use');
			}
		}

		// Validate password strength
		const passwordValidation = this.passwordService.validatePasswordStrength(
			preRegisterDto.password,
		);
		if (!passwordValidation.isValid) {
			throw new BadRequestException({
				message: 'Password does not meet security requirements',
				errors: passwordValidation.errors,
				score: passwordValidation.score,
			});
		}

		// Hash password
		const hashedPassword = await this.passwordService.hashPassword(preRegisterDto.password);

		// Create user with verified email/phone
		const user = await this.prisma.user.create({
			data: {
				email: preRegisterDto.email,
				passwordHash: hashedPassword,
				firstName: preRegisterDto.firstName,
				lastName: preRegisterDto.lastName,
				phone: preRegisterDto.phone,
				gender: preRegisterDto.gender,
				role: preRegisterDto.role,
				// Set verification status based on what was verified
				isVerifiedEmail: !!tokenValidation.email,
				isVerifiedPhone: !!tokenValidation.phone,
			},
			select: {
				id: true,
				email: true,
				phone: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				dateOfBirth: true,
				gender: true,
				role: true,
				bio: true,
				idCardNumber: true,
				bankAccount: true,
				bankName: true,
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				isVerifiedIdentity: true,
				isVerifiedBank: true,
				overallRating: true,
				totalRatings: true,
				lastActiveAt: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		// Send welcome email if email was verified
		if (tokenValidation.email) {
			this.emailService.sendWelcomeEmail(user.email, user.firstName).catch((error) => {
				this.logger.error('Failed to send welcome email', error.stack, 'Auth');
			});
		}

		// Send welcome SMS if phone was verified (temporarily disabled)
		if (tokenValidation.phone && user.phone) {
			this.logger.log(
				`SMS Disabled - Would send welcome SMS to ${user.phone} for ${user.firstName}`,
				'Auth',
			);
			// this.smsService.sendWelcomeSms(user.phone, user.firstName)
			// 	.catch((error) => this.logger.error('Failed to send welcome SMS', error.stack, 'Auth'));
		}

		// Clean up used verification records to prevent reuse
		if (tokenValidation.email) {
			await this.prisma.verificationCode.deleteMany({
				where: {
					email: tokenValidation.email,
					type: 'email',
				},
			});
		}
		if (tokenValidation.phone) {
			await this.prisma.verificationCode.deleteMany({
				where: {
					phone: tokenValidation.phone,
					type: 'phone',
				},
			});
		}

		// Generate JWT token and refresh token
		this.logger.logAuthEvent('User pre-registered successfully', user.id, {
			email: user.email,
			role: user.role,
			isVerifiedEmail: user.isVerifiedEmail,
			isVerifiedPhone: user.isVerifiedPhone,
		});
		const payload = { sub: user.id, email: user.email, role: user.role };
		const access_token = this.jwtService.sign(payload);
		const refresh_token = await this.generateRefreshToken(user.id);

		return {
			access_token,
			user: this.transformUserResponse(user),
			token_type: 'Bearer',
			expires_in: this.configService.get<number>('JWT_EXPIRES_IN') || 3600,
			refresh_token,
		};
	}

	// Fallback registration without verification (for development/testing)
	async registerDirectly(registerDto: RegisterDto): Promise<AuthResponseDto> {
		// Check environment - only allow in development
		const nodeEnv = this.configService.get<string>('NODE_ENV');
		const allowDirectRegistration = this.configService.get<boolean>('ALLOW_DIRECT_REGISTRATION');

		if (nodeEnv === 'production' && !allowDirectRegistration) {
			throw new BadRequestException(
				'Direct registration is not allowed in production. Please use email/phone verification flow.',
			);
		}

		// Check if email already exists
		const existingUser = await this.prisma.user.findUnique({
			where: { email: registerDto.email },
		});

		if (existingUser) {
			throw new ConflictException('Email is already in use');
		}

		// Check if phone already exists (if provided)
		if (registerDto.phone) {
			const existingPhone = await this.prisma.user.findUnique({
				where: { phone: registerDto.phone },
			});

			if (existingPhone) {
				throw new ConflictException('Phone number is already in use');
			}
		}

		// Validate password strength
		const passwordValidation = this.passwordService.validatePasswordStrength(registerDto.password);
		if (!passwordValidation.isValid) {
			throw new BadRequestException({
				message: 'Password does not meet security requirements',
				errors: passwordValidation.errors,
				score: passwordValidation.score,
			});
		}

		// Hash password
		const hashedPassword = await this.passwordService.hashPassword(registerDto.password);

		// Create user (without verification in development)
		const user = await this.prisma.user.create({
			data: {
				email: registerDto.email,
				passwordHash: hashedPassword,
				firstName: registerDto.firstName,
				lastName: registerDto.lastName,
				phone: registerDto.phone,
				gender: registerDto.gender,
				role: registerDto.role,
				// In development, mark as verified if email is provided
				isVerifiedEmail: nodeEnv === 'development',
				isVerifiedPhone: nodeEnv === 'development' && !!registerDto.phone,
			},
			select: {
				id: true,
				email: true,
				phone: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				dateOfBirth: true,
				gender: true,
				role: true,
				bio: true,
				idCardNumber: true,
				bankAccount: true,
				bankName: true,
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				isVerifiedIdentity: true,
				isVerifiedBank: true,
				overallRating: true,
				totalRatings: true,
				lastActiveAt: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		// Send welcome email if not in test mode
		if (nodeEnv !== 'test') {
			this.emailService.sendWelcomeEmail(user.email, user.firstName).catch((error) => {
				this.logger.error('Failed to send welcome email', error.stack, 'Auth');
			});
		}

		// Clean up any existing verification records for this email/phone
		await this.prisma.verificationCode.deleteMany({
			where: {
				OR: [
					{ email: registerDto.email },
					...(registerDto.phone ? [{ phone: registerDto.phone }] : []),
				],
			},
		});

		// Generate JWT token and refresh token
		const payload = { sub: user.id, email: user.email, role: user.role };
		const access_token = this.jwtService.sign(payload);
		const refresh_token = await this.generateRefreshToken(user.id);

		return {
			access_token,
			user: this.transformUserResponse(user),
			token_type: 'Bearer',
			expires_in: this.configService.get<number>('JWT_EXPIRES_IN') || 3600,
			refresh_token,
		};
	}

	async login(loginDto: LoginDto): Promise<AuthResponseDto> {
		// Priority: identifier > email
		const identifier = loginDto.identifier?.trim() || loginDto.email?.trim();
		if (!identifier) {
			throw new BadRequestException('Either identifier or email must be provided');
		}
		const user = await this.findLoginUser(identifier);
		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}
		const isPasswordValid = await this.passwordService.comparePassword(
			loginDto.password,
			user.passwordHash,
		);
		if (!isPasswordValid) {
			throw new UnauthorizedException('Invalid credentials');
		}
		const needsRehash = await this.passwordService.needsRehash(user.passwordHash);
		if (needsRehash) {
			const newHashedPassword = await this.passwordService.hashPassword(loginDto.password);
			await this.prisma.user.update({
				where: { id: user.id },
				data: { passwordHash: newHashedPassword },
			});
		}
		await this.prisma.user.update({
			where: { id: user.id },
			data: { lastActiveAt: new Date() },
		});
		const identifierType = this.isEmailIdentifier(identifier) ? 'email' : 'phone';
		this.logger.logAuthEvent('User logged in successfully', user.id, {
			email: user.email,
			phone: user.phone,
			role: user.role,
			needsRehash,
			identifierType,
		});
		const payload = { sub: user.id, email: user.email, role: user.role };
		const access_token = this.jwtService.sign(payload);
		const refresh_token = await this.generateRefreshToken(user.id);
		const { passwordHash: _passwordHash, ...userResponse } = user;
		return {
			access_token,
			user: this.transformUserResponse(userResponse),
			token_type: 'Bearer',
			expires_in: this.configService.get<number>('JWT_EXPIRES_IN') || 3600,
			refresh_token,
		};
	}

	async validateUser(identifier: string, password: string): Promise<any> {
		const user = await this.findLoginUser(identifier);
		if (!user) {
			return null;
		}
		const isPasswordValid = await this.passwordService.comparePassword(password, user.passwordHash);
		if (!isPasswordValid) {
			return null;
		}
		const { passwordHash: _passwordHash, ...result } = user;
		return result;
	}

	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
	): Promise<{ message: string }> {
		// Get user with password hash
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, passwordHash: true },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Verify current password
		const isCurrentPasswordValid = await this.passwordService.comparePassword(
			currentPassword,
			user.passwordHash,
		);
		if (!isCurrentPasswordValid) {
			throw new UnauthorizedException('Current password is incorrect');
		}

		// Validate new password strength
		const passwordValidation = this.passwordService.validatePasswordStrength(newPassword);
		if (!passwordValidation.isValid) {
			throw new BadRequestException({
				message: 'New password does not meet security requirements',
				errors: passwordValidation.errors,
				score: passwordValidation.score,
			});
		}

		// Hash new password
		const hashedNewPassword = await this.passwordService.hashPassword(newPassword);

		// Update password in database
		await this.prisma.user.update({
			where: { id: userId },
			data: {
				passwordHash: hashedNewPassword,
				updatedAt: new Date(),
			},
		});

		this.logger.logSecurityEvent('Password changed successfully', { userId });

		return { message: 'Password changed successfully' };
	}

	async checkPasswordStrength(password: string) {
		const validation = this.passwordService.validatePasswordStrength(password);

		// Determine strength level based on score
		let level = 'Very Weak';
		if (validation.score >= 80) {
			level = 'Strong';
		} else if (validation.score >= 60) {
			level = 'Good';
		} else if (validation.score >= 40) {
			level = 'Fair';
		} else if (validation.score >= 20) {
			level = 'Weak';
		}

		return {
			...validation,
			level,
		};
	}

	async generateSecurePassword(length: number = 12): Promise<{ password: string; strength: any }> {
		const password = this.passwordService.generateSecurePassword(length);
		const strength = await this.checkPasswordStrength(password);

		return {
			password,
			strength,
		};
	}

	private async generateRefreshToken(userId: string): Promise<string> {
		const refreshToken = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

		// Clean up existing refresh tokens for this user (optional - allow multiple sessions)
		await this.prisma.refreshToken.deleteMany({
			where: { userId },
		});

		// Create new refresh token
		await this.prisma.refreshToken.create({
			data: {
				userId,
				token: refreshToken,
				expiresAt,
			},
		});

		return refreshToken;
	}

	async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
		const { refreshToken } = refreshTokenDto;

		// Find the refresh token
		const tokenRecord = await this.prisma.refreshToken.findUnique({
			where: { token: refreshToken },
			include: {
				user: {
					select: {
						id: true,
						email: true,
						phone: true,
						firstName: true,
						lastName: true,
						avatarUrl: true,
						dateOfBirth: true,
						gender: true,
						role: true,
						bio: true,
						idCardNumber: true,
						bankAccount: true,
						bankName: true,
						isVerifiedPhone: true,
						isVerifiedEmail: true,
						isVerifiedIdentity: true,
						isVerifiedBank: true,
						overallRating: true,
						totalRatings: true,
						lastActiveAt: true,
						createdAt: true,
						updatedAt: true,
					},
				},
			},
		});

		if (!tokenRecord) {
			throw new UnauthorizedException('Invalid refresh token');
		}

		// Check if token is expired
		if (tokenRecord.expiresAt < new Date()) {
			// Remove expired token
			await this.prisma.refreshToken.delete({
				where: { id: tokenRecord.id },
			});
			throw new UnauthorizedException('Refresh token has expired');
		}

		// Generate new access token
		const payload = {
			sub: tokenRecord.user.id,
			email: tokenRecord.user.email,
			role: tokenRecord.user.role,
		};
		const access_token = this.jwtService.sign(payload);

		// Generate new refresh token
		const new_refresh_token = await this.generateRefreshToken(tokenRecord.user.id);

		// Update user's last active timestamp
		await this.prisma.user.update({
			where: { id: tokenRecord.user.id },
			data: { lastActiveAt: new Date() },
		});

		return {
			access_token,
			user: this.transformUserResponse(tokenRecord.user),
			token_type: 'Bearer',
			expires_in: this.configService.get<number>('JWT_EXPIRES_IN') || 3600,
			refresh_token: new_refresh_token,
		};
	}

	async revokeRefreshToken(refreshToken: string): Promise<{ message: string }> {
		const tokenRecord = await this.prisma.refreshToken.findUnique({
			where: { token: refreshToken },
		});

		if (!tokenRecord) {
			throw new NotFoundException('Refresh token not found');
		}

		await this.prisma.refreshToken.delete({
			where: { id: tokenRecord.id },
		});

		return { message: 'Refresh token revoked successfully' };
	}

	async revokeAllRefreshTokens(userId: string): Promise<{ message: string }> {
		await this.prisma.refreshToken.deleteMany({
			where: { userId },
		});

		return { message: 'All refresh tokens revoked successfully' };
	}
}
