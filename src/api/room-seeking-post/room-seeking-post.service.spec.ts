import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomType, SearchPostStatus } from '@prisma/client';
// Decimal not used in these tests
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomRequestDto, QueryRoomRequestDto, UpdateRoomRequestDto } from './dto';
import { RoomSeekingPostService } from './room-seeking-post.service';

describe('RoomRequestService', () => {
	let service: RoomSeekingPostService;

	const mockPrismaService = {
		roomSeekingPost: {
			create: jest.fn(),
			findMany: jest.fn(),
			count: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RoomSeekingPostService,
				{
					provide: PrismaService,
					useValue: mockPrismaService,
				},
			],
		}).compile();

		service = module.get<RoomSeekingPostService>(RoomSeekingPostService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('create', () => {
		const createDto: CreateRoomRequestDto = {
			title: 'Tìm trọ gần trường ĐH',
			description: 'Cần phòng gần trường ĐH',
			slug: 'tim-tro-gan-truong-dh',
			preferredProvinceId: 1,
			maxBudget: 5000000,
			currency: 'VND',
			preferredRoomType: RoomType.apartment,
			occupancy: 2,
			isPublic: true,
			amenityIds: ['amenity-1', 'amenity-2'],
		};

		const mockUser = { id: 'user-1' };

		it('should create a room request successfully', async () => {
			const mockCreatedRequest = {
				id: 'request-1',
				...createDto,
				requesterId: mockUser.id,
				status: SearchPostStatus.active,
				viewCount: 0,
				contactCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				requester: {
					id: mockUser.id,
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
				},
				amenities: [],
			};

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(null);
			mockPrismaService.roomSeekingPost.create.mockResolvedValue(mockCreatedRequest);

			const result = await service.create(createDto, mockUser.id);

			expect(result).toEqual(mockCreatedRequest);
			expect(mockPrismaService.roomSeekingPost.create).toHaveBeenCalledWith({
				data: {
					...createDto,
					requesterId: mockUser.id,
					status: SearchPostStatus.active,
					currency: 'VND',
					isPublic: true,
					amenities: {
						connect: [{ id: 'amenity-1' }, { id: 'amenity-2' }],
					},
				},
				include: expect.any(Object),
			});
		});

		it('should throw BadRequestException if slug already exists', async () => {
			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue({ id: 'existing-request' });

			await expect(service.create(createDto, mockUser.id)).rejects.toThrow(BadRequestException);
		});
	});

	describe('findAll', () => {
		const queryDto: QueryRoomRequestDto = {
			page: 1,
			limit: 20,
			search: 'trọ',
			sortBy: 'createdAt',
			sortOrder: 'desc',
		};

		it('should return paginated room requests', async () => {
			const mockRequests = [
				{
					id: 'request-1',
					title: 'Tìm trọ gần trường ĐH',
					requester: { id: 'user-1', firstName: 'John' },
					amenities: [],
				},
			];

			mockPrismaService.roomSeekingPost.findMany.mockResolvedValue(mockRequests);
			mockPrismaService.roomSeekingPost.count.mockResolvedValue(1);

			const result = await service.findAll(queryDto);

			expect(result).toEqual({
				data: mockRequests,
				total: 1,
				page: 1,
				limit: 20,
			});
		});
	});

	describe('findOne', () => {
		const requestId = 'request-1';

		it('should return a room request and increment view count', async () => {
			const mockRequest = {
				id: requestId,
				title: 'Tìm trọ gần trường ĐH',
				viewCount: 0,
				requester: { id: 'user-1', firstName: 'John' },
				amenities: [],
			};

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockRequest);
			mockPrismaService.roomSeekingPost.update.mockResolvedValue(mockRequest);

			const result = await service.findOne(requestId);

			expect(result).toEqual(mockRequest);
			expect(mockPrismaService.roomSeekingPost.update).toHaveBeenCalledWith({
				where: { id: requestId },
				data: { viewCount: { increment: 1 } },
			});
		});

		it('should throw NotFoundException if room request not found', async () => {
			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(null);

			await expect(service.findOne(requestId)).rejects.toThrow(NotFoundException);
		});
	});

	describe('update', () => {
		const requestId = 'request-1';
		const updateDto: UpdateRoomRequestDto = {
			title: 'Tìm trọ gần trường ĐH - Cập nhật',
			maxBudget: 6000000,
		};

		const mockUser = { id: 'user-1' };

		it('should update room request successfully', async () => {
			const mockExistingRequest = { requesterId: mockUser.id };
			const mockUpdatedRequest = {
				id: requestId,
				...updateDto,
				requester: { id: mockUser.id, firstName: 'John' },
				amenities: [],
			};

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockExistingRequest);
			mockPrismaService.roomSeekingPost.findFirst.mockResolvedValue(null);
			mockPrismaService.roomSeekingPost.update.mockResolvedValue(mockUpdatedRequest);

			const result = await service.update(requestId, updateDto, mockUser.id);

			expect(result).toEqual(mockUpdatedRequest);
		});

		it('should throw ForbiddenException if user is not the owner', async () => {
			const mockExistingRequest = { requesterId: 'other-user' };

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockExistingRequest);

			await expect(service.update(requestId, updateDto, mockUser.id)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});

	describe('remove', () => {
		const requestId = 'request-1';
		const mockUser = { id: 'user-1' };

		it('should delete room request successfully', async () => {
			const mockExistingRequest = { requesterId: mockUser.id };

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockExistingRequest);
			mockPrismaService.roomSeekingPost.delete.mockResolvedValue({});

			await service.remove(requestId, mockUser.id);

			expect(mockPrismaService.roomSeekingPost.delete).toHaveBeenCalledWith({
				where: { id: requestId },
			});
		});

		it('should throw ForbiddenException if user is not the owner', async () => {
			const mockExistingRequest = { requesterId: 'other-user' };

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockExistingRequest);

			await expect(service.remove(requestId, mockUser.id)).rejects.toThrow(ForbiddenException);
		});
	});

	describe('incrementContactCount', () => {
		const requestId = 'request-1';

		it('should increment contact count successfully', async () => {
			mockPrismaService.roomSeekingPost.update.mockResolvedValue({});

			await service.incrementContactCount(requestId);

			expect(mockPrismaService.roomSeekingPost.update).toHaveBeenCalledWith({
				where: { id: requestId },
				data: { contactCount: { increment: 1 } },
			});
		});
	});

	describe('updateStatus', () => {
		const requestId = 'request-1';
		const newStatus = SearchPostStatus.paused;
		const mockUser = { id: 'user-1' };

		it('should update status successfully', async () => {
			const mockExistingRequest = { requesterId: mockUser.id };
			const mockUpdatedRequest = {
				id: requestId,
				status: newStatus,
				requester: { id: mockUser.id, firstName: 'John' },
				amenities: [],
			};

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockExistingRequest);
			mockPrismaService.roomSeekingPost.update.mockResolvedValue(mockUpdatedRequest);

			const result = await service.updateStatus(requestId, newStatus, mockUser.id);

			expect(result).toEqual(mockUpdatedRequest);
		});

		it('should throw ForbiddenException if user is not the owner', async () => {
			const mockExistingRequest = { requesterId: 'other-user' };

			mockPrismaService.roomSeekingPost.findUnique.mockResolvedValue(mockExistingRequest);

			await expect(service.updateStatus(requestId, newStatus, mockUser.id)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});
});
