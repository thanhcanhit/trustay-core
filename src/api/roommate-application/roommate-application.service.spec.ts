import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoommateApplicationStatus } from '../../common/enums/roommate-application-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { RoommateApplicationService } from './roommate-application.service';

describe('RoommateApplicationService', () => {
	let service: RoommateApplicationService;
	let prismaService: PrismaService;
	let module: TestingModule;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			providers: [
				RoommateApplicationService,
				{
					provide: PrismaService,
					useValue: {
						user: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
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
						roommateSeekingPost: {
							findUnique: jest.fn(),
							update: jest.fn(),
						},
						rental: {
							findUnique: jest.fn(),
						},
						roomInstance: {
							findUnique: jest.fn(),
						},
						room: {
							findUnique: jest.fn(),
						},
						building: {
							findUnique: jest.fn(),
						},
						province: {
							findUnique: jest.fn(),
						},
						district: {
							findUnique: jest.fn(),
						},
						ward: {
							findUnique: jest.fn(),
						},
					},
				},
			],
		}).compile();

		service = module.get<RoommateApplicationService>(RoommateApplicationService);
		prismaService = module.get<PrismaService>(PrismaService);
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('create', () => {
		it('should create application successfully', async () => {
			// Arrange
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

			const applicantId = 'applicant-1';

			const mockPost = {
				id: 'post-1',
				status: 'active',
				remainingSlots: 2,
				tenantId: 'tenant-1',
			};

			const mockApplication = {
				id: 'app-1',
				roommateSeekingPostId: createDto.roommateSeekingPostId,
				applicantId,
				fullName: createDto.fullName,
				occupation: createDto.occupation,
				phoneNumber: createDto.phoneNumber,
				moveInDate: new Date(createDto.moveInDate),
				intendedStayMonths: createDto.intendedStayMonths,
				applicationMessage: createDto.applicationMessage,
				status: 'pending',
				isUrgent: createDto.isUrgent,
				createdAt: new Date(),
				updatedAt: new Date(),
				applicant: {
					id: applicantId,
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

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(mockPost as any);
			jest.spyOn(prismaService.roommateApplication, 'findFirst').mockResolvedValue(null);
			jest
				.spyOn(prismaService.roommateApplication, 'create')
				.mockResolvedValue(mockApplication as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'update').mockResolvedValue({} as any);

			// Act
			const result = await service.create(createDto, applicantId);

			// Assert
			expect(result).toEqual({
				id: mockApplication.id,
				roommateSeekingPostId: mockApplication.roommateSeekingPostId,
				applicantId: mockApplication.applicantId,
				fullName: mockApplication.fullName,
				occupation: mockApplication.occupation,
				phoneNumber: mockApplication.phoneNumber,
				moveInDate: mockApplication.moveInDate.toISOString(),
				intendedStayMonths: mockApplication.intendedStayMonths,
				applicationMessage: mockApplication.applicationMessage,
				status: mockApplication.status,
				isUrgent: mockApplication.isUrgent,
				createdAt: mockApplication.createdAt.toISOString(),
				updatedAt: mockApplication.updatedAt.toISOString(),
				applicant: mockApplication.applicant,
				roommateSeekingPost: {
					...mockApplication.roommateSeekingPost,
					monthlyRent: Number(mockApplication.roommateSeekingPost.monthlyRent),
				},
			});

			expect(prismaService.roommateApplication.create).toHaveBeenCalledWith({
				data: {
					...createDto,
					applicantId,
					moveInDate: new Date(createDto.moveInDate),
				},
				include: expect.any(Object),
			});

			expect(prismaService.roommateSeekingPost.update).toHaveBeenCalledWith({
				where: { id: createDto.roommateSeekingPostId },
				data: { contactCount: { increment: 1 } },
			});
		});

		it('should throw NotFoundException when post not found', async () => {
			// Arrange
			const createDto = {
				roommateSeekingPostId: 'non-existent-id',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			jest.spyOn(prismaService.roommateSeekingPost, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(NotFoundException);
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(
				'Không tìm thấy bài đăng',
			);
		});

		it('should throw BadRequestException when post is not active', async () => {
			// Arrange
			const createDto = {
				roommateSeekingPostId: 'post-1',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			const mockPost = {
				id: 'post-1',
				status: 'closed',
				remainingSlots: 2,
				tenantId: 'tenant-1',
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(mockPost as any);

			// Act & Assert
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(
				'Bài đăng không còn mở cho ứng tuyển',
			);
		});

		it('should throw BadRequestException when no remaining slots', async () => {
			// Arrange
			const createDto = {
				roommateSeekingPostId: 'post-1',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			const mockPost = {
				id: 'post-1',
				status: 'active',
				remainingSlots: 0,
				tenantId: 'tenant-1',
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(mockPost as any);

			// Act & Assert
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(
				'Bài đăng đã hết slot trống',
			);
		});

		it('should throw BadRequestException when applying to own post', async () => {
			// Arrange
			const createDto = {
				roommateSeekingPostId: 'post-1',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			const mockPost = {
				id: 'post-1',
				status: 'active',
				remainingSlots: 2,
				tenantId: 'applicant-1', // Same as applicant
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(mockPost as any);

			// Act & Assert
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(
				'Không thể ứng tuyển vào bài đăng của chính mình',
			);
		});

		it('should throw BadRequestException when already applied', async () => {
			// Arrange
			const createDto = {
				roommateSeekingPostId: 'post-1',
				fullName: 'John Doe',
				phoneNumber: '+84901234567',
				moveInDate: '2024-01-01',
			};

			const mockPost = {
				id: 'post-1',
				status: 'active',
				remainingSlots: 2,
				tenantId: 'tenant-1',
			};

			const existingApplication = {
				id: 'existing-app',
				roommateSeekingPostId: 'post-1',
				applicantId: 'applicant-1',
				status: 'pending',
			};

			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue(mockPost as any);
			jest
				.spyOn(prismaService.roommateApplication, 'findFirst')
				.mockResolvedValue(existingApplication as any);

			// Act & Assert
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(BadRequestException);
			await expect(service.create(createDto, 'applicant-1')).rejects.toThrow(
				'Bạn đã ứng tuyển cho bài đăng này rồi',
			);
		});
	});

	describe('findMyApplications', () => {
		it('should return paginated applications for applicant', async () => {
			// Arrange
			const query = { page: 1, limit: 10 };
			const applicantId = 'applicant-1';

			const mockApplications = [
				{
					id: 'app-1',
					roommateSeekingPostId: 'post-1',
					applicantId,
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
					createdAt: new Date(),
					updatedAt: new Date(),
					applicant: {
						id: applicantId,
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
				},
			];

			jest
				.spyOn(prismaService.roommateApplication, 'findMany')
				.mockResolvedValue(mockApplications as any);
			jest.spyOn(prismaService.roommateApplication, 'count').mockResolvedValue(1);

			// Act
			const result = await service.findMyApplications(query, applicantId);

			// Assert
			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				id: mockApplications[0].id,
				roommateSeekingPostId: mockApplications[0].roommateSeekingPostId,
				applicantId: mockApplications[0].applicantId,
				fullName: mockApplications[0].fullName,
				occupation: mockApplications[0].occupation,
				phoneNumber: mockApplications[0].phoneNumber,
				moveInDate: mockApplications[0].moveInDate.toISOString(),
				intendedStayMonths: mockApplications[0].intendedStayMonths,
				applicationMessage: mockApplications[0].applicationMessage,
				status: mockApplications[0].status,
				isUrgent: mockApplications[0].isUrgent,
				createdAt: mockApplications[0].createdAt.toISOString(),
				updatedAt: mockApplications[0].updatedAt.toISOString(),
			});
			expect(result.meta).toMatchObject({
				page: 1,
				limit: 10,
				total: 1,
				totalPages: 1,
			});

			expect(prismaService.roommateApplication.findMany).toHaveBeenCalledWith({
				where: { applicantId },
				include: expect.any(Object),
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 10,
			});
		});
	});

	describe('findApplicationsForMyPosts', () => {
		it('should return paginated applications for tenant posts', async () => {
			// Arrange
			const query = { page: 1, limit: 10 };
			const tenantId = 'tenant-1';

			const mockApplications = [
				{
					id: 'app-1',
					roommateSeekingPostId: 'post-1',
					applicantId: 'applicant-1',
					fullName: 'John Doe',
					occupation: 'Developer',
					phoneNumber: '+84901234567',
					moveInDate: new Date('2024-01-01'),
					intendedStayMonths: 6,
					applicationMessage: 'I am interested',
					status: 'pending',
					isUrgent: false,
					createdAt: new Date(),
					updatedAt: new Date(),
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
						tenantId,
						monthlyRent: 2000000,
						tenant: {
							id: tenantId,
							firstName: 'Jane',
							lastName: 'Smith',
							avatarUrl: null,
						},
					},
				},
			];

			jest
				.spyOn(prismaService.roommateApplication, 'findMany')
				.mockResolvedValue(mockApplications as any);
			jest.spyOn(prismaService.roommateApplication, 'count').mockResolvedValue(1);

			// Act
			const result = await service.findApplicationsForMyPosts(query, tenantId);

			// Assert
			expect(result.data).toHaveLength(1);
			expect(prismaService.roommateApplication.findMany).toHaveBeenCalledWith({
				where: {
					roommateSeekingPost: {
						tenantId,
					},
				},
				include: expect.any(Object),
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 10,
			});
		});
	});

	describe('findOne', () => {
		it('should return application details for applicant', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';

			const mockApplication = {
				id: applicationId,
				roommateSeekingPostId: 'post-1',
				applicantId,
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: new Date('2024-01-01'),
				intendedStayMonths: 6,
				applicationMessage: 'I am interested',
				status: 'pending',
				isUrgent: false,
				createdAt: new Date(),
				updatedAt: new Date(),
				applicant: {
					id: applicantId,
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

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(mockApplication as any);

			// Act
			const result = await service.findOne(applicationId, applicantId);

			// Assert
			expect(result).toEqual({
				id: mockApplication.id,
				roommateSeekingPostId: mockApplication.roommateSeekingPostId,
				applicantId: mockApplication.applicantId,
				fullName: mockApplication.fullName,
				occupation: mockApplication.occupation,
				phoneNumber: mockApplication.phoneNumber,
				moveInDate: mockApplication.moveInDate.toISOString(),
				intendedStayMonths: mockApplication.intendedStayMonths,
				applicationMessage: mockApplication.applicationMessage,
				status: mockApplication.status,
				isUrgent: mockApplication.isUrgent,
				createdAt: mockApplication.createdAt.toISOString(),
				updatedAt: mockApplication.updatedAt.toISOString(),
				applicant: mockApplication.applicant,
				roommateSeekingPost: {
					...mockApplication.roommateSeekingPost,
					monthlyRent: Number(mockApplication.roommateSeekingPost.monthlyRent),
				},
			});
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const applicantId = 'applicant-1';

			jest.spyOn(prismaService.roommateApplication, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.findOne(applicationId, applicantId)).rejects.toThrow(NotFoundException);
			await expect(service.findOne(applicationId, applicantId)).rejects.toThrow(
				'Không tìm thấy đơn ứng tuyển',
			);
		});

		it('should throw ForbiddenException when user has no permission', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';
			const otherUserId = 'other-user';

			const mockApplication = {
				id: applicationId,
				applicantId: 'other-applicant',
				roommateSeekingPost: {
					tenantId: 'other-tenant',
				},
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(mockApplication as any);

			// Act & Assert
			await expect(service.findOne(applicationId, otherUserId)).rejects.toThrow(ForbiddenException);
			await expect(service.findOne(applicationId, otherUserId)).rejects.toThrow(
				'Không có quyền xem đơn ứng tuyển này',
			);
		});
	});

	describe('update', () => {
		it('should update application successfully', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';
			const updateDto = {
				fullName: 'Updated Name',
				applicationMessage: 'Updated message',
			};

			const existingApplication = {
				id: applicationId,
				applicantId,
				status: 'pending',
			};

			const updatedApplication = {
				...existingApplication,
				fullName: updateDto.fullName,
				applicationMessage: updateDto.applicationMessage,
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: new Date('2024-01-01'),
				intendedStayMonths: 6,
				isUrgent: false,
				createdAt: new Date(),
				updatedAt: new Date(),
				applicant: {
					id: applicantId,
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

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(existingApplication as any);
			jest
				.spyOn(prismaService.roommateApplication, 'update')
				.mockResolvedValue(updatedApplication as any);

			// Act
			const result = await service.update(applicationId, updateDto, applicantId);

			// Assert
			expect(result.fullName).toBe(updateDto.fullName);
			expect(result.applicationMessage).toBe(updateDto.applicationMessage);
			expect(prismaService.roommateApplication.update).toHaveBeenCalledWith({
				where: { id: applicationId },
				data: {
					...updateDto,
					moveInDate: undefined,
				},
				include: expect.any(Object),
			});
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const applicantId = 'applicant-1';
			const updateDto = { fullName: 'Updated Name' };

			jest.spyOn(prismaService.roommateApplication, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.update(applicationId, updateDto, applicantId)).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should throw ForbiddenException when user is not applicant', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';
			const otherApplicantId = 'other-applicant';
			const updateDto = { fullName: 'Updated Name' };

			const existingApplication = {
				id: applicationId,
				applicantId: otherApplicantId,
				status: 'pending',
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(existingApplication as any);

			// Act & Assert
			await expect(service.update(applicationId, updateDto, applicantId)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it('should throw BadRequestException when application is not pending', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';
			const updateDto = { fullName: 'Updated Name' };

			const existingApplication = {
				id: applicationId,
				applicantId,
				status: RoommateApplicationStatus.approved_by_tenant,
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(existingApplication as any);

			// Act & Assert
			await expect(service.update(applicationId, updateDto, applicantId)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.update(applicationId, updateDto, applicantId)).rejects.toThrow(
				'Chỉ có thể chỉnh sửa đơn ứng tuyển đang chờ xử lý',
			);
		});
	});

	describe('respondToApplication', () => {
		it('should respond to application as tenant', async () => {
			// Arrange
			const applicationId = 'app-1';
			const tenantId = 'tenant-1';
			const respondDto = {
				status: RoommateApplicationStatus.approved_by_tenant,
				response: 'Welcome to the room!',
			};

			const mockApplication = {
				id: applicationId,
				status: 'pending',
				fullName: 'John Doe',
				occupation: 'Developer',
				phoneNumber: '+84901234567',
				moveInDate: new Date('2024-01-01'),
				intendedStayMonths: 6,
				applicationMessage: 'I am interested',
				isUrgent: false,
				createdAt: new Date(),
				updatedAt: new Date(),
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
					tenantId,
					monthlyRent: 2000000,
					tenant: {
						id: tenantId,
						firstName: 'Jane',
						lastName: 'Smith',
						avatarUrl: null,
					},
					roomInstance: {
						rentals: [
							{
								status: 'active',
								owner: { id: 'landlord-1' },
							},
						],
					},
				},
			};

			const updatedApplication = {
				...mockApplication,
				status: respondDto.status,
				tenantResponse: respondDto.response,
				tenantRespondedAt: new Date(),
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
					tenantId,
					monthlyRent: 2000000,
					tenant: {
						id: tenantId,
						firstName: 'Jane',
						lastName: 'Smith',
						avatarUrl: null,
					},
				},
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(mockApplication as any);
			jest
				.spyOn(prismaService.roommateApplication, 'update')
				.mockResolvedValue(updatedApplication as any);
			jest.spyOn(prismaService.roommateSeekingPost, 'update').mockResolvedValue({} as any);
			jest
				.spyOn(prismaService.roommateSeekingPost, 'findUnique')
				.mockResolvedValue({ remainingSlots: 1 } as any);

			// Act
			const result = await service.respondToApplication(applicationId, respondDto, tenantId);

			// Assert
			expect(result.status).toBe(respondDto.status);
			expect(prismaService.roommateApplication.update).toHaveBeenCalledWith({
				where: { id: applicationId },
				data: {
					status: respondDto.status,
					tenantResponse: respondDto.response,
					tenantRespondedAt: expect.any(Date),
				},
				include: expect.any(Object),
			});
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const tenantId = 'tenant-1';
			const respondDto = { status: RoommateApplicationStatus.approved_by_tenant };

			jest.spyOn(prismaService.roommateApplication, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(
				service.respondToApplication(applicationId, respondDto, tenantId),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException when user has no permission', async () => {
			// Arrange
			const applicationId = 'app-1';
			const tenantId = 'tenant-1';
			const otherUserId = 'other-user';
			const respondDto = { status: RoommateApplicationStatus.approved_by_tenant };

			const mockApplication = {
				id: applicationId,
				status: 'pending',
				roommateSeekingPost: {
					tenantId: 'other-tenant',
					roomInstance: {
						rentals: [
							{
								status: 'active',
								owner: { id: 'other-landlord' },
							},
						],
					},
				},
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(mockApplication as any);

			// Act & Assert
			await expect(
				service.respondToApplication(applicationId, respondDto, otherUserId),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('cancel', () => {
		it('should cancel application successfully', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';

			const existingApplication = {
				id: applicationId,
				applicantId,
				status: 'pending',
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(existingApplication as any);
			jest.spyOn(prismaService.roommateApplication, 'update').mockResolvedValue({} as any);

			// Act
			await service.cancel(applicationId, applicantId);

			// Assert
			expect(prismaService.roommateApplication.update).toHaveBeenCalledWith({
				where: { id: applicationId },
				data: { status: 'cancelled' },
			});
		});

		it('should throw NotFoundException when application not found', async () => {
			// Arrange
			const applicationId = 'non-existent';
			const applicantId = 'applicant-1';

			jest.spyOn(prismaService.roommateApplication, 'findUnique').mockResolvedValue(null);

			// Act & Assert
			await expect(service.cancel(applicationId, applicantId)).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException when user is not applicant', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';
			const otherApplicantId = 'other-applicant';

			const existingApplication = {
				id: applicationId,
				applicantId: otherApplicantId,
				status: 'pending',
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(existingApplication as any);

			// Act & Assert
			await expect(service.cancel(applicationId, applicantId)).rejects.toThrow(ForbiddenException);
		});

		it('should throw BadRequestException when application is not pending', async () => {
			// Arrange
			const applicationId = 'app-1';
			const applicantId = 'applicant-1';

			const existingApplication = {
				id: applicationId,
				applicantId,
				status: RoommateApplicationStatus.approved_by_tenant,
			};

			jest
				.spyOn(prismaService.roommateApplication, 'findUnique')
				.mockResolvedValue(existingApplication as any);

			// Act & Assert
			await expect(service.cancel(applicationId, applicantId)).rejects.toThrow(BadRequestException);
			await expect(service.cancel(applicationId, applicantId)).rejects.toThrow(
				'Chỉ có thể hủy đơn ứng tuyển đang chờ xử lý',
			);
		});
	});

	describe('bulkRespondToApplications', () => {
		it('should process bulk responses successfully', async () => {
			// Arrange
			const bulkDto = {
				applicationIds: ['app-1', 'app-2'],
				status: RoommateApplicationStatus.approved_by_tenant,
				response: 'All approved!',
			};

			const userId = 'tenant-1';

			// Mock the respondToApplication method
			jest.spyOn(service, 'respondToApplication').mockResolvedValue({} as any);

			// Act
			const result = await service.bulkRespondToApplications(bulkDto, userId);

			// Assert
			expect(result).toEqual({
				successCount: 2,
				failureCount: 0,
				errors: [],
				processedApplications: ['app-1', 'app-2'],
			});

			expect(service.respondToApplication).toHaveBeenCalledTimes(2);
			expect(service.respondToApplication).toHaveBeenCalledWith(
				'app-1',
				{ status: bulkDto.status, response: bulkDto.response },
				userId,
			);
			expect(service.respondToApplication).toHaveBeenCalledWith(
				'app-2',
				{ status: bulkDto.status, response: bulkDto.response },
				userId,
			);
		});

		it('should handle partial failures in bulk response', async () => {
			// Arrange
			const bulkDto = {
				applicationIds: ['app-1', 'app-2'],
				status: RoommateApplicationStatus.approved_by_tenant,
				response: 'All approved!',
			};

			const userId = 'tenant-1';

			// Mock the respondToApplication method to fail for app-2
			jest
				.spyOn(service, 'respondToApplication')
				.mockResolvedValueOnce({} as any) // Success for app-1
				.mockRejectedValueOnce(new Error('Not found')); // Failure for app-2

			// Act
			const result = await service.bulkRespondToApplications(bulkDto, userId);

			// Assert
			expect(result).toEqual({
				successCount: 1,
				failureCount: 1,
				errors: [
					{
						applicationId: 'app-2',
						error: 'Not found',
					},
				],
				processedApplications: ['app-1'],
			});
		});
	});

	describe('getApplicationStatistics', () => {
		it('should return statistics for my applications', async () => {
			// Arrange
			const userId = 'applicant-1';
			const isForMyPosts = false;

			const statusCounts = [
				{ status: 'pending', _count: 5 },
				{ status: 'approved_by_tenant', _count: 3 },
				{ status: 'rejected_by_tenant', _count: 2 },
			];

			const dailyStats = [
				{ createdAt: new Date('2024-01-01'), _count: 2 },
				{ createdAt: new Date('2024-01-02'), _count: 1 },
			];

			(prismaService.roommateApplication.groupBy as jest.Mock)
				.mockResolvedValueOnce(statusCounts)
				.mockResolvedValueOnce(dailyStats);
			(prismaService.roommateApplication.count as jest.Mock).mockResolvedValue(10);

			// Act
			const result = await service.getApplicationStatistics(userId, isForMyPosts);

			// Assert
			expect(result).toEqual({
				total: 10,
				pending: 5,
				approvedByTenant: 3,
				rejectedByTenant: 2,
				approvedByLandlord: 0,
				rejectedByLandlord: 0,
				cancelled: 0,
				expired: 0,
				urgent: 10,
				dailyStats: expect.any(Array),
				statusBreakdown: expect.any(Array),
			});

			expect(prismaService.roommateApplication.groupBy).toHaveBeenCalledWith({
				by: ['status'],
				where: { applicantId: userId },
				_count: true,
			});
		});

		it('should return statistics for my posts', async () => {
			// Arrange
			const userId = 'tenant-1';
			const isForMyPosts = true;

			const statusCounts = [
				{ status: 'pending', _count: 3 },
				{ status: 'approved_by_tenant', _count: 2 },
			];

			(prismaService.roommateApplication.groupBy as jest.Mock)
				.mockResolvedValueOnce(statusCounts)
				.mockResolvedValueOnce([]);
			(prismaService.roommateApplication.count as jest.Mock).mockResolvedValue(5);

			// Act
			const result = await service.getApplicationStatistics(userId, isForMyPosts);

			// Assert
			expect(result.total).toBe(5);
			expect(prismaService.roommateApplication.groupBy).toHaveBeenCalledWith({
				by: ['status'],
				where: { roommateSeekingPost: { tenantId: userId } },
				_count: true,
			});
		});
	});
});
