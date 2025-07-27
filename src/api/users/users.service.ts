import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

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
