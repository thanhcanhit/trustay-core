import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils, createTestModule } from '../../test-utils';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';

describe('ListingController', () => {
	let app: INestApplication;
	let service: ListingService;
	let authUtils: AuthTestUtils;
	let module: TestingModule;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			controllers: [ListingController],
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

		// Get the service
		service = module.get<ListingService>(ListingService);

		// Create the app
		app = module.createNestApplication();
		await app.init();
	});

	beforeEach(async () => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await app.close();
		await module.close();
	});

	describe('GET /listings/rooms', () => {
		it('should return room listings without authentication', async () => {
			// Arrange
			const mockResponse = {
				data: [
					{
						id: 'room-1',
						type: 'room',
						name: 'Test Room 1',
						slug: 'test-room-1',
						roomType: 'boarding_house',
						areaSqm: '25',
						maxOccupancy: 2,
						isVerified: true,
						buildingName: 'Test Building 1',
						buildingVerified: true,
						address: '123 Test Street, District 1, Ho Chi Minh City',
						availableRooms: 1,
						overallRating: 4.5,
						totalRatings: 10,
						owner: {
							name: 'J*** D**',
							avatarUrl: 'https://example.com/avatar.jpg',
							gender: 'male',
							verifiedPhone: true,
							verifiedEmail: true,
							verifiedIdentity: true,
							overallRating: 4.5,
							totalRatings: 10,
						},
						location: {
							provinceId: 1,
							provinceName: 'Ho Chi Minh City',
							districtId: 1,
							districtName: 'District 1',
							wardId: 1,
							wardName: 'Ward 1',
						},
						images: [
							{
								url: 'https://example.com/image1.jpg',
								alt: 'Room image',
								isPrimary: true,
								sortOrder: 1,
							},
						],
						amenities: [
							{
								id: 'amenity-1',
								name: 'WiFi',
								category: 'internet',
							},
						],
						costs: [
							{
								id: 'cost-1',
								name: 'Monthly Rent',
								value: '2,000,000 VND',
							},
						],
						pricing: {
							basePriceMonthly: '2,000,000 VND',
							depositAmount: '4,000,000 VND',
							utilityIncluded: false,
						},
						rules: [
							{
								id: 'rule-1',
								name: 'No Smoking',
								type: 'general',
							},
						],
					},
				],
				meta: {
					page: 1,
					limit: 20,
					total: 1,
					totalPages: 1,
					hasNextPage: false,
					hasPreviousPage: false,
				},
				seo: {
					title: 'Tìm nhà trọ | Trustay',
					description:
						'Tìm nhà trọ chất lượng cao. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!',
					keywords: 'nhà trọ, phòng trọ, thuê phòng, đầy đủ tiện nghi, chất lượng cao',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm phòng trọ', path: '/rooms' },
					],
				},
			};

			// Mock service method
			jest.spyOn(service, 'findAllListings').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer()).get('/listings/rooms').expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findAllListings).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					limit: 20,
				}),
				{ isAuthenticated: false, userId: undefined },
			);
		});

		it('should return room listings with authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const mockResponse = {
				data: [],
				meta: {
					page: 1,
					limit: 20,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
				},
				seo: {
					title: 'Tìm nhà trọ | Trustay',
					description:
						'Tìm nhà trọ chất lượng cao. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!',
					keywords: 'nhà trọ, phòng trọ, thuê phòng, đầy đủ tiện nghi, chất lượng cao',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm phòng trọ', path: '/rooms' },
					],
				},
			};

			jest.spyOn(service, 'findAllListings').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/rooms')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findAllListings).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					limit: 20,
				}),
				{ isAuthenticated: true, userId: tenant.id },
			);
		});

		it('should handle query parameters correctly', async () => {
			// Arrange
			const queryParams = {
				page: '2',
				limit: '10',
				provinceId: '1',
				districtId: '1',
				wardId: '1',
				roomType: 'boarding_house',
				minPrice: '1000000',
				maxPrice: '5000000',
				minArea: '20',
				maxArea: '50',
				amenities: 'amenity-1,amenity-2',
				maxOccupancy: '2',
				isVerified: 'true',
				latitude: '10.762622',
				longitude: '106.660172',
				radius: '5',
				sortBy: 'price',
				sortOrder: 'asc',
			};

			const mockResponse = {
				data: [],
				meta: {
					page: 2,
					limit: 10,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: true,
				},
				seo: {
					title: 'Tìm nhà trọ | Trustay',
					description:
						'Tìm nhà trọ chất lượng cao. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!',
					keywords: 'nhà trọ, phòng trọ, thuê phòng, đầy đủ tiện nghi, chất lượng cao',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm phòng trọ', path: '/rooms' },
					],
				},
			};

			jest.spyOn(service, 'findAllListings').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/rooms')
				.query(queryParams)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findAllListings).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 2,
					limit: 10,
					provinceId: 1,
					districtId: 1,
					wardId: 1,
					roomType: 'boarding_house',
					minPrice: 1000000,
					maxPrice: 5000000,
					minArea: 20,
					maxArea: 50,
					amenities: 'amenity-1,amenity-2',
					maxOccupancy: 2,
					isVerified: true,
					latitude: 10.762622,
					longitude: 106.660172,
					radius: 5,
					sortBy: 'price',
					sortOrder: 'asc',
				}),
				{ isAuthenticated: false, userId: undefined },
			);
		});

		it('should return 400 for invalid query parameters', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/listings/rooms')
				.query({
					page: 'invalid',
					limit: 'invalid',
					minPrice: 'invalid',
					maxPrice: 'invalid',
				})
				.expect(400);
		});
	});

	describe('GET /listings/room-seeking-posts', () => {
		it('should return room seeking posts without authentication', async () => {
			// Arrange
			const mockResponse = {
				data: [
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
						moveInDate: new Date().toISOString(),
						status: 'active',
						isPublic: true,
						expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
						viewCount: 10,
						contactCount: 2,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						requester: {
							id: 'requester-1',
							firstName: undefined,
							lastName: undefined,
							email: 'jane@ex*******om',
							phone: '+84******567',
							avatarUrl: 'https://example.com/avatar.jpg',
							name: 'J*** D**',
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
				],
				meta: {
					page: 1,
					limit: 20,
					total: 1,
					totalPages: 1,
					hasNextPage: false,
					hasPreviousPage: false,
				},
				seo: {
					title: 'Tìm người thuê nhà trọ | Trustay',
					description:
						'Tìm người thuê nhà trọ chất lượng cao. Kết nối chủ nhà và người thuê hiệu quả. Đăng tin miễn phí!',
					keywords: 'tìm người thuê, đăng tin tìm trọ, room seeking, nhà trọ, chủ nhà, người thuê',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm người thuê', path: '/room-seekings' },
					],
				},
			};

			jest.spyOn(service, 'findAllRoomRequests').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/room-seeking-posts')
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findAllRoomRequests).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					limit: 20,
				}),
				{ isAuthenticated: false, userId: undefined },
			);
		});

		it('should return room seeking posts with authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const mockResponse = {
				data: [],
				meta: {
					page: 1,
					limit: 20,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
				},
				seo: {
					title: 'Tìm người thuê nhà trọ | Trustay',
					description:
						'Tìm người thuê nhà trọ chất lượng cao. Kết nối chủ nhà và người thuê hiệu quả. Đăng tin miễn phí!',
					keywords: 'tìm người thuê, đăng tin tìm trọ, room seeking, nhà trọ, chủ nhà, người thuê',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm người thuê', path: '/room-seekings' },
					],
				},
			};

			jest.spyOn(service, 'findAllRoomRequests').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/room-seeking-posts')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findAllRoomRequests).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					limit: 20,
				}),
				{ isAuthenticated: true, userId: tenant.id },
			);
		});

		it('should handle query parameters correctly', async () => {
			// Arrange
			const queryParams = {
				page: '2',
				limit: '10',
				provinceId: '1',
				districtId: '1',
				wardId: '1',
				minBudget: '1000000',
				maxBudget: '5000000',
				roomType: 'boarding_house',
				occupancy: '2',
				amenities: 'amenity-1,amenity-2',
				moveInDate: '2024-01-01',
				status: 'active',
				isPublic: 'true',
				requesterId: 'requester-1',
				sortBy: 'createdAt',
				sortOrder: 'desc',
			};

			const mockResponse = {
				data: [],
				meta: {
					page: 2,
					limit: 10,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: true,
				},
				seo: {
					title: 'Tìm người thuê nhà trọ | Trustay',
					description:
						'Tìm người thuê nhà trọ chất lượng cao. Kết nối chủ nhà và người thuê hiệu quả. Đăng tin miễn phí!',
					keywords: 'tìm người thuê, đăng tin tìm trọ, room seeking, nhà trọ, chủ nhà, người thuê',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm người thuê', path: '/room-seekings' },
					],
				},
			};

			jest.spyOn(service, 'findAllRoomRequests').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/room-seeking-posts')
				.query(queryParams)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findAllRoomRequests).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 2,
					limit: 10,
					provinceId: 1,
					districtId: 1,
					wardId: 1,
					minBudget: 1000000,
					maxBudget: 5000000,
					roomType: 'boarding_house',
					occupancy: 2,
					amenities: 'amenity-1,amenity-2',
					moveInDate: new Date('2024-01-01'),
					status: 'active',
					isPublic: true,
					requesterId: 'requester-1',
					sortBy: 'createdAt',
					sortOrder: 'desc',
				}),
				{ isAuthenticated: false, userId: undefined },
			);
		});
	});

	describe('GET /listings/combined', () => {
		it('should return combined listings without authentication', async () => {
			// Arrange
			const mockResponse = {
				data: [
					{
						id: 'room-1',
						type: 'room',
						name: 'Test Room 1',
						slug: 'test-room-1',
						roomType: 'boarding_house',
						areaSqm: '25',
						maxOccupancy: 2,
						isVerified: true,
						buildingName: 'Test Building 1',
						buildingVerified: true,
						address: '123 Test Street, District 1, Ho Chi Minh City',
						availableRooms: 1,
						overallRating: 4.5,
						totalRatings: 10,
						owner: {
							name: 'J*** D**',
							avatarUrl: 'https://example.com/avatar.jpg',
							gender: 'male',
							verifiedPhone: true,
							verifiedEmail: true,
							verifiedIdentity: true,
							overallRating: 4.5,
							totalRatings: 10,
						},
						location: {
							provinceId: 1,
							provinceName: 'Ho Chi Minh City',
							districtId: 1,
							districtName: 'District 1',
							wardId: 1,
							wardName: 'Ward 1',
						},
						images: [],
						amenities: [],
						costs: [],
						pricing: {
							basePriceMonthly: '2,000,000 VND',
							depositAmount: '4,000,000 VND',
							utilityIncluded: false,
						},
						rules: [],
					},
					{
						id: 'roommate-post-1',
						type: 'roommate_seeking',
						title: 'Looking for roommate',
						description: 'Need a roommate to share costs',
						slug: 'looking-for-roommate',
						minBudget: undefined,
						maxBudget: 2000000,
						currency: 'VND',
						preferredRoomType: undefined,
						occupancy: 1,
						moveInDate: new Date().toISOString(),
						status: 'active',
						viewCount: 5,
						contactCount: 2,
						createdAt: new Date().toISOString(),
						requester: {
							id: 'tenant-1',
							name: 'J*** D**',
							email: 'jane@ex*******om',
							phone: '+84******567',
							avatarUrl: null,
						},
						preferredProvince: undefined,
						preferredDistrict: undefined,
						preferredWard: undefined,
						amenities: [],
					},
				],
				meta: {
					page: 1,
					limit: 20,
					total: 2,
					totalPages: 1,
					hasNextPage: false,
					hasPreviousPage: false,
				},
				seo: {
					title: 'Tìm nhà trọ | Trustay',
					description:
						'Tìm nhà trọ chất lượng cao. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!',
					keywords: 'nhà trọ, phòng trọ, thuê phòng, đầy đủ tiện nghi, chất lượng cao',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm phòng trọ', path: '/rooms' },
					],
				},
				stats: {
					totalRooms: 1,
					totalRoommateSeekingPosts: 1,
				},
			};

			jest.spyOn(service, 'findCombinedListings').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer()).get('/listings/combined').expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findCombinedListings).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					limit: 20,
				}),
				{ isAuthenticated: false, userId: undefined },
			);
		});

		it('should return combined listings with authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const mockResponse = {
				data: [],
				meta: {
					page: 1,
					limit: 20,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false,
				},
				seo: {
					title: 'Tìm nhà trọ | Trustay',
					description:
						'Tìm nhà trọ chất lượng cao. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!',
					keywords: 'nhà trọ, phòng trọ, thuê phòng, đầy đủ tiện nghi, chất lượng cao',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm phòng trọ', path: '/rooms' },
					],
				},
				stats: {
					totalRooms: 0,
					totalRoommateSeekingPosts: 0,
				},
			};

			jest.spyOn(service, 'findCombinedListings').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/combined')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findCombinedListings).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					limit: 20,
				}),
				{ isAuthenticated: true, userId: tenant.id },
			);
		});

		it('should handle query parameters correctly', async () => {
			// Arrange
			const queryParams = {
				page: '2',
				limit: '10',
				provinceId: '1',
				districtId: '1',
				wardId: '1',
				roomType: 'boarding_house',
				minPrice: '1000000',
				maxPrice: '5000000',
				sortBy: 'price',
				sortOrder: 'asc',
			};

			const mockResponse = {
				data: [],
				meta: {
					page: 2,
					limit: 10,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: true,
				},
				seo: {
					title: 'Tìm nhà trọ | Trustay',
					description:
						'Tìm nhà trọ chất lượng cao. Hàng ngàn phòng trọ đầy đủ tiện nghi, giá tốt nhất. Đặt phòng ngay!',
					keywords: 'nhà trọ, phòng trọ, thuê phòng, đầy đủ tiện nghi, chất lượng cao',
				},
				breadcrumb: {
					items: [
						{ title: 'Trang chủ', path: '/' },
						{ title: 'Tìm phòng trọ', path: '/rooms' },
					],
				},
				stats: {
					totalRooms: 0,
					totalRoommateSeekingPosts: 0,
				},
			};

			jest.spyOn(service, 'findCombinedListings').mockResolvedValue(mockResponse as any);

			// Act
			const response = await request(app.getHttpServer())
				.get('/listings/combined')
				.query(queryParams)
				.expect(200);

			// Assert
			expect(response.body).toEqual(mockResponse);
			expect(service.findCombinedListings).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 2,
					limit: 10,
					provinceId: 1,
					districtId: 1,
					wardId: 1,
					roomType: 'boarding_house',
					minPrice: 1000000,
					maxPrice: 5000000,
					sortBy: 'price',
					sortOrder: 'asc',
				}),
				{ isAuthenticated: false, userId: undefined },
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle service errors gracefully', async () => {
			// Arrange
			jest
				.spyOn(service, 'findAllListings')
				.mockRejectedValue(new Error('Database connection failed'));

			// Act & Assert
			await request(app.getHttpServer()).get('/listings/rooms').expect(500);
		});

		it('should handle validation errors', async () => {
			// Act & Assert
			await request(app.getHttpServer())
				.get('/listings/rooms')
				.query({
					page: 'invalid',
					limit: 'invalid',
					minPrice: 'invalid',
					maxPrice: 'invalid',
				})
				.expect(400);
		});
	});
});
