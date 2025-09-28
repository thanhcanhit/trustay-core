import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils, createTestModule } from '../../test-utils';
import { RoommateSeekingPostController } from './roommate-seeking-post.controller';
import { RoommateSeekingPostService } from './roommate-seeking-post.service';

describe('RoommateSeekingPostController', () => {
	let app: INestApplication;
	let service: RoommateSeekingPostService;
	let authUtils: AuthTestUtils;
	let module: TestingModule;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			controllers: [RoommateSeekingPostController],
			providers: [
				{
					provide: PrismaService,
					useValue: {
						user: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							findFirst: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							deleteMany: jest.fn(),
							count: jest.fn(),
						},
						userAddress: {
							create: jest.fn(),
							findMany: jest.fn(),
							findUnique: jest.fn(),
							update: jest.fn(),
							updateMany: jest.fn(),
							delete: jest.fn(),
						},
						building: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						room: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						roomInstance: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						roommateSeekingPost: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						rental: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							findFirst: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						province: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						district: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						ward: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
						},
						refreshToken: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							deleteMany: jest.fn(),
						},
					},
				},
				{
					provide: RoommateSeekingPostService,
					useValue: {
						create: jest.fn(),
						findMyPosts: jest.fn(),
						findOne: jest.fn(),
						update: jest.fn(),
						remove: jest.fn(),
						updateStatus: jest.fn(),
					},
				},
			],
		}).compile();

		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ transform: true }));
		await app.init();

		service = module.get<RoommateSeekingPostService>(RoommateSeekingPostService);
		authUtils = new AuthTestUtils();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('POST /roommate-seeking-posts', () => {
		it('should create a roommate seeking post', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const createDto = {
				title: 'Tìm người ở ghép phòng trọ',
				description: 'Phòng trọ đẹp, gần trường học',
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: '2024-01-01',
				minimumStayMonths: 6,
				currency: 'VND',
			};

			const mockResponse = {
				id: 'post-1',
				title: createDto.title,
				description: createDto.description,
				slug: 'tim-nguoi-o-ghep-phong-tro',
				tenantId: tenant.id,
				monthlyRent: createDto.monthlyRent,
				depositAmount: createDto.depositAmount,
				seekingCount: createDto.seekingCount,
				approvedCount: 0,
				remainingSlots: createDto.seekingCount,
				maxOccupancy: createDto.maxOccupancy,
				currentOccupancy: createDto.currentOccupancy,
				availableFromDate: '2024-01-01T00:00:00.000Z',
				minimumStayMonths: createDto.minimumStayMonths,
				currency: createDto.currency,
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				tenant: {
					id: tenant.id,
					firstName: tenant.firstName,
					lastName: tenant.lastName,
					avatarUrl: tenant.avatarUrl,
					phoneNumber: tenant.phoneNumber,
				},
			};

			jest.spyOn(service, 'create').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.post('/roommate-seeking-posts')
				.set(headers)
				.send(createDto)
				.expect(201);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.create).toHaveBeenCalledWith(createDto, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
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
			await request(app.getHttpServer())
				.post('/roommate-seeking-posts')
				.send(createDto)
				.expect(401);
		});

		it('should return 400 for invalid data', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const invalidDto = {
				title: '', // Empty title
				monthlyRent: -1000, // Negative amount
				seekingCount: 0, // Invalid count
			};

			// Act & Assert
			await request(app.getHttpServer())
				.post('/roommate-seeking-posts')
				.set(headers)
				.send(invalidDto)
				.expect(400);
		});
	});

	describe('GET /roommate-seeking-posts/me', () => {
		it('should return my posts', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const mockResponse = {
				data: [
					{
						id: 'post-1',
						title: 'My Post 1',
						description: 'Description 1',
						slug: 'my-post-1',
						tenantId: tenant.id,
						monthlyRent: 2000000,
						depositAmount: 1000000,
						seekingCount: 2,
						approvedCount: 0,
						remainingSlots: 2,
						maxOccupancy: 4,
						currentOccupancy: 1,
						availableFromDate: '2024-01-01T00:00:00.000Z',
						minimumStayMonths: 6,
						currency: 'VND',
						status: 'active',
						requiresLandlordApproval: false,
						isActive: true,
						viewCount: 0,
						contactCount: 0,
						createdAt: '2024-01-01T00:00:00.000Z',
						updatedAt: '2024-01-01T00:00:00.000Z',
						tenant: {
							id: tenant.id,
							firstName: tenant.firstName,
							lastName: tenant.lastName,
							avatarUrl: tenant.avatarUrl,
							phoneNumber: tenant.phoneNumber,
						},
					},
				],
				meta: {
					page: 1,
					limit: 10,
					total: 1,
					totalPages: 1,
					hasNextPage: false,
					hasPreviousPage: false,
				},
			};

			jest.spyOn(service, 'findMyPosts').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/roommate-seeking-posts/me')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findMyPosts).toHaveBeenCalledWith({}, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer()).get('/roommate-seeking-posts/me').expect(401);
		});
	});

	describe('GET /roommate-seeking-posts/:id', () => {
		it('should return post details without authentication', async () => {
			// Arrange
			const postId = 'post-1';
			const mockResponse = {
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
				availableFromDate: '2024-01-01T00:00:00.000Z',
				minimumStayMonths: 6,
				currency: 'VND',
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				tenant: {
					id: 'tenant-1',
					firstName: 'John',
					lastName: 'Doe',
					avatarUrl: null,
					phoneNumber: '+84901234567',
				},
				isOwner: false,
				canEdit: false,
				canApply: true,
			};

			jest.spyOn(service, 'findOne').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get(`/roommate-seeking-posts/${postId}`)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findOne).toHaveBeenCalledWith(postId, undefined, { isAuthenticated: false });
		});

		it('should return post details with authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const postId = 'post-1';

			const mockResponse = {
				id: postId,
				title: 'Post 1',
				description: 'Description 1',
				slug: 'post-1',
				tenantId: tenant.id,
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				approvedCount: 0,
				remainingSlots: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: '2024-01-01T00:00:00.000Z',
				minimumStayMonths: 6,
				currency: 'VND',
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				tenant: {
					id: tenant.id,
					firstName: tenant.firstName,
					lastName: tenant.lastName,
					avatarUrl: tenant.avatarUrl,
					phoneNumber: tenant.phoneNumber,
				},
				isOwner: true,
				canEdit: true,
				canApply: false,
			};

			jest.spyOn(service, 'findOne').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get(`/roommate-seeking-posts/${postId}`)
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findOne).toHaveBeenCalledWith(postId, undefined, { isAuthenticated: true });
		});

		it('should return 404 when post not found', async () => {
			// Arrange
			const postId = 'non-existent';
			jest.spyOn(service, 'findOne').mockRejectedValue(new Error('Not found'));

			// Act & Assert
			await request(app.getHttpServer()).get(`/roommate-seeking-posts/${postId}`).expect(500);
		});
	});

	describe('PATCH /roommate-seeking-posts/:id', () => {
		it('should update post successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const postId = 'post-1';

			const updateDto = {
				title: 'Updated Title',
				description: 'Updated Description',
			};

			const mockResponse = {
				id: postId,
				title: updateDto.title,
				description: updateDto.description,
				slug: 'updated-title',
				tenantId: tenant.id,
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				approvedCount: 0,
				remainingSlots: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: '2024-01-01T00:00:00.000Z',
				minimumStayMonths: 6,
				currency: 'VND',
				status: 'active',
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				tenant: {
					id: tenant.id,
					firstName: tenant.firstName,
					lastName: tenant.lastName,
					avatarUrl: tenant.avatarUrl,
					phoneNumber: tenant.phoneNumber,
				},
			};

			jest.spyOn(service, 'update').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/roommate-seeking-posts/${postId}`)
				.set(headers)
				.send(updateDto)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.update).toHaveBeenCalledWith(postId, updateDto, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const postId = 'post-1';
			const updateDto = { title: 'Updated Title' };

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/roommate-seeking-posts/${postId}`)
				.send(updateDto)
				.expect(401);
		});
	});

	describe('DELETE /roommate-seeking-posts/:id', () => {
		it('should delete post successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const postId = 'post-1';

			jest.spyOn(service, 'remove').mockResolvedValue(undefined);

			// Act
			await request(app.getHttpServer())
				.delete(`/roommate-seeking-posts/${postId}`)
				.set(headers)
				.expect(204);

			// Assert
			expect(service.remove).toHaveBeenCalledWith(postId, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const postId = 'post-1';

			// Act & Assert
			await request(app.getHttpServer()).delete(`/roommate-seeking-posts/${postId}`).expect(401);
		});
	});

	describe('PATCH /roommate-seeking-posts/:id/status', () => {
		it('should update status successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const postId = 'post-1';
			const status = 'paused';

			const mockResponse = {
				id: postId,
				title: 'Post 1',
				description: 'Description 1',
				slug: 'post-1',
				tenantId: tenant.id,
				monthlyRent: 2000000,
				depositAmount: 1000000,
				seekingCount: 2,
				approvedCount: 0,
				remainingSlots: 2,
				maxOccupancy: 4,
				currentOccupancy: 1,
				availableFromDate: '2024-01-01T00:00:00.000Z',
				minimumStayMonths: 6,
				currency: 'VND',
				status,
				requiresLandlordApproval: false,
				isActive: true,
				viewCount: 0,
				contactCount: 0,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				tenant: {
					id: tenant.id,
					firstName: tenant.firstName,
					lastName: tenant.lastName,
					avatarUrl: tenant.avatarUrl,
					phoneNumber: tenant.phoneNumber,
				},
			};

			jest.spyOn(service, 'updateStatus').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/roommate-seeking-posts/${postId}/status`)
				.set(headers)
				.send({ status })
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.updateStatus).toHaveBeenCalledWith(postId, status, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const postId = 'post-1';
			const status = 'paused';

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/roommate-seeking-posts/${postId}/status`)
				.send({ status })
				.expect(401);
		});
	});
});
