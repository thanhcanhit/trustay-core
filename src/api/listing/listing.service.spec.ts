import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils } from '../../test-utils';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { ListingService } from './listing.service';

describe('ListingService', () => {
	let service: ListingService;
	let authUtils: AuthTestUtils;
	let module: TestingModule;
	let mockPrismaService: jest.Mocked<PrismaService>;

	beforeAll(async () => {
		module = await Test.createTestingModule({
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
						roomSeekingPost: {
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
						tenantRoomPreferences: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
						},
						province: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
						},
						district: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
						},
						ward: {
							create: jest.fn(),
							findUnique: jest.fn(),
							findMany: jest.fn(),
							update: jest.fn(),
							delete: jest.fn(),
						},
						refreshToken: {
							deleteMany: jest.fn(),
						},
					},
				},
				ListingService,
			],
		}).compile();

		authUtils = AuthTestUtils.create(module);

		// Get the mocked PrismaService
		mockPrismaService = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;

		// Get the service
		service = module.get<ListingService>(ListingService);
	});

	beforeEach(async () => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('findAllListings', () => {
		it('should return paginated room listings with SEO and breadcrumb', async () => {
			// Arrange
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
				provinceId: 1,
				districtId: 1,
				roomType: 'boarding_house',
				minPrice: 1000000,
				maxPrice: 5000000,
			};

			const mockRooms = [
				{
					id: 'room-1',
					name: 'Test Room 1',
					slug: 'test-room-1',
					roomType: 'boarding_house',
					areaSqm: '25',
					maxOccupancy: 2,
					isVerified: true,
					createdAt: new Date(),
					updatedAt: new Date(),
					building: {
						id: 'building-1',
						name: 'Test Building 1',
						addressLine1: '123 Test Street',
						addressLine2: null,
						latitude: 10.762622,
						longitude: 106.660172,
						isVerified: true,
						province: { id: 1, name: 'Ho Chi Minh City', code: 'SG' },
						district: { id: 1, name: 'District 1', code: 'D1' },
						ward: { id: 1, name: 'Ward 1', code: 'W1' },
						owner: {
							id: 'owner-1',
							firstName: 'John',
							lastName: 'Doe',
							avatarUrl: 'https://example.com/avatar.jpg',
							gender: 'male',
							isVerifiedPhone: true,
							isVerifiedEmail: true,
							isVerifiedIdentity: true,
							isOnline: true,
							lastActiveAt: new Date(),
							overallRating: 4.5,
							totalRatings: 10,
						},
					},
					roomInstances: [
						{
							id: 'instance-1',
							roomNumber: '101',
							status: 'available',
							isActive: true,
						},
					],
					images: [
						{
							id: 'image-1',
							imageUrl: 'https://example.com/image1.jpg',
							altText: 'Room image',
							sortOrder: 1,
							isPrimary: true,
						},
					],
					amenities: [
						{
							id: 'amenity-1',
							customValue: null,
							notes: null,
							systemAmenity: {
								id: 'sys-amenity-1',
								name: 'WiFi',
								nameEn: 'WiFi',
								category: 'internet',
							},
						},
					],
					costs: [
						{
							id: 'cost-1',
							baseRate: '2000000',
							currency: 'VND',
							notes: null,
							systemCostType: {
								id: 'sys-cost-1',
								name: 'Monthly Rent',
								nameEn: 'Monthly Rent',
								category: 'rent',
								defaultUnit: 'month',
							},
						},
					],
					pricing: {
						id: 'pricing-1',
						basePriceMonthly: 2000000,
						currency: 'VND',
						depositAmount: 4000000,
						depositMonths: 2,
						utilityIncluded: false,
						utilityCostMonthly: 500000,
						minimumStayMonths: 3,
						maximumStayMonths: 12,
						priceNegotiable: true,
					},
					rules: [
						{
							id: 'rule-1',
							customValue: null,
							isEnforced: true,
							notes: null,
							systemRule: {
								id: 'sys-rule-1',
								ruleType: 'general',
								name: 'No Smoking',
								nameEn: 'No Smoking',
							},
						},
					],
				},
			];

			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue(mockRooms as any);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(1);
			(mockPrismaService.district.findUnique as jest.Mock).mockResolvedValue({
				name: 'District 1',
			});
			(mockPrismaService.province.findUnique as jest.Mock).mockResolvedValue({
				name: 'Ho Chi Minh City',
			});
			(mockPrismaService.ward.findUnique as jest.Mock).mockResolvedValue({ name: 'Ward 1' });

			// Mock owner stats
			(mockPrismaService.building.count as jest.Mock).mockResolvedValue(5);
			(mockPrismaService.roomInstance.count as jest.Mock).mockResolvedValue(20);

			// Act
			const result = await service.findAllListings(query, { isAuthenticated: false });

			// Assert
			expect(result).toBeDefined();
			expect(result.data).toHaveLength(1);
			expect(result.meta).toBeDefined();
			expect(result.meta.page).toBe(1);
			expect(result.meta.limit).toBe(10);
			expect(result.meta.total).toBe(1);
			expect(result.seo).toBeDefined();
			expect(result.breadcrumb).toBeDefined();
			expect(result.data[0]).toHaveProperty('id', 'room-1');
			// Note: The service doesn't add 'type' property to individual room listings
			// This is only added in combined listings
		});

		it('should apply user preferences when authenticated and no explicit filters', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
			};

			const mockPreferences = {
				id: 'pref-1',
				tenantId: tenant.id,
				isActive: true,
				preferredProvinceIds: [1],
				preferredDistrictIds: [1],
				minBudget: 1000000,
				maxBudget: 5000000,
				preferredRoomTypes: ['boarding_house'],
				maxOccupancy: 2,
				requiresAmenityIds: ['amenity-1'],
			};

			(mockPrismaService.tenantRoomPreferences.findUnique as jest.Mock).mockResolvedValue(
				mockPreferences as any,
			);
			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(0);

			// Act
			await service.findAllListings(query, { isAuthenticated: true, userId: tenant.id });

			// Assert
			expect(mockPrismaService.tenantRoomPreferences.findUnique).toHaveBeenCalledWith({
				where: { tenantId: tenant.id },
			});
			expect(mockPrismaService.room.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						building: expect.objectContaining({
							provinceId: 1,
							districtId: 1,
						}),
						roomType: 'boarding_house',
						maxOccupancy: { lte: 2 },
					}),
				}),
			);
		});

		it('should filter by search keyword', async () => {
			// Arrange
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
				search: 'test room',
			};

			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(0);

			// Act
			await service.findAllListings(query, { isAuthenticated: false });

			// Assert
			expect(mockPrismaService.room.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						OR: [
							{ name: { contains: 'test room', mode: 'insensitive' } },
							{ description: { contains: 'test room', mode: 'insensitive' } },
							{
								building: {
									name: { contains: 'test room', mode: 'insensitive' },
								},
							},
						],
					}),
				}),
			);
		});

		it('should filter by price range', async () => {
			// Arrange
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
				minPrice: 1000000,
				maxPrice: 5000000,
			};

			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(0);

			// Act
			await service.findAllListings(query, { isAuthenticated: false });

			// Assert
			expect(mockPrismaService.room.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						pricing: {
							basePriceMonthly: {
								gte: 1000000,
								lte: 5000000,
							},
						},
					}),
				}),
			);
		});

		it('should filter by amenities', async () => {
			// Arrange
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
				amenities: 'amenity-1,amenity-2',
			};

			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(0);

			// Act
			await service.findAllListings(query, { isAuthenticated: false });

			// Assert
			expect(mockPrismaService.room.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						amenities: {
							some: {
								systemAmenityId: { in: ['amenity-1', 'amenity-2'] },
							},
						},
					}),
				}),
			);
		});
	});

	describe('findAllRoomRequests', () => {
		it('should return paginated room seeking posts with SEO and breadcrumb', async () => {
			// Arrange
			const query: RoomRequestSearchDto = {
				page: 1,
				limit: 10,
				provinceId: 1,
				districtId: 1,
				minBudget: 1000000,
				maxBudget: 5000000,
			};

			const mockPosts = [
				{
					id: 'post-1',
					title: 'Looking for room in District 1',
					description: 'Need a room near city center',
					slug: 'looking-for-room-district-1',
					requesterId: 'requester-1',
					preferredDistrictId: 1,
					preferredWardId: 1,
					preferredProvinceId: 1,
					minBudget: 1000000,
					maxBudget: 5000000,
					currency: 'VND',
					preferredRoomType: 'boarding_house',
					occupancy: 1,
					moveInDate: new Date(),
					status: 'active',
					isPublic: true,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					viewCount: 10,
					contactCount: 2,
					createdAt: new Date(),
					updatedAt: new Date(),
					requester: {
						id: 'requester-1',
						firstName: 'Jane',
						lastName: 'Doe',
						email: 'jane@example.com',
						phone: '+84901234567',
						avatarUrl: 'https://example.com/avatar.jpg',
					},
					amenities: [
						{
							id: 'amenity-1',
							name: 'WiFi',
							nameEn: 'WiFi',
							category: 'internet',
							description: 'Free WiFi',
						},
					],
					preferredProvince: {
						id: 1,
						name: 'Ho Chi Minh City',
						nameEn: 'Ho Chi Minh City',
					},
					preferredDistrict: {
						id: 1,
						name: 'District 1',
						nameEn: 'District 1',
					},
					preferredWard: {
						id: 1,
						name: 'Ward 1',
						nameEn: 'Ward 1',
					},
				},
			];

			(mockPrismaService.roomSeekingPost.findMany as jest.Mock).mockResolvedValue(mockPosts as any);
			(mockPrismaService.roomSeekingPost.count as jest.Mock).mockResolvedValue(1);
			(mockPrismaService.district.findUnique as jest.Mock).mockResolvedValue({
				name: 'District 1',
			});
			(mockPrismaService.province.findUnique as jest.Mock).mockResolvedValue({
				name: 'Ho Chi Minh City',
			});
			(mockPrismaService.ward.findUnique as jest.Mock).mockResolvedValue({ name: 'Ward 1' });

			// Act
			const result = await service.findAllRoomRequests(query, { isAuthenticated: false });

			// Assert
			expect(result).toBeDefined();
			expect(result.data).toHaveLength(1);
			expect(result.meta).toBeDefined();
			expect(result.meta.page).toBe(1);
			expect(result.meta.limit).toBe(10);
			expect(result.meta.total).toBe(1);
			expect(result.seo).toBeDefined();
			expect(result.breadcrumb).toBeDefined();
			expect(result.data[0]).toHaveProperty('id', 'post-1');
			expect(result.data[0]).toHaveProperty('title', 'Looking for room in District 1');
		});

		it('should mask requester data when not authenticated', async () => {
			// Arrange
			const query: RoomRequestSearchDto = {
				page: 1,
				limit: 10,
			};

			const mockPosts = [
				{
					id: 'post-1',
					title: 'Looking for room',
					description: 'Need a room',
					slug: 'looking-for-room',
					requesterId: 'requester-1',
					preferredDistrictId: null,
					preferredWardId: null,
					preferredProvinceId: null,
					minBudget: null,
					maxBudget: 5000000,
					currency: 'VND',
					preferredRoomType: 'boarding_house',
					occupancy: 1,
					moveInDate: null,
					status: 'active',
					isPublic: true,
					expiresAt: new Date(),
					viewCount: 0,
					contactCount: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					requester: {
						id: 'requester-1',
						firstName: 'Jane',
						lastName: 'Doe',
						email: 'jane@example.com',
						phone: '+84901234567',
						avatarUrl: null,
					},
					amenities: [],
					preferredProvince: null,
					preferredDistrict: null,
					preferredWard: null,
				},
			];

			(mockPrismaService.roomSeekingPost.findMany as jest.Mock).mockResolvedValue(mockPosts as any);
			(mockPrismaService.roomSeekingPost.count as jest.Mock).mockResolvedValue(1);

			// Act
			const result = await service.findAllRoomRequests(query, { isAuthenticated: false });

			// Assert
			expect(result.data[0].requester.firstName).toBeUndefined();
			expect(result.data[0].requester.lastName).toBeUndefined();
			expect(result.data[0].requester.email).toBe('jane@ex*******om');
			expect(result.data[0].requester.phone).toBe('+84******567');
			expect(result.data[0].requester.name).toBe('J*** D**');
		});

		it('should show full requester data when authenticated', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const query: RoomRequestSearchDto = {
				page: 1,
				limit: 10,
			};

			const mockPosts = [
				{
					id: 'post-1',
					title: 'Looking for room',
					description: 'Need a room',
					slug: 'looking-for-room',
					requesterId: tenant.id,
					preferredDistrictId: null,
					preferredWardId: null,
					preferredProvinceId: null,
					minBudget: null,
					maxBudget: 5000000,
					currency: 'VND',
					preferredRoomType: 'boarding_house',
					occupancy: 1,
					moveInDate: null,
					status: 'active',
					isPublic: true,
					expiresAt: new Date(),
					viewCount: 0,
					contactCount: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					requester: {
						id: tenant.id,
						firstName: tenant.firstName,
						lastName: tenant.lastName,
						email: tenant.email,
						phone: '+84901234567',
						avatarUrl: null,
					},
					amenities: [],
					preferredProvince: null,
					preferredDistrict: null,
					preferredWard: null,
				},
			];

			(mockPrismaService.roomSeekingPost.findMany as jest.Mock).mockResolvedValue(mockPosts as any);
			(mockPrismaService.roomSeekingPost.count as jest.Mock).mockResolvedValue(1);

			// Act
			const result = await service.findAllRoomRequests(query, {
				isAuthenticated: true,
				userId: tenant.id,
			});

			// Assert
			expect(result.data[0].requester.firstName).toBe(tenant.firstName);
			expect(result.data[0].requester.lastName).toBe(tenant.lastName);
			expect(result.data[0].requester.email).toBe(tenant.email);
			expect(result.data[0].requester.phone).toBe('+84901234567');
			expect(result.data[0].requester.name).toBe(`${tenant.firstName} ${tenant.lastName}`);
		});
	});

	describe('SEO Generation', () => {
		it('should generate SEO for room listings with location and price', async () => {
			// Arrange
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
				provinceId: 1,
				districtId: 1,
				roomType: 'boarding_house',
				minPrice: 1000000,
				maxPrice: 5000000,
			};

			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(0);
			(mockPrismaService.district.findUnique as jest.Mock).mockResolvedValue({
				name: 'District 1',
			});
			(mockPrismaService.province.findUnique as jest.Mock).mockResolvedValue({
				name: 'Ho Chi Minh City',
			});

			// Act
			const result = await service.findAllListings(query, { isAuthenticated: false });

			// Assert
			expect(result.seo.title).toContain('Tìm nhà trọ tại District 1, Ho Chi Minh City');
			expect(result.seo.title).toContain('từ 1.0 triệu đến 5.0 triệu');
			expect(result.seo.description).toContain('nhà trọ chất lượng cao');
			expect(result.seo.keywords).toContain('nhà trọ');
		});

		it('should generate SEO for room seeking posts', async () => {
			// Arrange
			const query: RoomRequestSearchDto = {
				page: 1,
				limit: 10,
				provinceId: 1,
				districtId: 1,
				minBudget: 1000000,
				maxBudget: 5000000,
			};

			(mockPrismaService.roomSeekingPost.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.roomSeekingPost.count as jest.Mock).mockResolvedValue(0);
			(mockPrismaService.district.findUnique as jest.Mock).mockResolvedValue({
				name: 'District 1',
			});
			(mockPrismaService.province.findUnique as jest.Mock).mockResolvedValue({
				name: 'Ho Chi Minh City',
			});

			// Act
			const result = await service.findAllRoomRequests(query, { isAuthenticated: false });

			// Assert
			expect(result.seo.title).toContain(
				'Tìm người thuê phòng trọ tại District 1, Ho Chi Minh City',
			);
			expect(result.seo.title).toContain('từ 1.0 triệu đến 5.0 triệu');
			expect(result.seo.description).toContain('Tìm người thuê phòng trọ chất lượng cao');
		});
	});

	describe('Breadcrumb Generation', () => {
		it('should generate breadcrumb for room listings', async () => {
			// Arrange
			const query: ListingQueryDto = {
				page: 1,
				limit: 10,
				provinceId: 1,
				districtId: 1,
				roomType: 'boarding_house',
				search: 'test room',
			};

			(mockPrismaService.room.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrismaService.room.count as jest.Mock).mockResolvedValue(0);
			(mockPrismaService.district.findUnique as jest.Mock).mockResolvedValue({
				name: 'District 1',
			});
			(mockPrismaService.province.findUnique as jest.Mock).mockResolvedValue({
				name: 'Ho Chi Minh City',
			});

			// Act
			const result = await service.findAllListings(query, { isAuthenticated: false });

			// Assert
			expect(result.breadcrumb.items).toHaveLength(6);
			expect(result.breadcrumb.items[0]).toEqual({ title: 'Trang chủ', path: '/' });
			expect(result.breadcrumb.items[1]).toEqual({ title: 'Tìm phòng trọ', path: '/rooms' });
			expect(result.breadcrumb.items[2]).toEqual({
				title: 'District 1',
				path: '/rooms?districtId=1',
			});
			expect(result.breadcrumb.items[3]).toEqual({
				title: 'Ho Chi Minh City',
				path: '/rooms?provinceId=1',
			});
			expect(result.breadcrumb.items[4]).toEqual({
				title: 'Nhà trọ',
				path: '/rooms?roomType=boarding_house',
			});
			expect(result.breadcrumb.items[5]).toEqual({
				title: '"test room"',
				path: '/rooms?search=test%20room',
			});
		});
	});
});
