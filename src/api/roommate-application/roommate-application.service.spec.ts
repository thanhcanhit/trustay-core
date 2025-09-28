import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoommateApplicationStatus } from '../../common/enums/roommate-application-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils } from '../../test-utils';
import { RoommateApplicationService } from './roommate-application.service';

describe('RoommateApplicationService', () => {
	let service: RoommateApplicationService;
	let prismaService: PrismaService;
	let authUtils: AuthTestUtils;
	let module: TestingModule;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			providers: [RoommateApplicationService, PrismaService],
		}).compile();

		service = module.get<RoommateApplicationService>(RoommateApplicationService);
		prismaService = module.get<PrismaService>(PrismaService);
		authUtils = new AuthTestUtils();
	});

	beforeEach(async () => {
		// Clean database before each test
		await prismaService.roommateApplication.deleteMany();
		await prismaService.roommateSeekingPost.deleteMany();
		await prismaService.user.deleteMany();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('create', () => {
		it('should create application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

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
			const result = await service.create(createDto, applicant.id);

			// Assert
			expect(result).toMatchObject({
				roommateSeekingPostId: createDto.roommateSeekingPostId,
				applicantId: applicant.id,
				fullName: createDto.fullName,
				occupation: createDto.occupation,
				phoneNumber: createDto.phoneNumber,
				moveInDate: createDto.moveInDate,
				intendedStayMonths: createDto.intendedStayMonths,
				applicationMessage: createDto.applicationMessage,
				status: RoommateApplicationStatus.pending,
				isUrgent: createDto.isUrgent,
			});

			// Verify application was created in database
			const createdApplication = await prismaService.roommateApplication.findUnique({
				where: { id: result.id },
				include: {
					applicant: true,
					roommateSeekingPost: true,
				},
			});

			expect(createdApplication).toBeTruthy();
			expect(createdApplication?.applicantId).toBe(applicant.id);
			expect(createdApplication?.roommateSeekingPostId).toBe(roommatePost.id);
		});

		it('should throw NotFoundException when post not found', async () => {
			// Arrange
			const applicant = await authUtils.createTestUser();
			const createDto = {
				roommateSeekingPostId: 'non-existent-id',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			// Act & Assert
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(NotFoundException);
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(
				'Không tìm thấy bài đăng',
			);
		});

		it('should throw BadRequestException when post is not active', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'closed' as const,
				remainingSlots: 2,
			});

			const createDto = {
				roommateSeekingPostId: roommatePost.id,
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			// Act & Assert
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(
				'Bài đăng không còn mở cho ứng tuyển',
			);
		});

		it('should throw BadRequestException when no remaining slots', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 0,
			});

			const createDto = {
				roommateSeekingPostId: roommatePost.id,
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			// Act & Assert
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(
				'Bài đăng đã hết slot trống',
			);
		});

		it('should throw BadRequestException when applying to own post', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const createDto = {
				roommateSeekingPostId: roommatePost.id,
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			// Act & Assert
			await expect(service.create(createDto, tenant.id)).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, tenant.id)).rejects.toThrow(
				'Không thể ứng tuyển vào bài đăng của chính mình',
			);
		});

		it('should throw BadRequestException when already applied', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			// Create an existing application
			await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			const createDto = {
				roommateSeekingPostId: roommatePost.id,
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			// Act & Assert
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, applicant.id)).rejects.toThrow(
				'Bạn đã ứng tuyển cho bài đăng này rồi',
			);
		});
	});

	describe('findMyApplications', () => {
		it('should return paginated applications for applicant', async () => {
			// Arrange
			const query = { page: 1, limit: 10 };
			const applicant = await authUtils.createTestUser();
			const tenant = await authUtils.createDefaultTenant();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			// Create test application
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
					status: RoommateApplicationStatus.pending,
					isUrgent: false,
				},
			});

			// Act
			const result = await service.findMyApplications(query, applicant.id);

			// Assert
			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				id: application.id,
				roommateSeekingPostId: application.roommateSeekingPostId,
				applicantId: application.applicantId,
				fullName: application.fullName,
				occupation: application.occupation,
				phoneNumber: application.phoneNumber,
				moveInDate: application.moveInDate.toISOString(),
				intendedStayMonths: application.intendedStayMonths,
				applicationMessage: application.applicationMessage,
				status: application.status,
				isUrgent: application.isUrgent,
			});
			expect(result.meta).toMatchObject({
				page: 1,
				limit: 10,
				total: 1,
				totalPages: 1,
			});
		});
	});

	describe('findApplicationsForMyPosts', () => {
		it('should return paginated applications for tenant posts', async () => {
			// Arrange
			const query = { page: 1, limit: 10 };
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			// Create test application
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
					status: RoommateApplicationStatus.pending,
					isUrgent: false,
				},
			});

			// Act
			const result = await service.findApplicationsForMyPosts(query, tenant.id);

			// Assert
			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				id: application.id,
				roommateSeekingPostId: application.roommateSeekingPostId,
				applicantId: application.applicantId,
				fullName: application.fullName,
				status: application.status,
			});
		});
	});

	describe('findOne', () => {
		it('should return application details for applicant', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

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
					status: RoommateApplicationStatus.pending,
					isUrgent: false,
				},
			});

			// Act
			const result = await service.findOne(application.id, applicant.id);

			// Assert
			expect(result).toMatchObject({
				id: application.id,
				roommateSeekingPostId: application.roommateSeekingPostId,
				applicantId: application.applicantId,
				fullName: application.fullName,
				occupation: application.occupation,
				phoneNumber: application.phoneNumber,
				status: application.status,
				isUrgent: application.isUrgent,
			});
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const applicant = await authUtils.createTestUser();

			// Act & Assert
			await expect(service.findOne(applicationId, applicant.id)).rejects.toThrow(NotFoundException);
			await expect(service.findOne(applicationId, applicant.id)).rejects.toThrow(
				'Không tìm thấy đơn ứng tuyển',
			);
		});

		it('should throw ForbiddenException when user has no permission', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const otherUser = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			// Act & Assert
			await expect(service.findOne(application.id, otherUser.id)).rejects.toThrow(
				ForbiddenException,
			);
			await expect(service.findOne(application.id, otherUser.id)).rejects.toThrow(
				'Không có quyền xem đơn ứng tuyển này',
			);
		});
	});

	describe('update', () => {
		it('should update application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

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
					status: RoommateApplicationStatus.pending,
					isUrgent: false,
				},
			});

			const updateDto = {
				fullName: 'Updated Name',
				applicationMessage: 'Updated message',
			};

			// Act
			const result = await service.update(application.id, updateDto, applicant.id);

			// Assert
			expect(result.fullName).toBe(updateDto.fullName);
			expect(result.applicationMessage).toBe(updateDto.applicationMessage);

			// Verify database was updated
			const updatedApplication = await prismaService.roommateApplication.findUnique({
				where: { id: application.id },
			});
			expect(updatedApplication?.fullName).toBe(updateDto.fullName);
			expect(updatedApplication?.applicationMessage).toBe(updateDto.applicationMessage);
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const applicant = await authUtils.createTestUser();
			const updateDto = { fullName: 'Updated Name' };

			// Act & Assert
			await expect(service.update(applicationId, updateDto, applicant.id)).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should throw ForbiddenException when user is not applicant', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const otherApplicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			const updateDto = { fullName: 'Updated Name' };

			// Act & Assert
			await expect(service.update(application.id, updateDto, otherApplicant.id)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it('should throw BadRequestException when application is not pending', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.approved_by_tenant,
				},
			});

			const updateDto = { fullName: 'Updated Name' };

			// Act & Assert
			await expect(service.update(application.id, updateDto, applicant.id)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.update(application.id, updateDto, applicant.id)).rejects.toThrow(
				'Chỉ có thể chỉnh sửa đơn ứng tuyển đang chờ xử lý',
			);
		});
	});

	describe('respondToApplication', () => {
		it('should respond to application as tenant', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

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
					status: RoommateApplicationStatus.pending,
					isUrgent: false,
				},
			});

			const respondDto = {
				status: RoommateApplicationStatus.approved_by_tenant,
				response: 'Welcome to the room!',
			};

			// Act
			const result = await service.respondToApplication(application.id, respondDto, tenant.id);

			// Assert
			expect(result.status).toBe(respondDto.status);

			// Verify database was updated
			const updatedApplication = await prismaService.roommateApplication.findUnique({
				where: { id: application.id },
			});
			expect(updatedApplication?.status).toBe(respondDto.status);
			expect(updatedApplication?.tenantResponse).toBe(respondDto.response);
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const tenant = await authUtils.createDefaultTenant();
			const respondDto = { status: RoommateApplicationStatus.approved_by_tenant };

			// Act & Assert
			await expect(
				service.respondToApplication(applicationId, respondDto, tenant.id),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException when user has no permission', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const otherTenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			const respondDto = { status: RoommateApplicationStatus.approved_by_tenant };

			// Act & Assert
			await expect(
				service.respondToApplication(application.id, respondDto, otherTenant.id),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('cancel', () => {
		it('should cancel application successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			// Act
			await service.cancel(application.id, applicant.id);

			// Assert
			const cancelledApplication = await prismaService.roommateApplication.findUnique({
				where: { id: application.id },
			});
			expect(cancelledApplication?.status).toBe(RoommateApplicationStatus.cancelled);
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const applicant = await authUtils.createTestUser();

			// Act & Assert
			await expect(service.cancel(applicationId, applicant.id)).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException when user is not applicant', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();
			const otherApplicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			// Act & Assert
			await expect(service.cancel(application.id, otherApplicant.id)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it('should throw BadRequestException when application is not pending', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.approved_by_tenant,
				},
			});

			// Act & Assert
			await expect(service.cancel(application.id, applicant.id)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.cancel(application.id, applicant.id)).rejects.toThrow(
				'Chỉ có thể hủy đơn ứng tuyển đang chờ xử lý',
			);
		});
	});

	describe('bulkRespondToApplications', () => {
		it('should process bulk responses successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant1 = await authUtils.createTestUser();
			const applicant2 = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application1 = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant1.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			const application2 = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant2.id,
					fullName: 'Jane Doe',
					phoneNumber: '+84901234568',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			const bulkDto = {
				applicationIds: [application1.id, application2.id],
				status: RoommateApplicationStatus.approved_by_tenant,
				response: 'All approved!',
			};

			// Act
			const result = await service.bulkRespondToApplications(bulkDto, tenant.id);

			// Assert
			expect(result).toEqual({
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

			expect(updatedApp1?.status).toBe(RoommateApplicationStatus.approved_by_tenant);
			expect(updatedApp2?.status).toBe(RoommateApplicationStatus.approved_by_tenant);
		});

		it('should handle partial failures in bulk response', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 2,
			});

			const application = await prismaService.roommateApplication.create({
				data: {
					roommateSeekingPostId: roommatePost.id,
					applicantId: applicant.id,
					fullName: 'John Doe',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					status: RoommateApplicationStatus.pending,
				},
			});

			const bulkDto = {
				applicationIds: [application.id, 'non-existent-id'],
				status: RoommateApplicationStatus.approved_by_tenant,
				response: 'All approved!',
			};

			// Act
			const result = await service.bulkRespondToApplications(bulkDto, tenant.id);

			// Assert
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].applicationId).toBe('non-existent-id');
			expect(result.processedApplications).toEqual([application.id]);
		});
	});

	describe('getApplicationStatistics', () => {
		it('should return statistics for my applications', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 5,
			});

			// Create test applications with different statuses
			await prismaService.roommateApplication.createMany({
				data: [
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant.id,
						fullName: 'John Doe 1',
						phoneNumber: '+84901234567',
						moveInDate: new Date('2024-01-01'),
						status: RoommateApplicationStatus.pending,
					},
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant.id,
						fullName: 'John Doe 2',
						phoneNumber: '+84901234568',
						moveInDate: new Date('2024-01-01'),
						status: RoommateApplicationStatus.approved_by_tenant,
					},
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant.id,
						fullName: 'John Doe 3',
						phoneNumber: '+84901234569',
						moveInDate: new Date('2024-01-01'),
						status: RoommateApplicationStatus.rejected_by_tenant,
					},
				],
			});

			// Act
			const result = await service.getApplicationStatistics(applicant.id, false);

			// Assert
			expect(result.total).toBe(3);
			expect(result.pending).toBe(1);
			expect(result.approvedByTenant).toBe(1);
			expect(result.rejectedByTenant).toBe(1);
		});

		it('should return statistics for my posts', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const applicant1 = await authUtils.createTestUser();
			const applicant2 = await authUtils.createTestUser();

			const roommatePost = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				status: 'active' as const,
				remainingSlots: 5,
			});

			// Create test applications for tenant's post
			await prismaService.roommateApplication.createMany({
				data: [
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant1.id,
						fullName: 'John Doe 1',
						phoneNumber: '+84901234567',
						moveInDate: new Date('2024-01-01'),
						status: RoommateApplicationStatus.pending,
					},
					{
						roommateSeekingPostId: roommatePost.id,
						applicantId: applicant2.id,
						fullName: 'John Doe 2',
						phoneNumber: '+84901234568',
						moveInDate: new Date('2024-01-01'),
						status: RoommateApplicationStatus.approved_by_tenant,
					},
				],
			});

			// Act
			const result = await service.getApplicationStatistics(tenant.id, true);

			// Assert
			expect(result.total).toBe(2);
			expect(result.pending).toBe(1);
			expect(result.approvedByTenant).toBe(1);
		});
	});
});
