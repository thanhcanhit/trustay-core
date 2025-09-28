import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TestDatabase } from '../../test-utils/test-database';
import { RoommateSeekingPostService } from './roommate-seeking-post.service';

describe('RoommateSeekingPostService', () => {
	let service: RoommateSeekingPostService;
	let prismaService: PrismaService;
	let module: TestingModule;
	let testDatabase: TestDatabase;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		await testDatabase.setup();

		module = await Test.createTestingModule({
			providers: [
				RoommateSeekingPostService,
				{
					provide: PrismaService,
					useValue: testDatabase.getPrisma(),
				},
			],
		}).compile();

		service = module.get<RoommateSeekingPostService>(RoommateSeekingPostService);
		prismaService = module.get<PrismaService>(PrismaService);
	});

	beforeEach(async () => {
		await testDatabase.cleanDatabase();
	});

	afterAll(async () => {
		await testDatabase.teardown();
		await module.close();
	});

	describe('create', () => {
		it('should create a roommate seeking post successfully', async () => {
			// Arrange - Create test user first
			const testUser = await prismaService.user.create({
				data: {
					id: 'tenant-1',
					passwordHash: 'password',
					firstName: 'John',
					lastName: 'Doe',
					email: 'john.doe@example.com',
					phone: '+84901234567',
					dateOfBirth: new Date('1990-01-01'),
					isVerifiedPhone: true,
					isVerifiedEmail: true,
				},
			});

			const createDto = {
				title: 'Tìm người ở ghép phòng trọ',
				description: 'Phòng trọ đẹp, gần trường học',
				externalAddress: '123 Đường ABC, Quận 1, TP.HCM',
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: '2024-01-01',
				minimumStayMonths: 6,
				currency: 'VND',
			};

			// Act
			const result = await service.create(createDto, testUser.id);

			// Assert
			expect(result).toMatchObject({
				title: createDto.title,
				description: createDto.description,
				tenantId: testUser.id,
				monthlyRent: createDto.monthlyRent,
				depositAmount: createDto.depositAmount,
				seekingCount: createDto.seekingCount,
				approvedCount: 0,
				remainingSlots: createDto.seekingCount,
				maxOccupancy: createDto.maxOccupancy,
				currentOccupancy: createDto.currentOccupancy,
				minimumStayMonths: createDto.minimumStayMonths,
				currency: createDto.currency,
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
			});
			expect(result.id).toBeDefined();
			expect(result.slug).toBeDefined();
			expect(result.availableFromDate).toBe(new Date(createDto.availableFromDate).toISOString());
			expect(result.tenant).toMatchObject({
				id: testUser.id,
				firstName: testUser.firstName,
				lastName: testUser.lastName,
				phone: testUser.phone,
			});
		});

		it('should throw BadRequestException when no room info provided', async () => {
			// Arrange - Create test user first
			const testUser = await prismaService.user.create({
				data: {
					id: 'tenant-2',
					passwordHash: 'password',
					firstName: 'Jane',
					lastName: 'Doe',
					email: 'jane.doe@example.com',
					phone: '+84901234568',
					dateOfBirth: new Date('1990-01-01'),
					isVerifiedPhone: true,
					isVerifiedEmail: true,
				},
			});

			const createDto = {
				title: 'Tìm người ở ghép',
				description: 'Mô tả',
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				maxOccupancy: 4,
				availableFromDate: '2024-01-01',
			};

			// Act & Assert
			await expect(service.create(createDto, testUser.id)).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, testUser.id)).rejects.toThrow(
				'Phải cung cấp thông tin phòng (roomInstanceId hoặc externalAddress)',
			);
		});

		it('should validate platform room constraints when roomInstanceId provided', async () => {
			// Arrange
			const createDto = {
				title: 'Tìm người ở ghép',
				description: 'Mô tả',
				roomInstanceId: 'room-instance-1',
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				maxOccupancy: 4,
				availableFromDate: '2024-01-01',
			};

			jest.spyOn(prismaService.rental, 'findFirst').mockResolvedValue(null);

			// Act & Assert
			await expect(service.create(createDto, 'tenant-1')).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, 'tenant-1')).rejects.toThrow(
				'Bạn không có hợp đồng thuê đang hoạt động cho phòng này',
			);
		});
	});

	describe('findMyPosts', () => {
		it('should return paginated posts for tenant', async () => {
			// Arrange
			const query = { page: 1, limit: 10 };
			const tenantId = 'tenant-1';

			const mockPosts = [
				{
					id: 'post-1',
					title: 'Post 1',
					description: 'Description 1',
					slug: 'post-1',
					tenantId,
					monthlyRent: 2000000,
					depositAmount: 1000000,
					seekingCount: 2,
					approvedCount: 0,
					remainingSlots: 2,
					maxOccupancy: 4,
					currentOccupancy: 1,
					availableFromDate: new Date('2024-01-01'),
					minimumStayMonths: 6,
					currency: 'VND',
					status: 'active',
					requiresLandlordApproval: false,
					isActive: true,
					viewCount: 0,
					contactCount: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					tenant: {
						id: tenantId,
						firstName: 'John',
						lastName: 'Doe',
						avatarUrl: null,
						phoneNumber: '+84901234567',
					},
				},
			];

			jest.spyOn(prismaService.roommateSeekingPost, 'findMany').mockResolvedValue(mockPosts as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'count').mockResolvedValue(1);

			// Act
			const result = await service.findMyPosts(query, tenantId);

			// Assert
			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				id: mockPosts[0].id,
				title: mockPosts[0].title,
				description: mockPosts[0].description,
				slug: mockPosts[0].slug,
				tenantId: mockPosts[0].tenantId,
				monthlyRent: mockPosts[0].monthlyRent,
				depositAmount: mockPosts[0].depositAmount,
				seekingCount: mockPosts[0].seekingCount,
				approvedCount: mockPosts[0].approvedCount,
				remainingSlots: mockPosts[0].remainingSlots,
				maxOccupancy: mockPosts[0].maxOccupancy,
				currentOccupancy: mockPosts[0].currentOccupancy,
				availableFromDate: mockPosts[0].availableFromDate.toISOString(),
				minimumStayMonths: mockPosts[0].minimumStayMonths,
				currency: mockPosts[0].currency,
				status: mockPosts[0].status,
				requiresLandlordApproval: mockPosts[0].requiresLandlordApproval,
				isActive: mockPosts[0].isActive,
				viewCount: mockPosts[0].viewCount,
				contactCount: mockPosts[0].contactCount,
				createdAt: mockPosts[0].createdAt.toISOString(),
				updatedAt: mockPosts[0].updatedAt.toISOString(),
				tenant: mockPosts[0].tenant,
			});
			expect(result.meta).toMatchObject({
				page: 1,
				limit: 10,
				total: 1,
				totalPages: 1,
			});

			expect(prismaService.roommateSeekingPost.findMany).toHaveBeenCalledWith({
				where: { tenantId },
				include: expect.any(Object),
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 10,
			});
		});
	});

	describe('findOne', () => {
		it('should return post details and increment view count', async () => {
			// Arrange
			const postId = 'post-1';
			const clientIp = '192.168.1.1';

			const mockPost = {
				id: postId,
				title: 'Post 1',
				description: 'Description 1',
				slug: 'post-1',
				tenantId: 'tenant-1',
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				approvedCount: 0,
				remainingSlots: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: new Date('2024-01-01'),
				minimumStayMonths: 6,
				currency: 'VND',
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				tenant: {
					id: 'tenant-1',
					firstName: 'John',
					lastName: 'Doe',
					avatarUrl: null,
					phoneNumber: '+84901234567',
				},
				applications: [],
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(mockPost as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'update').mockResolvedValue({
				...mockPost,
				viewCount: 1,
			} as any);

			// Act
			const result = await service.findOne(postId, clientIp);

			// Assert
			expect(result).toEqual({
				id: mockPost.id,
				title: mockPost.title,
				description: mockPost.description,
				slug: mockPost.slug,
				tenantId: mockPost.tenantId,
				monthlyRent: mockPost.monthlyRent,
				depositAmount: mockPost.depositAmount,
				seekingCount: mockPost.seekingCount,
				approvedCount: mockPost.approvedCount,
				remainingSlots: mockPost.remainingSlots,
				maxOccupancy: mockPost.maxOccupancy,
				currentOccupancy: mockPost.currentOccupancy,
				availableFromDate: mockPost.availableFromDate.toISOString(),
				minimumStayMonths: mockPost.minimumStayMonths,
				currency: mockPost.currency,
				status: mockPost.status,
				requiresLandlordApproval: mockPost.requiresLandlordApproval,
				isActive: mockPost.isActive,
				viewCount: 1, // Incremented
				contactCount: mockPost.contactCount,
				createdAt: mockPost.createdAt.toISOString(),
				updatedAt: mockPost.updatedAt.toISOString(),
				tenant: mockPost.tenant,
				isOwner: false,
				canEdit: false,
				canApply: true,
			});

			expect(prismaService.roommateSeekingPost.update).toHaveBeenCalledWith({
				where: { id: postId },
				data: { viewCount: { increment: 1 } },
			});
		});

		it('should throw NotFoundException when post not found', async () => {
			// Arrange
			const postId = 'non-existent';
			jest.spyOn(prismaService.roommateSeekingPost, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.findOne(postId)).rejects.toThrow(NotFoundException);
			await expect(service.findOne(postId)).rejects.toThrow('Không tìm thấy bài đăng');
		});
	});

	describe('update', () => {
		it('should update post successfully', async () => {
			// Arrange
			const postId = 'post-1';
			const tenantId = 'tenant-1';
			const updateDto = {
				title: 'Updated Title',
				description: 'Updated Description',
			};

			const existingPost = {
				id: postId,
				tenantId,
				seekingCount: 2,
				remainingSlots: 2,
			};

			const updatedPost = {
				...existingPost,
				title: updateDto.title,
				description: updateDto.description,
				monthlyRent: 2000000,
				depositAmount: 1000000,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: new Date('2024-01-01'),
				minimumStayMonths: 6,
				currency: 'VND',
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				tenant: {
					id: tenantId,
					firstName: 'John',
					lastName: 'Doe',
					avatarUrl: null,
					phoneNumber: '+84901234567',
				},
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(existingPost as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'update').mockResolvedValue(updatedPost as any);

			// Act
			const result = await service.update(postId, updateDto, tenantId);

			// Assert
			expect(result.title).toBe(updateDto.title);
			expect(result.description).toBe(updateDto.description);
			expect(prismaService.roommateSeekingPost.update).toHaveBeenCalledWith({
				where: { id: postId },
				data: {
					...updateDto,
					remainingSlots: existingPost.remainingSlots,
					availableFromDate: undefined,
					expiresAt: undefined,
				},
				include: expect.any(Object),
			});
		});

		it('should throw NotFoundException when post not found', async () => {
			// Arrange
			const postId = 'non-existent';
			const tenantId = 'tenant-1';
			const updateDto = { title: 'Updated Title' };

			jest.spyOn(prismaService.roommateSeekingPost, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.update(postId, updateDto, tenantId)).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException when user is not owner', async () => {
			// Arrange
			const postId = 'post-1';
			const tenantId = 'tenant-1';
			const otherTenantId = 'tenant-2';
			const updateDto = { title: 'Updated Title' };

			const existingPost = {
				id: postId,
				tenantId: otherTenantId,
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(existingPost as any);

			// Act & Assert
			await expect(service.update(postId, updateDto, tenantId)).rejects.toThrow(ForbiddenException);
			await expect(service.update(postId, updateDto, tenantId)).rejects.toThrow(
				'Không có quyền chỉnh sửa bài đăng này',
			);
		});
	});

	describe('remove', () => {
		it('should delete post successfully', async () => {
			// Arrange
			const postId = 'post-1';
			const tenantId = 'tenant-1';

			const existingPost = {
				id: postId,
				tenantId,
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(existingPost as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'delete').mockResolvedValue({} as any);

			// Act
			await service.remove(postId, tenantId);

			// Assert
			expect(prismaService.roommateSeekingPost.delete).toHaveBeenCalledWith({
				where: { id: postId },
			});
		});

		it('should throw NotFoundException when post not found', async () => {
			// Arrange
			const postId = 'non-existent';
			const tenantId = 'tenant-1';

			jest.spyOn(prismaService.roommateSeekingPost, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.remove(postId, tenantId)).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException when user is not owner', async () => {
			// Arrange
			const postId = 'post-1';
			const tenantId = 'tenant-1';
			const otherTenantId = 'tenant-2';

			const existingPost = {
				id: postId,
				tenantId: otherTenantId,
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(existingPost as any);

			// Act & Assert
			await expect(service.remove(postId, tenantId)).rejects.toThrow(ForbiddenException);
		});
	});

	describe('updateStatus', () => {
		it('should update status successfully', async () => {
			// Arrange
			const postId = 'post-1';
			const tenantId = 'tenant-1';
			const status = 'paused';

			const existingPost = {
				id: postId,
				tenantId,
			};

			const updatedPost = {
				...existingPost,
				status,
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				approvedCount: 0,
				remainingSlots: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: new Date('2024-01-01'),
				minimumStayMonths: 6,
				currency: 'VND',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				tenant: {
					id: tenantId,
					firstName: 'John',
					lastName: 'Doe',
					avatarUrl: null,
					phoneNumber: '+84901234567',
				},
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(existingPost as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'update').mockResolvedValue(updatedPost as any);

			// Act
			const result = await service.updateStatus(postId, status as any, tenantId);

			// Assert
			expect(result.status).toBe(status);
			expect(prismaService.roommateSeekingPost.update).toHaveBeenCalledWith({
				where: { id: postId },
				data: { status },
				include: expect.any(Object),
			});
		});

		it('should throw NotFoundException when post not found', async () => {
			// Arrange
			const postId = 'non-existent';
			const tenantId = 'tenant-1';
			const status = 'paused';

			jest.spyOn(prismaService.roommateSeekingPost, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.updateStatus(postId, status as any, tenantId)).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should throw ForbiddenException when user is not owner', async () => {
			// Arrange
			const postId = 'post-1';
			const tenantId = 'tenant-1';
			const otherTenantId = 'tenant-2';
			const status = 'paused';

			const existingPost = {
				id: postId,
				tenantId: otherTenantId,
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(existingPost as any);

			// Act & Assert
			await expect(service.updateStatus(postId, status as any, tenantId)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});
});
