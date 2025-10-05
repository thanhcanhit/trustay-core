import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { RoommateApplicationStatus } from '../../common/enums/roommate-application-status.enum';
import { RoommatePostStatus } from '../../common/enums/roommate-post-status.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalsService } from '../rentals/rentals.service';
import {
	ApplicationStatisticsDto,
	BulkRespondApplicationsDto,
	BulkResponseResultDto,
	CreateRoommateApplicationDto,
	QueryRoommateApplicationDto,
	RespondToApplicationDto,
	RoommateApplicationResponseDto,
	UpdateRoommateApplicationDto,
} from './dto';

@Injectable()
export class RoommateApplicationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
		private readonly rentalsService: RentalsService,
	) {}

	async create(
		createDto: CreateRoommateApplicationDto,
		applicantId: string,
	): Promise<RoommateApplicationResponseDto> {
		// Check if post exists and is active
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id: createDto.roommateSeekingPostId },
			include: {
				tenant: true,
				roomInstance: {
					include: {
						room: {
							select: {
								name: true,
							},
						},
					},
				},
			},
		});

		if (!post) {
			throw new NotFoundException('Không tìm thấy bài đăng');
		}

		if (post.status !== RoommatePostStatus.active) {
			throw new BadRequestException('Bài đăng không còn mở cho ứng tuyển');
		}

		if (post.remainingSlots <= 0) {
			throw new BadRequestException('Bài đăng đã hết slot trống');
		}

		if (post.tenantId === applicantId) {
			throw new BadRequestException('Không thể ứng tuyển vào bài đăng của chính mình');
		}

		// Check if user already applied
		const existingApplication = await this.prisma.roommateApplication.findFirst({
			where: {
				roommateSeekingPostId: createDto.roommateSeekingPostId,
				applicantId,
				status: {
					not: RoommateApplicationStatus.cancelled,
				},
			},
		});

		if (existingApplication) {
			throw new BadRequestException('Bạn đã ứng tuyển cho bài đăng này rồi');
		}

		// Create application
		const application = await this.prisma.roommateApplication.create({
			data: {
				...createDto,
				applicantId,
				moveInDate: new Date(createDto.moveInDate),
			},
			include: this.getIncludeOptions(),
		});

		// Increment contact count
		await this.prisma.roommateSeekingPost.update({
			where: { id: createDto.roommateSeekingPostId },
			data: { contactCount: { increment: 1 } },
		});

		// Notify tenant about new application
		const roomName = post.roomInstance?.room?.name || 'phòng';
		await this.notificationsService.notifyRoommateApplicationReceived(post.tenantId, {
			applicantName: createDto.fullName,
			roomName,
			applicationId: application.id,
		});

		return this.mapToResponseDto(application);
	}

	async findMyApplications(
		query: QueryRoommateApplicationDto,
		applicantId: string,
	): Promise<PaginatedResponseDto<RoommateApplicationResponseDto>> {
		const {
			page = 1,
			limit = 10,
			status,
			search,
			roommateSeekingPostId,
			isUrgent,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = { applicantId };
		if (status) {
			where.status = status;
		}
		if (roommateSeekingPostId) {
			where.roommateSeekingPostId = roommateSeekingPostId;
		}
		if (isUrgent !== undefined) {
			where.isUrgent = isUrgent;
		}
		if (search) {
			where.OR = [
				{ fullName: { contains: search, mode: 'insensitive' } },
				{ occupation: { contains: search, mode: 'insensitive' } },
				{ applicationMessage: { contains: search, mode: 'insensitive' } },
			];
		}

		const [
			applications,
			total,
			pendingCount,
			approvedByTenantCount,
			rejectedByTenantCount,
			approvedByLandlordCount,
			rejectedByLandlordCount,
			cancelledCount,
			expiredCount,
		] = await Promise.all([
			this.prisma.roommateApplication.findMany({
				where,
				include: this.getIncludeOptions(),
				orderBy: { [sortBy]: sortOrder },
				skip,
				take: limit,
			}),
			this.prisma.roommateApplication.count({
				where,
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.pending },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.approved_by_tenant },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.rejected_by_tenant },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.approved_by_landlord },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.rejected_by_landlord },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.cancelled },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.expired },
			}),
		]);

		return {
			data: applications.map((app) => this.mapToResponseDto(app)),
			meta: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
				hasNext: page < Math.ceil(total / limit),
				hasPrev: page > 1,
				itemCount: applications.length,
			},
			counts: {
				pending: pendingCount,
				approvedByTenant: approvedByTenantCount,
				rejectedByTenant: rejectedByTenantCount,
				approvedByLandlord: approvedByLandlordCount,
				rejectedByLandlord: rejectedByLandlordCount,
				cancelled: cancelledCount,
				expired: expiredCount,
				total,
			},
		} as unknown as PaginatedResponseDto<RoommateApplicationResponseDto>;
	}

	async findApplicationsForMyPosts(
		query: QueryRoommateApplicationDto,
		tenantId: string,
	): Promise<PaginatedResponseDto<RoommateApplicationResponseDto>> {
		const {
			page = 1,
			limit = 10,
			status,
			search,
			roommateSeekingPostId,
			isUrgent,
			sortBy = 'createdAt',
			sortOrder = 'desc',
		} = query;
		const skip = (page - 1) * limit;

		// Build where clause
		const where: any = {
			roommateSeekingPost: {
				tenantId,
			},
		};
		if (status) {
			where.status = status;
		}
		if (roommateSeekingPostId) {
			where.roommateSeekingPostId = roommateSeekingPostId;
		}
		if (isUrgent !== undefined) {
			where.isUrgent = isUrgent;
		}
		if (search) {
			where.OR = [
				{ fullName: { contains: search, mode: 'insensitive' } },
				{ occupation: { contains: search, mode: 'insensitive' } },
				{ applicationMessage: { contains: search, mode: 'insensitive' } },
			];
		}

		const [
			applications,
			total,
			pendingCount,
			approvedByTenantCount,
			rejectedByTenantCount,
			approvedByLandlordCount,
			rejectedByLandlordCount,
			cancelledCount,
			expiredCount,
		] = await Promise.all([
			this.prisma.roommateApplication.findMany({
				where,
				include: this.getIncludeOptions(),
				orderBy: { [sortBy]: sortOrder },
				skip,
				take: limit,
			}),
			this.prisma.roommateApplication.count({
				where,
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.pending },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.approved_by_tenant },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.rejected_by_tenant },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.approved_by_landlord },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.rejected_by_landlord },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.cancelled },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RoommateApplicationStatus.expired },
			}),
		]);

		return {
			data: applications.map((app) => this.mapToResponseDto(app)),
			meta: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
				hasNext: page < Math.ceil(total / limit),
				hasPrev: page > 1,
				itemCount: applications.length,
			},
			counts: {
				pending: pendingCount,
				approvedByTenant: approvedByTenantCount,
				rejectedByTenant: rejectedByTenantCount,
				approvedByLandlord: approvedByLandlordCount,
				rejectedByLandlord: rejectedByLandlordCount,
				cancelled: cancelledCount,
				expired: expiredCount,
				total,
			},
		} as unknown as PaginatedResponseDto<RoommateApplicationResponseDto>;
	}

	async findOne(id: string, userId?: string): Promise<RoommateApplicationResponseDto> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id },
			include: this.getIncludeOptions(),
		});

		if (!application) {
			throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
		}

		// Check if user has permission to view
		if (
			userId &&
			application.applicantId !== userId &&
			application.roommateSeekingPost.tenantId !== userId
		) {
			throw new ForbiddenException('Không có quyền xem đơn ứng tuyển này');
		}

		return this.mapToResponseDto(application);
	}

	async update(
		id: string,
		updateDto: UpdateRoommateApplicationDto,
		applicantId: string,
	): Promise<RoommateApplicationResponseDto> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id },
		});

		if (!application) {
			throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
		}

		if (application.applicantId !== applicantId) {
			throw new ForbiddenException('Không có quyền chỉnh sửa đơn ứng tuyển này');
		}

		if (application.status !== RoommateApplicationStatus.pending) {
			throw new BadRequestException('Chỉ có thể chỉnh sửa đơn ứng tuyển đang chờ xử lý');
		}

		const updatedApplication = await this.prisma.roommateApplication.update({
			where: { id },
			data: {
				...updateDto,
				moveInDate: updateDto.moveInDate ? new Date(updateDto.moveInDate) : undefined,
			},
			include: this.getIncludeOptions(),
		});

		return this.mapToResponseDto(updatedApplication);
	}

	async respondToApplication(
		id: string,
		respondDto: RespondToApplicationDto,
		userId: string,
	): Promise<RoommateApplicationResponseDto> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id },
			include: {
				roommateSeekingPost: {
					include: {
						roomInstance: {
							include: {
								room: {
									select: {
										name: true,
									},
								},
								rentals: {
									where: {
										status: 'active',
									},
									include: {
										owner: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!application) {
			throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
		}

		const isTenant = application.roommateSeekingPost.tenantId === userId;
		const isLandlord =
			application.roommateSeekingPost.roomInstance?.rentals?.[0]?.owner?.id === userId;

		if (!isTenant && !isLandlord) {
			throw new ForbiddenException('Không có quyền phản hồi đơn ứng tuyển này');
		}

		// Validate status transitions
		await this.validateStatusTransition(application, respondDto.status, isTenant, isLandlord);

		// Prepare update data
		const updateData: any = {
			status: respondDto.status,
		};

		if (isTenant) {
			updateData.tenantResponse = respondDto.response;
			updateData.tenantRespondedAt = new Date();
		} else if (isLandlord) {
			updateData.landlordResponse = respondDto.response;
			updateData.landlordRespondedAt = new Date();
		}

		// Update application
		const updatedApplication = await this.prisma.roommateApplication.update({
			where: { id },
			data: updateData,
			include: this.getIncludeOptions(),
		});

		// Get room name for notifications
		const post = application.roommateSeekingPost;
		const roomName = post.roomInstance?.room?.name || 'phòng';

		// Send notifications based on status
		if (respondDto.status === RoommateApplicationStatus.approved_by_tenant) {
			// Tenant approved - notify applicant
			await this.notificationsService.notifyRoommateApplicationApproved(application.applicantId, {
				roomName,
				applicationId: application.id,
			});

			// Handle approved application (update post counts)
			await this.handleApprovedApplication(application.roommateSeekingPostId);

			// If platform room, also notify landlord
			if (post.roomInstance) {
				const landlordId = post.roomInstance.rentals?.[0]?.owner?.id;
				if (landlordId) {
					await this.notificationsService.notifyRoommateApplicationReceived(landlordId, {
						applicantName: application.fullName,
						roomName,
						applicationId: application.id,
					});
				}
			}
		} else if (respondDto.status === RoommateApplicationStatus.rejected_by_tenant) {
			// Tenant rejected - notify applicant
			await this.notificationsService.notifyRoommateApplicationRejected(application.applicantId, {
				roomName,
				reason: respondDto.response,
				applicationId: application.id,
			});
		} else if (respondDto.status === RoommateApplicationStatus.approved_by_landlord) {
			// Landlord approved - notify applicant and tenant
			await this.notificationsService.notifyRoommateApplicationApproved(application.applicantId, {
				roomName,
				applicationId: application.id,
			});

			await this.notificationsService.notifyRoommateApplicationApproved(post.tenantId, {
				roomName,
				applicationId: application.id,
			});

			// Handle approved application (update post counts)
			await this.handleApprovedApplication(application.roommateSeekingPostId);
		} else if (respondDto.status === RoommateApplicationStatus.rejected_by_landlord) {
			// Landlord rejected - notify applicant and tenant
			await this.notificationsService.notifyRoommateApplicationRejected(application.applicantId, {
				roomName,
				reason: respondDto.response,
				applicationId: application.id,
			});

			await this.notificationsService.notifyRoommateApplicationRejected(post.tenantId, {
				roomName,
				reason: respondDto.response,
				applicationId: application.id,
			});
		}

		return this.mapToResponseDto(updatedApplication);
	}

	async cancel(id: string, applicantId: string): Promise<void> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id },
		});

		if (!application) {
			throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
		}

		if (application.applicantId !== applicantId) {
			throw new ForbiddenException('Không có quyền hủy đơn ứng tuyển này');
		}

		if (application.status !== RoommateApplicationStatus.pending) {
			throw new BadRequestException('Chỉ có thể hủy đơn ứng tuyển đang chờ xử lý');
		}

		await this.prisma.roommateApplication.update({
			where: { id },
			data: { status: RoommateApplicationStatus.cancelled },
		});
	}

	async confirmApplication(id: string, userId: string): Promise<RoommateApplicationResponseDto> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id },
			include: {
				applicant: true,
				roommateSeekingPost: {
					include: {
						tenant: true,
						roomInstance: {
							include: {
								room: {
									include: {
										building: {
											include: {
												owner: true,
											},
										},
									},
								},
								rentals: {
									where: {
										status: 'active',
									},
								},
							},
						},
					},
				},
			},
		});

		if (!application) {
			throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
		}

		const post = application.roommateSeekingPost;
		const isTenant = post.tenantId === userId;
		const isLandlord = post.roomInstance?.room?.building?.ownerId === userId;

		// Validate quyền confirm
		if (!isTenant && !isLandlord) {
			throw new ForbiddenException('Không có quyền xác nhận đơn ứng tuyển này');
		}

		// Tenant confirm
		if (isTenant) {
			if (application.isConfirmedByTenant) {
				throw new BadRequestException('Đơn ứng tuyển đã được tenant xác nhận');
			}

			if (application.status !== RoommateApplicationStatus.approved_by_tenant) {
				throw new BadRequestException('Chỉ có thể xác nhận đơn ứng tuyển đã được tenant phê duyệt');
			}

			// Nếu là platform room, cần landlord confirm nữa
			if (post.roomInstanceId) {
				await this.prisma.roommateApplication.update({
					where: { id },
					data: {
						isConfirmedByTenant: true,
					},
				});

				// Notify landlord
				if (isLandlord) {
					await this.notificationsService.notifyRoommateApplicationReceived(
						post.roomInstance!.room.building.ownerId,
						{
							applicantName: application.fullName,
							roomName: post.roomInstance!.room.name,
							applicationId: application.id,
						},
					);
				}

				return this.mapToResponseDto(
					await this.prisma.roommateApplication.findUnique({
						where: { id },
						include: this.getIncludeOptions(),
					}),
				);
			} else {
				// External room - chỉ cần tenant confirm -> tạo rental luôn
				return this.createRentalForRoommate(application, post, true, false);
			}
		}

		// Landlord confirm (for platform rooms only)
		if (isLandlord) {
			if (!application.isConfirmedByTenant) {
				throw new BadRequestException('Tenant chưa xác nhận đơn ứng tuyển');
			}

			if (application.isConfirmedByLandlord) {
				throw new BadRequestException('Đơn ứng tuyển đã được landlord xác nhận');
			}

			if (application.status !== RoommateApplicationStatus.approved_by_landlord) {
				throw new BadRequestException(
					'Chỉ có thể xác nhận đơn ứng tuyển đã được landlord phê duyệt',
				);
			}

			// Create rental for roommate
			return this.createRentalForRoommate(application, post, false, true);
		}

		throw new ForbiddenException('Không có quyền xác nhận đơn ứng tuyển này');
	}

	async bulkRespondToApplications(
		bulkDto: BulkRespondApplicationsDto,
		userId: string,
	): Promise<BulkResponseResultDto> {
		const { applicationIds, status, response } = bulkDto;

		const result: BulkResponseResultDto = {
			successCount: 0,
			failureCount: 0,
			errors: [],
			processedApplications: [],
		};

		for (const applicationId of applicationIds) {
			try {
				await this.respondToApplication(applicationId, { status, response }, userId);
				result.successCount++;
				result.processedApplications.push(applicationId);
			} catch (error) {
				result.failureCount++;
				result.errors.push({
					applicationId,
					error: error.message || 'Unknown error',
				});
			}
		}

		return result;
	}

	async getApplicationStatistics(
		userId: string,
		isForMyPosts: boolean = false,
	): Promise<ApplicationStatisticsDto> {
		const where: any = isForMyPosts
			? { roommateSeekingPost: { tenantId: userId } }
			: { applicantId: userId };

		// Get total counts by status
		const statusCounts = await this.prisma.roommateApplication.groupBy({
			by: ['status'],
			where,
			_count: true,
		});

		// Get urgent count
		const urgentCount = await this.prisma.roommateApplication.count({
			where: { ...where, isUrgent: true },
		});

		// Get daily stats for last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const dailyStats = await this.prisma.roommateApplication.groupBy({
			by: ['createdAt'],
			where: {
				...where,
				createdAt: {
					gte: sevenDaysAgo,
				},
			},
			_count: true,
		});

		// Process results
		const total = statusCounts.reduce((sum, item) => sum + item._count, 0);

		const stats: ApplicationStatisticsDto = {
			total,
			pending: 0,
			approvedByTenant: 0,
			rejectedByTenant: 0,
			approvedByLandlord: 0,
			rejectedByLandlord: 0,
			cancelled: 0,
			expired: 0,
			urgent: urgentCount,
			dailyStats: this.processDailyStats(dailyStats),
			statusBreakdown: statusCounts.map((item) => ({
				status: item.status as RoommateApplicationStatus,
				count: item._count,
				percentage: total > 0 ? Math.round((item._count / total) * 100) : 0,
			})),
		};

		// Map status counts
		statusCounts.forEach((item) => {
			switch (item.status) {
				case RoommateApplicationStatus.pending:
					stats.pending = item._count;
					break;
				case RoommateApplicationStatus.approved_by_tenant:
					stats.approvedByTenant = item._count;
					break;
				case RoommateApplicationStatus.rejected_by_tenant:
					stats.rejectedByTenant = item._count;
					break;
				case RoommateApplicationStatus.approved_by_landlord:
					stats.approvedByLandlord = item._count;
					break;
				case RoommateApplicationStatus.rejected_by_landlord:
					stats.rejectedByLandlord = item._count;
					break;
				case RoommateApplicationStatus.cancelled:
					stats.cancelled = item._count;
					break;
				case RoommateApplicationStatus.expired:
					stats.expired = item._count;
					break;
			}
		});

		return stats;
	}

	private processDailyStats(dailyStats: any[]): { date: string; count: number }[] {
		const statsMap = new Map<string, number>();

		// Initialize last 7 days with 0 count
		for (let i = 6; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];
			statsMap.set(dateStr, 0);
		}

		// Fill in actual counts
		dailyStats.forEach((item) => {
			const dateStr = new Date(item.createdAt).toISOString().split('T')[0];
			if (statsMap.has(dateStr)) {
				statsMap.set(dateStr, (statsMap.get(dateStr) || 0) + item._count);
			}
		});

		return Array.from(statsMap.entries()).map(([date, count]) => ({ date, count }));
	}

	private async validateStatusTransition(
		application: any,
		newStatus: RoommateApplicationStatus,
		isTenant: boolean,
		isLandlord: boolean,
	): Promise<void> {
		const currentStatus = application.status;

		// Only tenant can approve/reject first
		if (
			isTenant &&
			(newStatus === RoommateApplicationStatus.approved_by_tenant ||
				newStatus === RoommateApplicationStatus.rejected_by_tenant)
		) {
			if (currentStatus !== RoommateApplicationStatus.pending) {
				throw new BadRequestException('Đơn ứng tuyển không ở trạng thái chờ xử lý');
			}
			return;
		}

		// Landlord can only respond after tenant approval for platform rooms
		if (
			isLandlord &&
			(newStatus === RoommateApplicationStatus.approved_by_landlord ||
				newStatus === RoommateApplicationStatus.rejected_by_landlord)
		) {
			if (currentStatus !== RoommateApplicationStatus.approved_by_tenant) {
				throw new BadRequestException('Chỉ có thể phản hồi sau khi tenant đã phê duyệt');
			}
			return;
		}

		throw new BadRequestException('Trạng thái chuyển đổi không hợp lệ');
	}

	private async handleApprovedApplication(roommateSeekingPostId: string): Promise<void> {
		// Decrement remaining slots and increment approved count
		await this.prisma.roommateSeekingPost.update({
			where: { id: roommateSeekingPostId },
			data: {
				approvedCount: { increment: 1 },
				remainingSlots: { decrement: 1 },
			},
		});

		// Check if should close post
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id: roommateSeekingPostId },
		});

		if (post && post.remainingSlots <= 1) {
			await this.prisma.roommateSeekingPost.update({
				where: { id: roommateSeekingPostId },
				data: { status: RoommatePostStatus.closed },
			});
		}
	}

	private async createRentalForRoommate(
		application: any,
		post: any,
		isTenantConfirm: boolean,
		isLandlordConfirm: boolean,
	): Promise<RoommateApplicationResponseDto> {
		// Validate roomInstance nếu là platform room
		if (!post.roomInstanceId) {
			throw new BadRequestException('Không thể tạo rental cho phòng ngoài platform');
		}

		const roomInstance = await this.prisma.roomInstance.findUnique({
			where: { id: post.roomInstanceId },
			include: {
				room: {
					include: {
						building: true,
					},
				},
				rentals: {
					where: {
						tenantId: application.applicantId,
						status: 'active',
					},
				},
			},
		});

		if (!roomInstance) {
			throw new NotFoundException('Không tìm thấy room instance');
		}

		// Kiểm tra applicant chưa có rental active cho phòng này
		if (roomInstance.rentals.length > 0) {
			throw new BadRequestException('Applicant đã có rental active cho phòng này');
		}

		// Tạo rental và update application trong transaction
		const rental = await this.prisma.$transaction(async (tx) => {
			// Update application confirmed status
			await tx.roommateApplication.update({
				where: { id: application.id },
				data: {
					...(isTenantConfirm && { isConfirmedByTenant: true }),
					...(isLandlordConfirm && { isConfirmedByLandlord: true }),
					confirmedAt: new Date(),
				},
			});

			// Create rental for roommate
			const newRental = await tx.rental.create({
				data: {
					roomInstanceId: post.roomInstanceId,
					tenantId: application.applicantId,
					ownerId: roomInstance.room.building.ownerId,
					contractStartDate: application.moveInDate,
					contractEndDate: application.intendedStayMonths
						? new Date(
								application.moveInDate.getTime() +
									application.intendedStayMonths * 30 * 24 * 60 * 60 * 1000,
							)
						: null,
					monthlyRent: post.monthlyRent,
					depositPaid: post.depositAmount || 0,
					status: 'active',
				},
			});

			return newRental;
		});

		// Gửi notifications
		const roomName = roomInstance.room.name;

		// Notify applicant về confirm và rental created
		await this.notificationsService.notifyRoommateApplicationConfirmed(application.applicantId, {
			roomName,
			applicationId: application.id,
		});

		await this.notificationsService.notifyRentalCreated(application.applicantId, {
			roomName,
			rentalId: rental.id,
			startDate: application.moveInDate.toISOString(),
		});

		// Notify tenant
		await this.notificationsService.notifyRentalCreated(post.tenantId, {
			roomName,
			rentalId: rental.id,
			startDate: application.moveInDate.toISOString(),
		});

		// Notify landlord if platform room
		if (isLandlordConfirm) {
			await this.notificationsService.notifyRentalCreated(roomInstance.room.building.ownerId, {
				roomName,
				rentalId: rental.id,
				startDate: application.moveInDate.toISOString(),
			});
		}

		// Return updated application
		return this.mapToResponseDto(
			await this.prisma.roommateApplication.findUnique({
				where: { id: application.id },
				include: this.getIncludeOptions(),
			}),
		);
	}

	private getIncludeOptions() {
		return {
			applicant: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					avatarUrl: true,
					email: true,
				},
			},
			roommateSeekingPost: {
				select: {
					id: true,
					title: true,
					slug: true,
					tenantId: true,
					monthlyRent: true,
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
						},
					},
				},
			},
		};
	}

	private mapToResponseDto(application: any): RoommateApplicationResponseDto {
		return {
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
			tenantResponse: application.tenantResponse,
			tenantRespondedAt: application.tenantRespondedAt?.toISOString(),
			landlordResponse: application.landlordResponse,
			landlordRespondedAt: application.landlordRespondedAt?.toISOString(),
			isUrgent: application.isUrgent,
			createdAt: application.createdAt.toISOString(),
			updatedAt: application.updatedAt.toISOString(),
			applicant: application.applicant,
			roommateSeekingPost: application.roommateSeekingPost
				? {
						...application.roommateSeekingPost,
						monthlyRent: Number(application.roommateSeekingPost.monthlyRent),
					}
				: undefined,
		};
	}
}
