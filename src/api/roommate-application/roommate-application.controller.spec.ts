import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils } from '../../test-utils';
import { TestDatabase } from '../../test-utils/test-database';
import { RoommateApplicationController } from './roommate-application.controller';
import { RoommateApplicationService } from './roommate-application.service';

describe('RoommateApplicationController', () => {
	let app: INestApplication;
	let authUtils: AuthTestUtils;
	let module: TestingModule;
	let testDatabase: TestDatabase;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		await testDatabase.setup();

		module = await Test.createTestingModule({
			controllers: [RoommateApplicationController],
			providers: [
				RoommateApplicationService,
				{
					provide: PrismaService,
					useValue: testDatabase.getPrisma(),
				},
			],
		}).compile();

		app = module.createNestApplication();
		app.setGlobalPrefix('api');
		app.useGlobalPipes(new ValidationPipe({ transform: true }));
		await app.init();

		authUtils = new AuthTestUtils(app);
	});

	beforeEach(async () => {
		await testDatabase.cleanDatabase();
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
		if (module) {
			await module.close();
		}
		if (testDatabase) {
			await testDatabase.teardown();
		}
	});

	describe('POST /api/roommate-applications', () => {
		it('should create application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const createDto = {
				roommateSeekingPostId: roommatePost.id,
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
				intendedStayMonths: 6,
				applicationMessage: 'I am interested in this room',
				isUrgent: false,
			};

			// Act
			const response = await request(app.getHttpServer())
				.post('/api/api/roommate-applications')
				.set(headers)
				.send(createDto)
				.expect(201);

			// Assert
			expect(response.body).toMatchObject({
				roommateSeekingPostId: createDto.roommateSeekingPostId,
				applicantId: applicant.id,
				fullName: createDto.fullName,
				occupation: createDto.occupation,
				phoneNumber: createDto.phoneNumber,
				status: 'pending',
				isUrgent: createDto.isUrgent,
			});

			// Verify application was created in database
			const prismaService = module.get<PrismaService>(PrismaService);
			const createdApplication = await prismaService.roommateApplication.findFirst({
				where: { applicantId: applicant.id },
			});
			expect(createdApplication).toBeTruthy();
			expect(createdApplication?.fullName).toBe(createDto.fullName);
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
			await request(app.getHttpServer())
				.post('/api/api/roommate-applications')
				.send(createDto)
				.expect(401);
		});

		it('should return 400 for invalid data', async () => {
			// Arrange
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const invalidDto = {
				roommateSeekingPostId: 'invalid-uuid',
				fullName: '', // Empty name
				phoneNumber: 'invalid-phone',
				moveInDate: 'invalid-date',
			};

			// Act & Assert
			await request(app.getHttpServer())
				.post('/api/api/roommate-applications')
				.set(headers)
				.send(invalidDto)
				.expect(400);
		});
	});

	describe('GET /api/roommate-applications/my-applications', () => {
		it('should return my applications', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			// Create test application
			const prismaService = module.get<PrismaService>(PrismaService);
			await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
				},
			});

			// Act
			const response = await request(app.getHttpServer())
				.get('/api/api/roommate-applications/my-applications')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body.data).toHaveLength(1);
			expect(response.body.data[0]).toMatchObject({
				applicantId: applicant.id,
				fullName: 'John Doe',
				status: 'pending',
			});
			expect(response.body.meta.total).toBe(1);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/api/api/roommate-applications/my-applications')
				.expect(401);
		});
	});

	describe('GET /api/roommate-applications/for-my-posts', () => {
		it('should return applications for my posts', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(tenant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			// Create test application
			const prismaService = module.get<PrismaService>(PrismaService);
			await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
				},
			});

			// Act
			const response = await request(app.getHttpServer())
				.get('/api/roommate-applications/for-my-posts')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body.data).toHaveLength(1);
			expect(response.body.data[0]).toMatchObject({
				applicantId: applicant.id,
				fullName: 'John Doe',
				status: 'pending',
			});
			expect(response.body.meta.total).toBe(1);
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer()).get('/api/roommate-applications/for-my-posts').expect(401);
		});
	});

	describe('GET /api/roommate-applications/:id', () => {
		it('should return application details without authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
				},
			});

			// Act
			const response = await request(app.getHttpServer())
				.get(`/api/roommate-applications/${application.id}`)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: application.id,
				applicantId: applicant.id,
				fullName: 'John Doe',
				status: 'pending',
			});
		});

		it('should return application details with authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
				},
			});

			// Act
			const response = await request(app.getHttpServer())
				.get(`/api/roommate-applications/${application.id}`)
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: application.id,
				applicantId: applicant.id,
				fullName: 'John Doe',
				status: 'pending',
			});
		});

		it('should return 404 when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';

			// Act & Assert
			await request(app.getHttpServer())
				.get(`/api/roommate-applications/${applicationId}`)
				.expect(404);
		});
	});

	describe('PATCH /api/roommate-applications/:id', () => {
		it('should update application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
				},
			});

			const updateDto = {
				fullName: 'Updated Name',
				applicationMessage: 'Updated message',
			};

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/api/roommate-applications/${application.id}`)
				.set(headers)
				.send(updateDto)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: application.id,
				applicantId: applicant.id,
				fullName: updateDto.fullName,
				applicationMessage: updateDto.applicationMessage,
			});

			// Verify database was updated
			const updatedApplication = await prismaService.roommateApplication.findUnique({
				where: { id: application.id },
			});
			expect(updatedApplication?.fullName).toBe(updateDto.fullName);
			expect(updatedApplication?.applicationMessage).toBe(updateDto.applicationMessage);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const applicationId = 'app-1';
			const updateDto = { fullName: 'Updated Name' };

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/api/roommate-applications/${applicationId}`)
				.send(updateDto)
				.expect(401);
		});
	});

	describe('PATCH /api/roommate-applications/:id/respond', () => {
		it('should respond to application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(tenant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
				},
			});

			const respondDto = {
				status: 'approved_by_tenant',
				response: 'Welcome to the room!',
			};

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/api/roommate-applications/${application.id}/respond`)
				.set(headers)
				.send(respondDto)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: application.id,
				applicantId: applicant.id,
				status: respondDto.status,
				tenantResponse: respondDto.response,
			});

			// Verify database was updated
			const updatedApplication = await prismaService.roommateApplication.findUnique({
				where: { id: application.id },
			});
			expect(updatedApplication?.status).toBe(respondDto.status);
			expect(updatedApplication?.tenantResponse).toBe(respondDto.response);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const applicationId = 'app-1';
			const respondDto = { status: 'approved_by_tenant' };

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/api/roommate-applications/${applicationId}/respond`)
				.send(respondDto)
				.expect(401);
		});
	});

	describe('PATCH /api/roommate-applications/:id/cancel', () => {
		it('should cancel application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: 'pending',
				},
			});

			// Act
			await request(app.getHttpServer())
				.patch(`/api/roommate-applications/${application.id}/cancel`)
				.set(headers)
				.expect(204);

			// Assert - Verify application was cancelled in database
			const cancelledApplication = await prismaService.roommateApplication.findUnique({
				where: { id: application.id },
			});
			expect(cancelledApplication?.status).toBe('cancelled');
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const applicationId = 'app-1';

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/api/roommate-applications/${applicationId}/cancel`)
				.expect(401);
		});
	});

	describe('POST /api/roommate-applications/bulk-respond', () => {
		it('should process bulk responses successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant1 = await authUtils.createTestUser();
			const applicant2 = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(tenant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 5,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			const application1 = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant1.id,
					fullName: 'John Doe 1',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: 'pending',
				},
			});

			const application2 = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant2.id,
					fullName: 'John Doe 2',
					phoneNumber: '+84901234568',
					moveInDate: new Date('2024-01-01'),
					status: 'pending',
				},
			});

			const bulkDto = {
				applicationIds: [application1.id, application2.id],
				status: 'approved_by_tenant',
				response: 'All approved!',
			};

			// Act
			const response = await request(app.getHttpServer())
				.post('/api/roommate-applications/bulk-respond')
				.set(headers)
				.send(bulkDto)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				successCount: 2,
				failureCount: 0,
				errors: [],
				processedApplications: [application1.id, application2.id],
			});

			// Verify applications were updated
			const updatedApp1 = await prismaService.roommateApplication.findUnique({
				where: { id: application1.id },
			});
			const updatedApp2 = await prismaService.roommateApplication.findUnique({
				where: { id: application2.id },
			});

			expect(updatedApp1?.status).toBe('approved_by_tenant');
			expect(updatedApp2?.status).toBe('approved_by_tenant');
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const bulkDto = {
				applicationIds: ['app-1', 'app-2'],
				status: 'approved_by_tenant',
			};

			// Act & Assert
			await request(app.getHttpServer())
				.post('/api/roommate-applications/bulk-respond')
				.send(bulkDto)
				.expect(401);
		});
	});

	describe('GET /api/roommate-applications/statistics/my-applications', () => {
		it('should return statistics for my applications', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(applicant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 5,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			await prismaService.roommateApplication.createMany({
				data: [
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant.id,
						fullName: 'John Doe 1',
						phoneNumber: '+84901234567',
						moveInDate: new Date('2024-01-01'),
						status: 'pending',
					},
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant.id,
						fullName: 'John Doe 2',
						phoneNumber: '+84901234568',
						moveInDate: new Date('2024-01-01'),
						status: 'approved_by_tenant',
					},
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant.id,
						fullName: 'John Doe 3',
						phoneNumber: '+84901234569',
						moveInDate: new Date('2024-01-01'),
						status: 'rejected_by_tenant',
					},
				],
			});

			// Act
			const response = await request(app.getHttpServer())
				.get('/api/roommate-applications/statistics/my-applications')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				total: 3,
				pending: 1,
				approvedByTenant: 1,
				rejectedByTenant: 1,
			});
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/api/roommate-applications/statistics/my-applications')
				.expect(401);
		});
	});

	describe('GET /api/roommate-applications/statistics/for-my-posts', () => {
		it('should return statistics for my posts', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant1 = await authUtils.createTestUser();
			const applicant2 = await authUtils.createTestUser();
			const headers = authUtils.getAuthHeaders(tenant);

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 5,
			});

			const prismaService = module.get<PrismaService>(PrismaService);
			await prismaService.roommateApplication.createMany({
				data: [
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant1.id,
						fullName: 'John Doe 1',
						phoneNumber: '+84901234567',
						moveInDate: new Date('2024-01-01'),
						status: 'pending',
					},
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant2.id,
						fullName: 'John Doe 2',
						phoneNumber: '+84901234568',
						moveInDate: new Date('2024-01-01'),
						status: 'approved_by_tenant',
					},
				],
			});

			// Act
			const response = await request(app.getHttpServer())
				.get('/api/roommate-applications/statistics/for-my-posts')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				total: 2,
				pending: 1,
				approvedByTenant: 1,
			});
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/api/roommate-applications/statistics/for-my-posts')
				.expect(401);
		});
	});
});
