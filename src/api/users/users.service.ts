import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

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

		if (role) where.role = role;
		if (gender) where.gender = gender;
		if (isVerifiedEmail !== undefined) where.isVerifiedEmail = isVerifiedEmail;
		if (isVerifiedPhone !== undefined) where.isVerifiedPhone = isVerifiedPhone;
		if (isVerifiedIdentity !== undefined) where.isVerifiedIdentity = isVerifiedIdentity;

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
			data: users,
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

	async verifyPhone(userId: string, verifyPhoneDto: VerifyPhoneDto) {
		// In a real application, you would verify the code against a sent SMS
		// For now, we'll simulate verification

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Check if phone number is already taken by another user
		const existingUser = await this.prisma.user.findFirst({
			where: {
				phone: verifyPhoneDto.phone,
				id: { not: userId },
			},
		});

		if (existingUser) {
			throw new ConflictException('Phone number is already in use');
		}

		// Simple verification code check (in production, use proper SMS verification)
		if (verifyPhoneDto.verificationCode !== '123456') {
			throw new BadRequestException('Invalid verification code');
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

		return {
			message: 'Phone number verified successfully',
			user: updatedUser,
		};
	}

	async verifyEmail(userId: string, verifyEmailDto: VerifyEmailDto) {
		// In a real application, you would verify the code against a sent email

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		// Check if email is already taken by another user
		const existingUser = await this.prisma.user.findFirst({
			where: {
				email: verifyEmailDto.email,
				id: { not: userId },
			},
		});

		if (existingUser) {
			throw new ConflictException('Email is already in use');
		}

		// Simple verification code check (in production, use proper email verification)
		if (verifyEmailDto.verificationCode !== '123456') {
			throw new BadRequestException('Invalid verification code');
		}

		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				email: verifyEmailDto.email,
				isVerifiedEmail: true,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				email: true,
				isVerifiedEmail: true,
			},
		});

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

		return {
			message: 'Identity verified successfully',
			user: updatedUser,
		};
	}
}
