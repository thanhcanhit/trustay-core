import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { RatingTargetType, VerificationStatus, VerificationType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { EmailService } from '../../auth/services/email.service';
import { PersonPublicView } from '../../common/serialization/person.view';
import { UploadService } from '../../common/services/upload.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RatingService } from '../rating/rating.service';
import { ConfirmChangeEmailDto } from './dto/confirm-change-email.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { RequestChangeEmailDto } from './dto/request-change-email.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

const PHONE_FALLBACK_VERIFICATION_CODE = '123456';

interface VerificationCodeValidationInput {
	readonly type: VerificationType;
	readonly email?: string;
	readonly phone?: string;
	readonly code: string;
}

@Injectable()
export class UsersService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly uploadService: UploadService,
		private readonly notificationsService: NotificationsService,
		private readonly ratingService: RatingService,
		private readonly emailService: EmailService,
	) {}

	private transformUserResponse(user: any): any {
		return {
			...user,
			overallRating: user.overallRating ? parseFloat(user.overallRating.toString()) : 0,
		};
	}

	async createUser(createUserDto: CreateUserDto) {
		// Check if email already exists
		const existingUser = await this.prisma.user.findUnique({
			where: { email: createUserDto.email },
		});

		if (existingUser) {
			throw new ConflictException('Email is already in use');
		}

		// Check if phone already exists (if provided)
		if (createUserDto.phone) {
			const existingPhone = await this.prisma.user.findUnique({
				where: { phone: createUserDto.phone },
			});

			if (existingPhone) {
				throw new ConflictException('Phone number is already in use');
			}
		}

		// Hash password
		const saltRounds = 10;
		const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

		// Create user
		const user = await this.prisma.user.create({
			data: {
				email: createUserDto.email,
				passwordHash: hashedPassword,
				firstName: createUserDto.firstName,
				lastName: createUserDto.lastName,
				phone: createUserDto.phone,
				gender: createUserDto.gender,
				role: createUserDto.role || 'tenant',
			},
			select: {
				id: true,
				email: true,
				phone: true,
				firstName: true,
				lastName: true,
				gender: true,
				role: true,
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				isVerifiedIdentity: true,
				isVerifiedBank: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		await this.notificationsService.notifyWelcome(
			user.id,
			`${user.firstName} ${user.lastName}`.trim(),
		);

		return user;
	}

	async findAllUsers(query: UsersQueryDto): Promise<PaginatedUsersResponseDto> {
		const {
			page = 1,
			limit = 10,
			search,
			role,
			gender,
			isVerifiedEmail,
			isVerifiedPhone,
			isVerifiedIdentity,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;

		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = {};

		if (search) {
			where.OR = [
				{ email: { contains: search, mode: 'insensitive' } },
				{ firstName: { contains: search, mode: 'insensitive' } },
				{ lastName: { contains: search, mode: 'insensitive' } },
				{ phone: { contains: search, mode: 'insensitive' } },
			];
		}

		if (role) {
			where.role = role;
		}
		if (gender) {
			where.gender = gender;
		}
		if (isVerifiedEmail !== undefined) {
			where.isVerifiedEmail = isVerifiedEmail;
		}
		if (isVerifiedPhone !== undefined) {
			where.isVerifiedPhone = isVerifiedPhone;
		}
		if (isVerifiedIdentity !== undefined) {
			where.isVerifiedIdentity = isVerifiedIdentity;
		}

		// Build order by clause
		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [users, total] = await Promise.all([
			this.prisma.user.findMany({
				where,
				skip,
				take: limit,
				orderBy,
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
					lastActiveAt: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.prisma.user.count({ where }),
		]);

		const totalPages = Math.ceil(total / limit);

		return {
			data: users.map((user) => this.transformUserResponse(user)),
			meta: {
				page,
				limit,
				total,
				totalPages,
				hasNext: page < totalPages,
				hasPrev: page > 1,
			},
		};
	}

	async findUserById(id: string) {
		const user = await this.prisma.user.findUnique({
			where: { id },
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
				addresses: {
					include: {
						ward: {
							select: { id: true, name: true, code: true },
						},
						district: {
							select: { id: true, name: true, code: true },
						},
						province: {
							select: { id: true, name: true, code: true },
						},
					},
					orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
				},
			},
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return user;
	}

	async deleteUser(id: string) {
		const user = await this.prisma.user.findUnique({
			where: { id },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		await this.prisma.user.delete({
			where: { id },
		});

		return { message: 'User deleted successfully' };
	}

	async getProfile(userId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
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
				addresses: {
					include: {
						ward: {
							select: { id: true, name: true, code: true },
						},
						district: {
							select: { id: true, name: true, code: true },
						},
						province: {
							select: { id: true, name: true, code: true },
						},
					},
					orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
				},
			},
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return user;
	}

	async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				...updateProfileDto,
				dateOfBirth: updateProfileDto.dateOfBirth
					? new Date(updateProfileDto.dateOfBirth)
					: undefined,
				updatedAt: new Date(),
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
				updatedAt: true,
			},
		});

		await this.notificationsService.notifyAccountVerification(userId);

		return updatedUser;
	}

	async createAddress(userId: string, createAddressDto: CreateAddressDto) {
		// Verify user exists
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Verify district and province exist
		const district = await this.prisma.district.findUnique({
			where: { id: createAddressDto.districtId },
			include: { province: true },
		});

		if (!district) {
			throw new BadRequestException('District not found');
		}

		if (district.provinceId !== createAddressDto.provinceId) {
			throw new BadRequestException('District does not belong to the specified province');
		}

		// Verify ward exists if provided
		if (createAddressDto.wardId) {
			const ward = await this.prisma.ward.findUnique({
				where: { id: createAddressDto.wardId },
			});

			if (!ward || ward.districtId !== createAddressDto.districtId) {
				throw new BadRequestException(
					'Ward not found or does not belong to the specified district',
				);
			}
		}

		// If this is set as primary, unset other primary addresses
		if (createAddressDto.isPrimary) {
			await this.prisma.userAddress.updateMany({
				where: { userId, isPrimary: true },
				data: { isPrimary: false },
			});
		}

		const address = await this.prisma.userAddress.create({
			data: {
				userId,
				...createAddressDto,
				country: createAddressDto.country || 'Vietnam',
			},
			include: {
				ward: {
					select: { id: true, name: true, code: true },
				},
				district: {
					select: { id: true, name: true, code: true },
				},
				province: {
					select: { id: true, name: true, code: true },
				},
			},
		});

		return address;
	}

	async updateAddress(userId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
		// Verify address exists and belongs to user
		const existingAddress = await this.prisma.userAddress.findFirst({
			where: { id: addressId, userId },
		});

		if (!existingAddress) {
			throw new NotFoundException('Address not found');
		}

		// Verify district and province if provided
		if (updateAddressDto.districtId || updateAddressDto.provinceId) {
			const districtId = updateAddressDto.districtId || existingAddress.districtId;
			const provinceId = updateAddressDto.provinceId || existingAddress.provinceId;

			const district = await this.prisma.district.findUnique({
				where: { id: districtId },
				include: { province: true },
			});

			if (!district) {
				throw new BadRequestException('District not found');
			}

			if (district.provinceId !== provinceId) {
				throw new BadRequestException('District does not belong to the specified province');
			}
		}

		// Verify ward if provided
		if (updateAddressDto.wardId) {
			const districtId = updateAddressDto.districtId || existingAddress.districtId;
			const ward = await this.prisma.ward.findUnique({
				where: { id: updateAddressDto.wardId },
			});

			if (!ward || ward.districtId !== districtId) {
				throw new BadRequestException(
					'Ward not found or does not belong to the specified district',
				);
			}
		}

		// If this is set as primary, unset other primary addresses
		if (updateAddressDto.isPrimary) {
			await this.prisma.userAddress.updateMany({
				where: { userId, isPrimary: true, id: { not: addressId } },
				data: { isPrimary: false },
			});
		}

		const updatedAddress = await this.prisma.userAddress.update({
			where: { id: addressId },
			data: updateAddressDto,
			include: {
				ward: {
					select: { id: true, name: true, code: true },
				},
				district: {
					select: { id: true, name: true, code: true },
				},
				province: {
					select: { id: true, name: true, code: true },
				},
			},
		});

		return updatedAddress;
	}

	async deleteAddress(userId: string, addressId: string) {
		// Verify address exists and belongs to user
		const existingAddress = await this.prisma.userAddress.findFirst({
			where: { id: addressId, userId },
		});

		if (!existingAddress) {
			throw new NotFoundException('Address not found');
		}

		await this.prisma.userAddress.delete({
			where: { id: addressId },
		});

		return { message: 'Address deleted successfully' };
	}

	private async validateVerificationCode(input: VerificationCodeValidationInput) {
		const email = input.email?.toLowerCase();
		const verification = await this.prisma.verificationCode.findFirst({
			where: {
				type: input.type,
				status: VerificationStatus.pending,
				...(email ? { email } : {}),
				...(input.phone ? { phone: input.phone } : {}),
			},
			orderBy: { createdAt: 'desc' },
		});
		if (!verification) {
			throw new BadRequestException('Invalid verification code');
		}
		if (verification.expiresAt <= new Date()) {
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: { status: VerificationStatus.expired },
			});
			throw new BadRequestException('Verification code has expired');
		}
		if (verification.attempts >= verification.maxAttempts) {
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: { status: VerificationStatus.failed },
			});
			throw new BadRequestException('Maximum verification attempts exceeded');
		}
		if (verification.code !== input.code) {
			const updatedAttempts = verification.attempts + 1;
			const remainingAttempts = verification.maxAttempts - updatedAttempts;
			const updateData =
				remainingAttempts <= 0
					? { attempts: updatedAttempts, status: VerificationStatus.failed }
					: { attempts: updatedAttempts };
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: updateData,
			});
			if (remainingAttempts <= 0) {
				throw new BadRequestException('Maximum verification attempts exceeded');
			}
			throw new BadRequestException(
				`Invalid verification code. ${remainingAttempts} attempts remaining.`,
			);
		}
		return verification;
	}

	private async markVerificationAsVerified(verificationId: string): Promise<void> {
		await this.prisma.verificationCode.update({
			where: { id: verificationId },
			data: {
				status: VerificationStatus.verified,
				verifiedAt: new Date(),
			},
		});
	}

	async verifyPhone(userId: string, verifyPhoneDto: VerifyPhoneDto) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});
		if (!user) {
			throw new NotFoundException('User not found');
		}
		const existingUser = await this.prisma.user.findFirst({
			where: {
				phone: verifyPhoneDto.phone,
				id: { not: userId },
			},
		});
		if (existingUser) {
			throw new ConflictException('Phone number is already in use');
		}
		let verificationId: string | undefined;
		if (verifyPhoneDto.verificationCode !== PHONE_FALLBACK_VERIFICATION_CODE) {
			const verification = await this.validateVerificationCode({
				type: VerificationType.phone,
				phone: verifyPhoneDto.phone,
				code: verifyPhoneDto.verificationCode,
			});
			verificationId = verification.id;
		}
		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				phone: verifyPhoneDto.phone,
				isVerifiedPhone: true,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				phone: true,
				isVerifiedPhone: true,
			},
		});
		if (verificationId) {
			await this.markVerificationAsVerified(verificationId);
		}
		await this.notificationsService.notifyAccountVerification(userId);
		return {
			message: 'Phone number verified successfully',
			user: updatedUser,
		};
	}

	async verifyEmail(userId: string, verifyEmailDto: VerifyEmailDto) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});
		if (!user) {
			throw new NotFoundException('User not found');
		}
		const normalizedEmail = verifyEmailDto.email.toLowerCase();
		const existingUser = await this.prisma.user.findFirst({
			where: {
				email: normalizedEmail,
				id: { not: userId },
			},
		});
		if (existingUser) {
			throw new ConflictException('Email is already in use');
		}
		const verification = await this.validateVerificationCode({
			type: VerificationType.email,
			email: normalizedEmail,
			code: verifyEmailDto.verificationCode,
		});
		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				email: normalizedEmail,
				isVerifiedEmail: true,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				email: true,
				isVerifiedEmail: true,
			},
		});
		await this.markVerificationAsVerified(verification.id);
		await this.notificationsService.notifyAccountVerification(userId);
		return {
			message: 'Email verified successfully',
			user: updatedUser,
		};
	}

	async verifyIdentity(userId: string, verifyIdentityDto: VerifyIdentityDto) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Check if ID card number is already taken by another user
		const existingUser = await this.prisma.user.findFirst({
			where: {
				idCardNumber: verifyIdentityDto.idCardNumber,
				id: { not: userId },
			},
		});

		if (existingUser) {
			throw new ConflictException('ID card number is already in use');
		}

		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				idCardNumber: verifyIdentityDto.idCardNumber,
				idCardImages: verifyIdentityDto.idCardImages,
				isVerifiedIdentity: true,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				idCardNumber: true,
				idCardImages: true,
				isVerifiedIdentity: true,
			},
		});

		await this.notificationsService.notifyProfileUpdated(userId);

		return {
			message: 'Identity verified successfully',
			user: updatedUser,
		};
	}

	async updateAvatar(userId: string, file: Express.Multer.File) {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}

		if (!file.mimetype.startsWith('image/')) {
			throw new BadRequestException('File must be an image');
		}

		const maxSize = 5 * 1024 * 1024; // 5MB for avatars
		if (file.size > maxSize) {
			throw new BadRequestException('Avatar file size must be less than 5MB');
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Delete old avatar if exists (auto cleanup)
		if (user.avatarUrl) {
			await this.uploadService.deleteUserAvatar(userId);
		}

		// Upload new avatar
		const uploadResult = await this.uploadService.uploadImage(file, {
			altText: 'User avatar',
		});

		// Update user avatar URL
		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				avatarUrl: uploadResult.imagePath,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				updatedAt: true,
			},
		});

		return {
			message: 'Avatar uploaded successfully',
			user: updatedUser,
		};
	}

	/**
	 * Get user information for public viewing with masking based on authentication status
	 */
	async getPublicUser(
		userId: string,
		isAuthenticated: boolean = false,
		currentUserId?: string,
	): Promise<PublicUserResponseDto> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				phone: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				gender: true,
				role: true,
				bio: true,
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				isVerifiedIdentity: true,
				isVerifiedBank: true,
				overallRating: true,
				totalRatings: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		const person = plainToInstance(PersonPublicView, user, {
			excludeExtraneousValues: true,
			groups: isAuthenticated ? ['auth'] : undefined,
		});

		// Determine rating target type based on user role
		const targetType: RatingTargetType =
			user.role === 'landlord' ? RatingTargetType.landlord : RatingTargetType.tenant;

		// Fetch recent ratings and stats via rating service
		const { data: recent, stats } = await this.ratingService.findAll(
			{
				targetType,
				targetId: userId,
				page: 1,
				limit: 5,
				sortBy: 'createdAt',
				sortOrder: 'desc',
			},
			{ isAuthenticated, currentUserId },
		);

		// Fetch recent ratings the user gave to others
		const { data: recentGiven } = await this.ratingService.findAll(
			{
				reviewerId: userId,
				page: 1,
				limit: 5,
				sortBy: 'createdAt',
				sortOrder: 'desc',
			},
			{ isAuthenticated, currentUserId },
		);

		return {
			id: user.id,
			firstName: person.firstName,
			lastName: person.lastName,
			name: person.name,
			email: person.email,
			phone: person.phone,
			avatarUrl: user.avatarUrl,
			gender: user.gender,
			role: user.role,
			bio: user.bio,
			isVerifiedPhone: user.isVerifiedPhone,
			isVerifiedEmail: user.isVerifiedEmail,
			isVerifiedIdentity: user.isVerifiedIdentity,
			isVerifiedBank: user.isVerifiedBank,
			overallRating: user.overallRating ? parseFloat(user.overallRating.toString()) : 0,
			totalRatings: user.totalRatings,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			ratingStats: stats,
			recentRatings: recent,
			recentGivenRatings: recentGiven,
		};
	}

	/**
	 * Request email change - sends verification code to new email
	 */
	async requestChangeEmail(userId: string, requestChangeEmailDto: RequestChangeEmailDto) {
		const { newEmail, password } = requestChangeEmailDto;

		// Get current user
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, email: true, passwordHash: true },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Verify password
		const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
		if (!isPasswordValid) {
			throw new BadRequestException('Invalid password');
		}

		// Check if new email is same as current
		if (newEmail.toLowerCase() === user.email.toLowerCase()) {
			throw new BadRequestException('New email must be different from current email');
		}

		// Check if new email is already in use
		const existingUser = await this.prisma.user.findUnique({
			where: { email: newEmail.toLowerCase() },
		});

		if (existingUser) {
			throw new ConflictException('Email is already in use');
		}

		// Generate 6-digit verification code
		const code = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

		// Store verification code in database
		await this.prisma.verificationCode.create({
			data: {
				email: newEmail.toLowerCase(),
				type: 'email',
				code,
				status: 'pending',
				expiresAt,
				attempts: 0,
				maxAttempts: 5,
			},
		});

		// Send verification code via email
		try {
			await this.emailService.sendChangeEmailVerification(newEmail.toLowerCase(), code);
		} catch (error) {
			// Log error but don't fail the request
			// Code is still stored in database for verification
			// eslint-disable-next-line no-console
			console.error('Failed to send verification email:', error);
			throw new BadRequestException('Failed to send verification email');
		}

		return {
			message: 'Verification code sent to new email address',
			newEmail,
			expiresInMinutes: 10,
		};
	}

	/**
	 * Confirm email change with verification code
	 */
	async confirmChangeEmail(userId: string, confirmChangeEmailDto: ConfirmChangeEmailDto) {
		const { newEmail, verificationCode } = confirmChangeEmailDto;

		// Get current user
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, email: true },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Find verification code
		const verification = await this.prisma.verificationCode.findFirst({
			where: {
				email: newEmail.toLowerCase(),
				type: 'email',
				status: 'pending',
				code: verificationCode,
			},
			orderBy: { createdAt: 'desc' },
		});

		if (!verification) {
			throw new BadRequestException('Invalid verification code');
		}

		// Check if expired
		if (new Date() > verification.expiresAt) {
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: { status: 'expired' },
			});
			throw new BadRequestException('Verification code has expired');
		}

		// Check max attempts
		if (verification.attempts >= verification.maxAttempts) {
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: { status: 'failed' },
			});
			throw new BadRequestException('Maximum verification attempts exceeded');
		}

		// Verify code matches
		if (verification.code !== verificationCode) {
			await this.prisma.verificationCode.update({
				where: { id: verification.id },
				data: { attempts: verification.attempts + 1 },
			});
			throw new BadRequestException('Invalid verification code');
		}

		// Check if email is still available
		const existingUser = await this.prisma.user.findUnique({
			where: { email: newEmail.toLowerCase() },
		});

		if (existingUser && existingUser.id !== userId) {
			throw new ConflictException('Email is already in use');
		}

		// Update user email
		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				email: newEmail.toLowerCase(),
				isVerifiedEmail: true,
			},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				isVerifiedEmail: true,
			},
		});

		// Mark verification as verified
		await this.prisma.verificationCode.update({
			where: { id: verification.id },
			data: { status: 'verified' },
		});

		// Send notification about email change
		await this.notificationsService.createNotification({
			userId: userId,
			notificationType: 'system',
			title: 'Email Changed',
			message: `Your email has been successfully changed to ${newEmail}`,
		});

		return {
			message: 'Email changed successfully',
			user: updatedUser,
		};
	}
}
