import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from '../../common/services/upload.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { UsersService } from './users.service';

// Mock external dependencies
jest.mock('../../prisma/prisma.service');
jest.mock('../../common/services/upload.service');
jest.mock('../notifications/notifications.service');

describe('UsersService', () => {
	let service: UsersService;
	let prismaService: PrismaService;
	let uploadService: UploadService;
	let notificationsService: NotificationsService;

	const mockPrismaService = {
		user: {
			create: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		address: {
			create: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		userAddress: {
			create: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
			delete: jest.fn(),
		},
		verification: {
			findFirst: jest.fn(),
			update: jest.fn(),
		},
		district: {
			findUnique: jest.fn(),
		},
		province: {
			findUnique: jest.fn(),
		},
	};

	const mockUploadService = {
		uploadImage: jest.fn().mockResolvedValue({
			imagePath: '/uploads/avatars/avatar-123.jpg',
			imageId: 'img-123',
		}),
		uploadMultipleImages: jest.fn(),
		deleteImage: jest.fn(),
		getImageUrl: jest.fn(),
	};

	const mockNotificationsService = {
		sendNotification: jest.fn(),
		notifyWelcome: jest.fn(),
		notifyProfileUpdated: jest.fn(),
		notifyAccountVerification: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UsersService,
				{
					provide: PrismaService,
					useValue: mockPrismaService,
				},
				{
					provide: UploadService,
					useValue: mockUploadService,
				},
				{
					provide: NotificationsService,
					useValue: mockNotificationsService,
				},
			],
		}).compile();

		service = module.get<UsersService>(UsersService);
		prismaService = module.get<PrismaService>(PrismaService);
		uploadService = module.get<UploadService>(UploadService);
		notificationsService = module.get<NotificationsService>(NotificationsService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('createUser', () => {
		it('should create a new user successfully', async () => {
			const createUserDto: CreateUserDto = {
				email: 'test@example.com',
				password: 'password123',
				firstName: 'John',
				lastName: 'Doe',
				phone: '+84901234567',
				gender: 'male',
				role: 'tenant',
			};

			const mockUser = {
				id: 'user-id-123',
				email: createUserDto.email,
				firstName: createUserDto.firstName,
				lastName: createUserDto.lastName,
				phone: createUserDto.phone,
				gender: createUserDto.gender,
				role: createUserDto.role,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPrismaService.user.create.mockResolvedValue(mockUser);

			const result = await service.createUser(createUserDto);

			expect(mockPrismaService.user.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					email: createUserDto.email,
					firstName: createUserDto.firstName,
					lastName: createUserDto.lastName,
					phone: createUserDto.phone,
					gender: createUserDto.gender,
					role: createUserDto.role,
				}),
				select: expect.any(Object),
			});

			expect(result).toEqual(mockUser);
		});

		it('should throw error if email already exists', async () => {
			const createUserDto: CreateUserDto = {
				email: 'existing@example.com',
				password: 'password123',
				firstName: 'John',
				lastName: 'Doe',
			};

			mockPrismaService.user.create.mockRejectedValue(
				new Error('Unique constraint failed on the constraint: `User_email_key`'),
			);

			await expect(service.createUser(createUserDto)).rejects.toThrow();
		});
	});

	describe('findAllUsers', () => {
		it('should return paginated users with default parameters', async () => {
			const query: UsersQueryDto = {};
			const mockUsers = [
				{
					id: 'user-1',
					email: 'user1@example.com',
					firstName: 'John',
					lastName: 'Doe',
					role: 'tenant',
					overallRating: 0,
				},
				{
					id: 'user-2',
					email: 'user2@example.com',
					firstName: 'Jane',
					lastName: 'Smith',
					role: 'landlord',
					overallRating: 0,
				},
			];

			mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
			mockPrismaService.user.count.mockResolvedValue(2);

			const result = await service.findAllUsers(query);

			expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 10,
				select: expect.any(Object),
			});

			expect(result).toEqual({
				data: mockUsers,
				meta: {
					page: 1,
					limit: 10,
					total: 2,
					totalPages: 1,
					hasNext: false,
					hasPrev: false,
				},
			});
		});

		it('should filter users by role', async () => {
			const query: UsersQueryDto = {
				role: 'tenant',
				page: 1,
				limit: 5,
			};

			const mockUsers = [
				{
					id: 'user-1',
					email: 'tenant@example.com',
					firstName: 'John',
					lastName: 'Doe',
					role: 'tenant',
				},
			];

			mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
			mockPrismaService.user.count.mockResolvedValue(1);

			const result = await service.findAllUsers(query);

			expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
				where: { role: 'tenant' },
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 5,
				select: expect.any(Object),
			});

			expect(result.data).toHaveLength(1);
			expect(result.data[0].role).toBe('tenant');
		});

		it('should search users by email, name, or phone', async () => {
			const query: UsersQueryDto = {
				search: 'john@example.com',
				page: 1,
				limit: 10,
			};

			const mockUsers = [
				{
					id: 'user-1',
					email: 'john@example.com',
					firstName: 'John',
					lastName: 'Doe',
				},
			];

			mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
			mockPrismaService.user.count.mockResolvedValue(1);

			await service.findAllUsers(query);

			expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
				where: {
					OR: [
						{ email: { contains: 'john@example.com', mode: 'insensitive' } },
						{ firstName: { contains: 'john@example.com', mode: 'insensitive' } },
						{ lastName: { contains: 'john@example.com', mode: 'insensitive' } },
						{ phone: { contains: 'john@example.com', mode: 'insensitive' } },
					],
				},
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 10,
				select: expect.any(Object),
			});
		});
	});

	describe('findUserById', () => {
		it('should return user by id', async () => {
			const userId = 'user-id-123';
			const mockUser = {
				id: userId,
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				role: 'tenant',
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.findUserById(userId);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: expect.any(Object),
			});

			expect(result).toEqual(mockUser);
		});

		it('should throw error if user not found', async () => {
			const userId = 'non-existent-id';

			mockPrismaService.user.findUnique.mockResolvedValue(null);

			await expect(service.findUserById(userId)).rejects.toThrow('User not found');
		});
	});

	describe('getProfile', () => {
		it('should return user profile with addresses', async () => {
			const userId = 'user-id-123';
			const mockUser = {
				id: userId,
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				role: 'tenant',
				addresses: [
					{
						id: 'addr-1',
						addressLine1: '123 Main St',
						isPrimary: true,
					},
				],
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getProfile(userId);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
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

			expect(result).toEqual(mockUser);
		});
	});

	describe('updateProfile', () => {
		it('should update user profile successfully', async () => {
			const userId = 'user-id-123';
			const updateProfileDto: UpdateProfileDto = {
				firstName: 'John Updated',
				lastName: 'Doe Updated',
				bio: 'Updated bio',
			};

			const mockUpdatedUser = {
				id: userId,
				firstName: updateProfileDto.firstName,
				lastName: updateProfileDto.lastName,
				bio: updateProfileDto.bio,
				updatedAt: new Date(),
			};

			mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
			mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

			const result = await service.updateProfile(userId, updateProfileDto);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
			});

			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { id: userId },
				data: {
					...updateProfileDto,
					dateOfBirth: undefined,
					updatedAt: expect.any(Date),
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

			expect(result).toEqual(mockUpdatedUser);
		});
	});

	describe('createAddress', () => {
		it('should create new address successfully', async () => {
			const userId = 'user-id-123';
			const createAddressDto: CreateAddressDto = {
				addressLine1: '123 Main Street',
				addressLine2: 'Apt 4B',
				districtId: 1,
				provinceId: 1,
				country: 'Vietnam',
				isPrimary: true,
			};

			const mockDistrict = {
				id: 1,
				name: 'District 1',
				provinceId: 1,
				province: {
					id: 1,
					name: 'Ho Chi Minh City',
				},
			};

			const mockAddress = {
				id: 'addr-123',
				userId,
				...createAddressDto,
				createdAt: new Date(),
			};

			mockPrismaService.district.findUnique.mockResolvedValue(mockDistrict);
			mockPrismaService.userAddress.updateMany.mockResolvedValue({ count: 0 });
			mockPrismaService.userAddress.create.mockResolvedValue(mockAddress);

			const result = await service.createAddress(userId, createAddressDto);

			expect(mockPrismaService.district.findUnique).toHaveBeenCalledWith({
				where: { id: createAddressDto.districtId },
				include: { province: true },
			});

			expect(mockPrismaService.userAddress.create).toHaveBeenCalledWith({
				data: {
					...createAddressDto,
					userId,
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

			expect(result).toEqual(mockAddress);
		});
	});

	describe('verifyPhone', () => {
		it('should verify phone number successfully', async () => {
			const userId = 'user-id-123';
			const verifyPhoneDto: VerifyPhoneDto = {
				phone: '+84901234567',
				verificationCode: '123456',
			};

			const mockUser = { id: userId, phone: '+84901234567' };
			const mockUpdatedUser = {
				id: userId,
				phone: verifyPhoneDto.phone,
				isVerifiedPhone: true,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.user.findFirst.mockResolvedValue(null); // No existing user with this phone
			mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

			const result = await service.verifyPhone(userId, verifyPhoneDto);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
			});

			expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
				where: {
					phone: verifyPhoneDto.phone,
					id: { not: userId },
				},
			});

			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { id: userId },
				data: {
					phone: verifyPhoneDto.phone,
					isVerifiedPhone: true,
					updatedAt: expect.any(Date),
				},
				select: {
					id: true,
					phone: true,
					isVerifiedPhone: true,
				},
			});

			expect(result).toEqual({
				message: 'Phone number verified successfully',
				user: mockUpdatedUser,
			});
		});

		it('should throw error for invalid verification code', async () => {
			const userId = 'user-id-123';
			const verifyPhoneDto: VerifyPhoneDto = {
				phone: '+84901234567',
				verificationCode: 'wrong-code',
			};

			mockPrismaService.verification.findFirst.mockResolvedValue(null);

			await expect(service.verifyPhone(userId, verifyPhoneDto)).rejects.toThrow(
				'Invalid verification code',
			);
		});
	});

	describe('verifyEmail', () => {
		it('should verify email successfully', async () => {
			const userId = 'user-id-123';
			const verifyEmailDto: VerifyEmailDto = {
				email: 'test@example.com',
				verificationCode: '123456',
			};

			const mockUser = { id: userId, email: 'test@example.com' };
			const mockUpdatedUser = {
				id: userId,
				email: verifyEmailDto.email,
				isVerifiedEmail: true,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.user.findFirst.mockResolvedValue(null); // No existing user with this email
			mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

			const result = await service.verifyEmail(userId, verifyEmailDto);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
			});

			expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
				where: {
					email: verifyEmailDto.email,
					id: { not: userId },
				},
			});

			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { id: userId },
				data: {
					email: verifyEmailDto.email,
					isVerifiedEmail: true,
					updatedAt: expect.any(Date),
				},
				select: {
					id: true,
					email: true,
					isVerifiedEmail: true,
				},
			});

			expect(result).toEqual({
				message: 'Email verified successfully',
				user: mockUpdatedUser,
			});
		});
	});

	describe('verifyIdentity', () => {
		it('should verify identity successfully', async () => {
			const userId = 'user-id-123';
			const verifyIdentityDto: VerifyIdentityDto = {
				idCardNumber: '012345678901',
				idCardImages: ['https://example.com/front.jpg', 'https://example.com/back.jpg'],
			};

			const mockUser = { id: userId };
			const mockUpdatedUser = {
				id: userId,
				idCardNumber: verifyIdentityDto.idCardNumber,
				idCardImages: verifyIdentityDto.idCardImages,
				isVerifiedIdentity: true,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.user.findFirst.mockResolvedValue(null); // No existing user with this ID card
			mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

			const result = await service.verifyIdentity(userId, verifyIdentityDto);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
			});

			expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
				where: {
					idCardNumber: verifyIdentityDto.idCardNumber,
					id: { not: userId },
				},
			});

			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { id: userId },
				data: {
					idCardNumber: verifyIdentityDto.idCardNumber,
					idCardImages: verifyIdentityDto.idCardImages,
					isVerifiedIdentity: true,
					updatedAt: expect.any(Date),
				},
				select: {
					id: true,
					idCardNumber: true,
					idCardImages: true,
					isVerifiedIdentity: true,
				},
			});

			expect(result).toEqual({
				message: 'Identity verified successfully',
				user: mockUpdatedUser,
			});
		});
	});

	describe('updateAvatar', () => {
		it('should update user avatar successfully', async () => {
			const userId = 'user-id-123';
			const mockFile = {
				fieldname: 'file',
				originalname: 'avatar.jpg',
				encoding: '7bit',
				mimetype: 'image/jpeg',
				size: 1024,
				buffer: Buffer.from('fake-image-data'),
			} as Express.Multer.File;

			const mockUploadResult = {
				imagePath: '/uploads/avatars/avatar-123.jpg',
				imageId: 'img-123',
			};

			const mockUser = { id: userId, avatarUrl: null };
			const mockUpdatedUser = {
				id: userId,
				firstName: 'John',
				lastName: 'Doe',
				avatarUrl: mockUploadResult.imagePath,
				updatedAt: new Date(),
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockUploadService.uploadImage.mockResolvedValue(mockUploadResult);
			mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

			const result = await service.updateAvatar(userId, mockFile);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
			});

			expect(mockUploadService.uploadImage).toHaveBeenCalledWith(mockFile, {
				altText: 'User avatar',
			});

			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { id: userId },
				data: {
					avatarUrl: mockUploadResult.imagePath,
					updatedAt: expect.any(Date),
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					avatarUrl: true,
					updatedAt: true,
				},
			});

			expect(result).toEqual({
				message: 'Avatar uploaded successfully',
				user: mockUpdatedUser,
			});
		});
	});

	describe('getPublicUser', () => {
		it('should return public user data for authenticated user', async () => {
			const userId = 'user-id-123';
			const mockUser = {
				id: userId,
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				phone: '+84901234567',
				role: 'tenant',
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				overallRating: 4.5,
				totalRatings: 10,
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getPublicUser(userId, true);

			expect(result).toEqual({
				id: userId,
				name: 'John Doe',
				email: 'test@example.com',
				phone: '+84901234567',
				firstName: 'John',
				lastName: 'Doe',
				role: 'tenant',
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				overallRating: 4.5,
				totalRatings: 10,
			});
		});

		it('should mask sensitive data for unauthenticated user', async () => {
			const userId = 'user-id-123';
			const mockUser = {
				id: userId,
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				phone: '+84901234567',
				role: 'tenant',
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				overallRating: 4.5,
				totalRatings: 10,
				avatarUrl: null,
				gender: null,
				bio: null,
				isVerifiedIdentity: false,
				isVerifiedBank: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getPublicUser(userId, false);

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
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

			expect(result).toEqual({
				id: userId,
				firstName: undefined,
				lastName: undefined,
				name: 'J*** D**',
				email: 'test@ex*******om',
				phone: '+84******567',
				avatarUrl: null,
				gender: null,
				role: 'tenant',
				bio: null,
				isVerifiedPhone: true,
				isVerifiedEmail: true,
				isVerifiedIdentity: false,
				isVerifiedBank: false,
				overallRating: 4.5,
				totalRatings: 10,
				createdAt: expect.any(Date),
				updatedAt: expect.any(Date),
			});
		});
	});
});
