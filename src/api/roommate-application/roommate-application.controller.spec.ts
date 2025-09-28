import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils, createTestModule } from '../../test-utils';
import { RoommateApplicationController } from './roommate-application.controller';
import { RoommateApplicationService } from './roommate-application.service';

describe('RoommateApplicationController', () => {
	let app: INestApplication;
	let service: RoommateApplicationService;
	let authUtils: AuthTestUtils;
	let module: TestingModule;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			controllers: [RoommateApplicationController],
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
						roommateApplication: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							findFirst: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
							count: jest.fn(),
							groupBy: jest.fn(),
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
					provide: RoommateApplicationService,
					useValue: {
						create: jest.fn(),
						findMyApplications: jest.fn(),
						findApplicationsForMyPosts: jest.fn(),
						findOne: jest.fn(),
						update: jest.fn(),
						respondToApplication: jest.fn(),
						cancel: jest.fn(),
						bulkRespondToApplications: jest.fn(),
						getApplicationStatistics: jest.fn(),
					},
				},
			],
		}).compile();

		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ transform: true }));
		await app.init();

		service = module.get<RoommateApplicationService>(RoommateApplicationService);
		authUtils = new AuthTestUtils();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('POST /roommate-applications', () => {
		it('should create application successfully', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);

			const createDto = {
				roommateSeekingPostId: 'post-1',
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
				intendedStayMonths: 6,
				applicationMessage: 'I am interested in this room',
				isUrgent: false,
			};

			const mockResponse = {
				id: 'app-1',
				roommateSeekingPostId: createDto.roommateSeekingPostId,
				applicantId: applicant.id,
				fullName: createDto.fullName,
				occupation: createDto.occupation,
				phoneNumber: createDto.phoneNumber,
				moveInDate: '2024-01-01T00:00:00.000Z',
				intendedStayMonths: createDto.intendedStayMonths,
				applicationMessage: createDto.applicationMessage,
				status: 'pending',
				isUrgent: createDto.isUrgent,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				applicant: {
					id: applicant.id,
					firstName: applicant.firstName,
					lastName: applicant.lastName,
					avatarUrl: applicant.avatarUrl,
					email: applicant.email,
				},
				roommateSeekingPost: {
					id: 'post-1',
					title: 'Room for rent',
					slug: 'room-for-rent',
					tenantId: 'tenant-1',
					monthlyRent: 2000000,
					tenant: {
						id: 'tenant-1',
						firstName: 'Jane',
						lastName: 'Smith',
						avatarUrl: null,
					},
				},
			};

			jest.spyOn(service, 'create').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.post('/roommate-applications')
				.set(headers)
				.send(createDto)
				.expect(201);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.create).toHaveBeenCalledWith(createDto, applicant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const createDto = {
				roommateSeekingPostId: 'post-1',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			// Act & Assert
			await request(app.getHttpServer()).post('/roommate-applications').send(createDto).expect(401);
		});

		it('should return 400 for invalid data', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);

			const invalidDto = {
				roommateSeekingPostId: 'invalid-uuid',
				fullName: '', // Empty name
				phoneNumber: 'invalid-phone',
				moveInDate: 'invalid-date',
			};

			// Act & Assert
			await request(app.getHttpServer())
				.post('/roommate-applications')
				.set(headers)
				.send(invalidDto)
				.expect(400);
		});
	});

	describe('GET /roommate-applications/my-applications', () => {
		it('should return my applications', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);

			const mockResponse = {
				data: [
					{
						id: 'app-1',
						roommateSeekingPostId: 'post-1',
						applicantId: applicant.id,
						fullName: 'John Doe',
						occupation: 'Developer',
						phoneNumber: '+84901234567',
						moveInDate: '2024-01-01T00:00:00.000Z',
						intendedStayMonths: 6,
						applicationMessage: 'I am interested',
						status: 'pending',
						isUrgent: false,
						createdAt: '2024-01-01T00:00:00.000Z',
						updatedAt: '2024-01-01T00:00:00.000Z',
						applicant: {
							id: applicant.id,
							firstName: applicant.firstName,
							lastName: applicant.lastName,
							avatarUrl: applicant.avatarUrl,
							email: applicant.email,
						},
						roommateSeekingPost: {
							id: 'post-1',
							title: 'Room for rent',
							slug: 'room-for-rent',
							tenantId: 'tenant-1',
							monthlyRent: 2000000,
							tenant: {
								id: 'tenant-1',
								firstName: 'Jane',
								lastName: 'Smith',
								avatarUrl: null,
							},
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

			jest.spyOn(service, 'findMyApplications').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/roommate-applications/my-applications')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findMyApplications).toHaveBeenCalledWith({}, applicant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer()).get('/roommate-applications/my-applications').expect(401);
		});
	});

	describe('GET /roommate-applications/for-my-posts', () => {
		it('should return applications for my posts', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const mockResponse = {
				data: [
					{
						id: 'app-1',
						roommateSeekingPostId: 'post-1',
						applicantId: 'applicant-1',
						fullName: 'John Doe',
						occupation: 'Developer',
						phoneNumber: '+84901234567',
						moveInDate: '2024-01-01T00:00:00.000Z',
						intendedStayMonths: 6,
						applicationMessage: 'I am interested',
						status: 'pending',
						isUrgent: false,
						createdAt: '2024-01-01T00:00:00.000Z',
						updatedAt: '2024-01-01T00:00:00.000Z',
						applicant: {
							id: 'applicant-1',
							firstName: 'John',
							lastName: 'Doe',
							avatarUrl: null,
							email: 'john@example.com',
						},
						roommateSeekingPost: {
							id: 'post-1',
							title: 'Room for rent',
							slug: 'room-for-rent',
							tenantId: tenant.id,
							monthlyRent: 2000000,
							tenant: {
								id: tenant.id,
								firstName: tenant.firstName,
								lastName: tenant.lastName,
								avatarUrl: tenant.avatarUrl,
							},
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

			jest.spyOn(service, 'findApplicationsForMyPosts').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/roommate-applications/for-my-posts')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findApplicationsForMyPosts).toHaveBeenCalledWith({}, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer()).get('/roommate-applications/for-my-posts').expect(401);
		});
	});

	describe('GET /roommate-applications/:id', () => {
		it('should return application details without authentication', async () => {
			// Arrange
			const applicationId = 'app-1';
			const mockResponse = {
				id: applicationId,
				roommateSeekingPostId: 'post-1',
				applicantId: 'applicant-1',
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01T00:00:00.000Z',
				intendedStayMonths: 6,
				applicationMessage: 'I am interested',
				status: 'pending',
				isUrgent: false,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				applicant: {
					id: 'applicant-1',
					firstName: 'John',
					lastName: 'Doe',
					avatarUrl: null,
					email: 'john@example.com',
				},
				roommateSeekingPost: {
					id: 'post-1',
					title: 'Room for rent',
					slug: 'room-for-rent',
					tenantId: 'tenant-1',
					monthlyRent: 2000000,
					tenant: {
						id: 'tenant-1',
						firstName: 'Jane',
						lastName: 'Smith',
						avatarUrl: null,
					},
				},
			};

			jest.spyOn(service, 'findOne').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get(`/roommate-applications/${applicationId}`)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findOne).toHaveBeenCalledWith(applicationId, undefined);
		});

		it('should return application details with authentication', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);
			const applicationId = 'app-1';

			const mockResponse = {
				id: applicationId,
				roommateSeekingPostId: 'post-1',
				applicantId: applicant.id,
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01T00:00:00.000Z',
				intendedStayMonths: 6,
				applicationMessage: 'I am interested',
				status: 'pending',
				isUrgent: false,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				applicant: {
					id: applicant.id,
					firstName: applicant.firstName,
					lastName: applicant.lastName,
					avatarUrl: applicant.avatarUrl,
					email: applicant.email,
				},
				roommateSeekingPost: {
					id: 'post-1',
					title: 'Room for rent',
					slug: 'room-for-rent',
					tenantId: 'tenant-1',
					monthlyRent: 2000000,
					tenant: {
						id: 'tenant-1',
						firstName: 'Jane',
						lastName: 'Smith',
						avatarUrl: null,
					},
				},
			};

			jest.spyOn(service, 'findOne').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get(`/roommate-applications/${applicationId}`)
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findOne).toHaveBeenCalledWith(applicationId, applicant.id);
		});

		it('should return 404 when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			jest.spyOn(service, 'findOne').mockRejectedValue(new Error('Not found'));

			// Act & Assert
			await request(app.getHttpServer()).get(`/roommate-applications/${applicationId}`).expect(500);
		});
	});

	describe('PATCH /roommate-applications/:id', () => {
		it('should update application successfully', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);
			const applicationId = 'app-1';

			const updateDto = {
				fullName: 'Updated Name',
				applicationMessage: 'Updated message',
			};

			const mockResponse = {
				id: applicationId,
				roommateSeekingPostId: 'post-1',
				applicantId: applicant.id,
				fullName: updateDto.fullName,
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01T00:00:00.000Z',
				intendedStayMonths: 6,
				applicationMessage: updateDto.applicationMessage,
				status: 'pending',
				isUrgent: false,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				applicant: {
					id: applicant.id,
					firstName: applicant.firstName,
					lastName: applicant.lastName,
					avatarUrl: applicant.avatarUrl,
					email: applicant.email,
				},
				roommateSeekingPost: {
					id: 'post-1',
					title: 'Room for rent',
					slug: 'room-for-rent',
					tenantId: 'tenant-1',
					monthlyRent: 2000000,
					tenant: {
						id: 'tenant-1',
						firstName: 'Jane',
						lastName: 'Smith',
						avatarUrl: null,
					},
				},
			};

			jest.spyOn(service, 'update').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/roommate-applications/${applicationId}`)
				.set(headers)
				.send(updateDto)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.update).toHaveBeenCalledWith(applicationId, updateDto, applicant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const applicationId = 'app-1';
			const updateDto = { fullName: 'Updated Name' };

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/roommate-applications/${applicationId}`)
				.send(updateDto)
				.expect(401);
		});
	});

	describe('PATCH /roommate-applications/:id/respond', () => {
		it('should respond to application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const applicationId = 'app-1';

			const respondDto = {
				status: 'approved_by_tenant',
				response: 'Welcome to the room!',
			};

			const mockResponse = {
				id: applicationId,
				roommateSeekingPostId: 'post-1',
				applicantId: 'applicant-1',
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01T00:00:00.000Z',
				intendedStayMonths: 6,
				applicationMessage: 'I am interested',
				status: respondDto.status,
				tenantResponse: respondDto.response,
				tenantRespondedAt: '2024-01-01T00:00:00.000Z',
				isUrgent: false,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
				applicant: {
					id: 'applicant-1',
					firstName: 'John',
					lastName: 'Doe',
					avatarUrl: null,
					email: 'john@example.com',
				},
				roommateSeekingPost: {
					id: 'post-1',
					title: 'Room for rent',
					slug: 'room-for-rent',
					tenantId: tenant.id,
					monthlyRent: 2000000,
					tenant: {
						id: tenant.id,
						firstName: tenant.firstName,
						lastName: tenant.lastName,
						avatarUrl: tenant.avatarUrl,
					},
				},
			};

			jest.spyOn(service, 'respondToApplication').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/roommate-applications/${applicationId}/respond`)
				.set(headers)
				.send(respondDto)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.respondToApplication).toHaveBeenCalledWith(
				applicationId,
				respondDto,
				tenant.id,
			);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const applicationId = 'app-1';
			const respondDto = { status: 'approved_by_tenant' };

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/roommate-applications/${applicationId}/respond`)
				.send(respondDto)
				.expect(401);
		});
	});

	describe('PATCH /roommate-applications/:id/cancel', () => {
		it('should cancel application successfully', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);
			const applicationId = 'app-1';

			jest.spyOn(service, 'cancel').mockResolvedValue(undefined);

			// Act
			await request(app.getHttpServer())
				.patch(`/roommate-applications/${applicationId}/cancel`)
				.set(headers)
				.expect(204);

			// Assert
			expect(service.cancel).toHaveBeenCalledWith(applicationId, applicant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const applicationId = 'app-1';

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/roommate-applications/${applicationId}/cancel`)
				.expect(401);
		});
	});

	describe('POST /roommate-applications/bulk-respond', () => {
		it('should process bulk responses successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const bulkDto = {
				applicationIds: ['app-1', 'app-2'],
				status: 'approved_by_tenant',
				response: 'All approved!',
			};

			const mockResponse = {
				successCount: 2,
				failureCount: 0,
				errors: [],
				processedApplications: ['app-1', 'app-2'],
			};

			jest.spyOn(service, 'bulkRespondToApplications').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.post('/roommate-applications/bulk-respond')
				.set(headers)
				.send(bulkDto)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.bulkRespondToApplications).toHaveBeenCalledWith(bulkDto, tenant.id);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const bulkDto = {
				applicationIds: ['app-1', 'app-2'],
				status: 'approved_by_tenant',
			};

			// Act & Assert
			await request(app.getHttpServer())
				.post('/roommate-applications/bulk-respond')
				.send(bulkDto)
				.expect(401);
		});
	});

	describe('GET /roommate-applications/statistics/my-applications', () => {
		it('should return statistics for my applications', async () => {
			// Arrange
			const applicant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(applicant);

			const mockResponse = {
				total: 10,
				pending: 5,
				approvedByTenant: 3,
				rejectedByTenant: 2,
				approvedByLandlord: 0,
				rejectedByLandlord: 0,
				cancelled: 0,
				expired: 0,
				urgent: 2,
				dailyStats: [
					{ date: '2024-01-01', count: 2 },
					{ date: '2024-01-02', count: 1 },
				],
				statusBreakdown: [
					{ status: 'pending', count: 5, percentage: 50 },
					{ status: 'approved_by_tenant', count: 3, percentage: 30 },
					{ status: 'rejected_by_tenant', count: 2, percentage: 20 },
				],
			};

			jest.spyOn(service, 'getApplicationStatistics').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/roommate-applications/statistics/my-applications')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.getApplicationStatistics).toHaveBeenCalledWith(applicant.id, false);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/roommate-applications/statistics/my-applications')
				.expect(401);
		});
	});

	describe('GET /roommate-applications/statistics/for-my-posts', () => {
		it('should return statistics for my posts', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const mockResponse = {
				total: 5,
				pending: 3,
				approvedByTenant: 2,
				rejectedByTenant: 0,
				approvedByLandlord: 0,
				rejectedByLandlord: 0,
				cancelled: 0,
				expired: 0,
				urgent: 1,
				dailyStats: [
					{ date: '2024-01-01', count: 1 },
					{ date: '2024-01-02', count: 2 },
				],
				statusBreakdown: [
					{ status: 'pending', count: 3, percentage: 60 },
					{ status: 'approved_by_tenant', count: 2, percentage: 40 },
				],
			};

			jest.spyOn(service, 'getApplicationStatistics').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/roommate-applications/statistics/for-my-posts')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.getApplicationStatistics).toHaveBeenCalledWith(tenant.id, true);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/roommate-applications/statistics/for-my-posts')
				.expect(401);
		});
	});
});
