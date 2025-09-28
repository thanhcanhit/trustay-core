import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTestUtils } from '../../test-utils';

describe('RoommateSeekingPostController (Integration)', () => {
	let app: INestApplication;
	let authUtils: AuthTestUtils;
	let prismaService: PrismaService;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.setGlobalPrefix('api');
		app.useGlobalPipes(new ValidationPipe({ transform: true }));
		await app.init();

		prismaService = moduleFixture.get<PrismaService>(PrismaService);
		authUtils = new AuthTestUtils(app);
	});

	afterAll(async () => {
		await app.close();
	});

	describe('POST /roommate-seeking-posts', () => {
		it('should create a roommate seeking post with sample data from Postman collection', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			const createDto = {
				title: 'Tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				description:
					'Sinh viên năm 3 tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa, ưu tiên khu vực Thủ Đức. Cần phòng có điều hòa, wifi, gần chợ và bến xe buýt.',
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
				availableFromDate: '2024-09-01',
				minimumStayMonths: 3,
				maximumStayMonths: 12,
				currency: 'VND',
				preferredGender: 'male',
				additionalRequirements: 'Không hút thuốc, giữ gìn vệ sinh chung',
				requiresLandlordApproval: false,
				expiresAt: '2024-12-31',
			};

			// Act
			const response = await request(app.getHttpServer())
				.post('/api/roommate-seeking-posts')
				.set(headers)
				.send(createDto)
				.expect(201);

			// Assert
			expect(response.body).toMatchObject({
				title: createDto.title,
				description: createDto.description,
				tenantId: tenant.id,
				monthlyRent: createDto.monthlyRent,
				depositAmount: createDto.depositAmount,
				seekingCount: createDto.seekingCount,
				maxOccupancy: createDto.maxOccupancy,
				currentOccupancy: createDto.currentOccupancy,
				minimumStayMonths: createDto.minimumStayMonths,
				maximumStayMonths: createDto.maximumStayMonths,
				currency: createDto.currency,
				preferredGender: createDto.preferredGender,
				additionalRequirements: createDto.additionalRequirements,
				status: 'draft',
				requiresLandlordApproval: false,
				isActive: true,
			});

			// Verify post was created in database
			const createdPost = await prismaService.roommateSeekingPost.findUnique({
				where: { id: response.body.id },
				include: { tenant: true },
			});

			expect(createdPost).toBeTruthy();
			expect(createdPost?.tenantId).toBe(tenant.id);
			expect(createdPost?.title).toBe(createDto.title);
			expect(createdPost?.description).toBe(createDto.description);
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
				.post('/api/roommate-seeking-posts')
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
				.post('/api/roommate-seeking-posts')
				.set(headers)
				.send(invalidDto)
				.expect(400);
		});
	});

	describe('GET /roommate-seeking-posts/me', () => {
		it('should return my posts with pagination', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);

			// Create multiple test posts
			await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				description: 'Sinh viên năm 3 tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});

			await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ khu vực Thủ Đức',
				description: 'Cần tìm người ở ghép phòng trọ khu vực Thủ Đức, gần trường học',
				monthlyRent: 2500000,
				depositAmount: 5000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});

			// Act
			const response = await request(app.getHttpServer())
				.get('/api/roommate-seeking-posts/me?page=1&limit=10')
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body.data).toHaveLength(2);
			expect(response.body.meta.total).toBe(2);
			expect(response.body.meta.page).toBe(1);
			expect(response.body.meta.limit).toBe(10);
			expect(response.body.data[0]).toMatchObject({
				tenantId: tenant.id,
			});
		});

		it('should return 401 when not authenticated', async () => {
			// Act & Assert
			await request(app.getHttpServer()).get('/api/roommate-seeking-posts/me').expect(401);
		});
	});

	describe('GET /roommate-seeking-posts/:id', () => {
		it('should return post details without authentication', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const post = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				description:
					'Sinh viên năm 3 tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa, ưu tiên khu vực Thủ Đức',
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});

			// Act
			const response = await request(app.getHttpServer())
				.get(`/api/roommate-seeking-posts/${post.id}`)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: post.id,
				title: 'Tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				description:
					'Sinh viên năm 3 tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa, ưu tiên khu vực Thủ Đức',
				tenantId: tenant.id,
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
				isOwner: false,
				canEdit: false,
				canApply: true,
			});
		});

		it('should return post details with authentication as owner', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const post = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ khu vực Thủ Đức',
				description: 'Cần tìm người ở ghép phòng trọ khu vực Thủ Đức, gần trường học',
				monthlyRent: 2500000,
				depositAmount: 5000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});

			// Act
			const response = await request(app.getHttpServer())
				.get(`/api/roommate-seeking-posts/${post.id}`)
				.set(headers)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: post.id,
				title: 'Tìm người ở ghép phòng trọ khu vực Thủ Đức',
				description: 'Cần tìm người ở ghép phòng trọ khu vực Thủ Đức, gần trường học',
				tenantId: tenant.id,
				monthlyRent: 2500000,
				depositAmount: 5000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
				isOwner: true,
				canEdit: true,
				canApply: false,
			});
		});

		it('should return 404 when post not found', async () => {
			// Arrange
			const postId = 'non-existent-id';

			// Act & Assert
			await request(app.getHttpServer()).get(`/api/roommate-seeking-posts/${postId}`).expect(404);
		});
	});

	describe('PATCH /roommate-seeking-posts/:id', () => {
		it('should update post successfully with sample data', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const post = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				description: 'Sinh viên năm 3 tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa',
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});

			const updateDto = {
				title: 'Tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa - Cập nhật',
				description:
					'Sinh viên năm 3 tìm người ở ghép phòng trọ gần trường ĐH Bách Khoa, ưu tiên khu vực Thủ Đức. Cần phòng có điều hòa, wifi, gần chợ và bến xe buýt. Có thể chia sẻ phòng với bạn cùng lớp.',
				monthlyRent: 2500000,
				depositAmount: 5000000,
				seekingCount: 2,
				maxOccupancy: 3,
				currentOccupancy: 1,
				preferredGender: 'female',
				additionalRequirements: 'Không hút thuốc, giữ gìn vệ sinh chung, yêu thích âm nhạc',
			};

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/api/roommate-seeking-posts/${post.id}`)
				.set(headers)
				.send(updateDto)
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: post.id,
				title: updateDto.title,
				description: updateDto.description,
				tenantId: tenant.id,
				monthlyRent: updateDto.monthlyRent,
				depositAmount: updateDto.depositAmount,
				seekingCount: updateDto.seekingCount,
				maxOccupancy: updateDto.maxOccupancy,
				currentOccupancy: updateDto.currentOccupancy,
				preferredGender: updateDto.preferredGender,
				additionalRequirements: updateDto.additionalRequirements,
			});

			// Verify post was updated in database
			const updatedPost = await prismaService.roommateSeekingPost.findUnique({
				where: { id: post.id },
			});

			expect(updatedPost?.title).toBe(updateDto.title);
			expect(updatedPost?.description).toBe(updateDto.description);
			expect(updatedPost?.monthlyRent).toBe(updateDto.monthlyRent);
			expect(updatedPost?.depositAmount).toBe(updateDto.depositAmount);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const postId = 'post-1';
			const updateDto = { title: 'Updated Title' };

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/api/roommate-seeking-posts/${postId}`)
				.send(updateDto)
				.expect(401);
		});
	});

	describe('DELETE /roommate-seeking-posts/:id', () => {
		it('should delete post successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const post = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ để xóa',
				description: 'Bài đăng này sẽ bị xóa trong test',
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});

			// Act
			await request(app.getHttpServer())
				.delete(`/api/roommate-seeking-posts/${post.id}`)
				.set(headers)
				.expect(204);

			// Assert - Verify post was deleted from database
			const deletedPost = await prismaService.roommateSeekingPost.findUnique({
				where: { id: post.id },
			});

			expect(deletedPost).toBeNull();
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const postId = 'post-1';

			// Act & Assert
			await request(app.getHttpServer())
				.delete(`/api/roommate-seeking-posts/${postId}`)
				.expect(401);
		});
	});

	describe('PATCH /roommate-seeking-posts/:id/status', () => {
		it('should update status successfully', async () => {
			// Arrange
			const tenant = await authUtils.createDefaultTenant();
			const headers = authUtils.getAuthHeaders(tenant);
			const post = await authUtils.createTestRoommateSeekingPost(tenant.id, {
				title: 'Tìm người ở ghép phòng trọ để test status',
				description: 'Bài đăng này sẽ được test thay đổi status',
				monthlyRent: 2000000,
				depositAmount: 4000000,
				seekingCount: 1,
				maxOccupancy: 2,
				currentOccupancy: 1,
			});
			const status = 'paused';

			// Act
			const response = await request(app.getHttpServer())
				.patch(`/api/roommate-seeking-posts/${post.id}/status`)
				.set(headers)
				.send({ status })
				.expect(200);

			// Assert
			expect(response.body).toMatchObject({
				id: post.id,
				title: 'Tìm người ở ghép phòng trọ để test status',
				description: 'Bài đăng này sẽ được test thay đổi status',
				tenantId: tenant.id,
				status,
			});

			// Verify status was updated in database
			const updatedPost = await prismaService.roommateSeekingPost.findUnique({
				where: { id: post.id },
			});

			expect(updatedPost?.status).toBe(status);
		});

		it('should return 401 when not authenticated', async () => {
			// Arrange
			const postId = 'post-1';
			const status = 'paused';

			// Act & Assert
			await request(app.getHttpServer())
				.patch(`/api/roommate-seeking-posts/${postId}/status`)
				.send({ status })
				.expect(401);
		});
	});
});
