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
	constructor(private readonly prisma: PrismaService) {}

	async create(
		createDto: CreateRoommateApplicationDto,
		applicantId: string,
	): Promise<RoommateApplicationResponseDto> {
		// Check if post exists and is active
		const post = await this.prisma.roommateSeekingPost.findUnique({
			where: { id: createDto.roommateSeekingPostId },
			include: {
				tenant: true,
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

		const [applications, total] = await Promise.all([
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
		]);

		return PaginatedResponseDto.create(
			applications.map((app) => this.mapToResponseDto(app)),
			page,
			limit,
			total,
		);
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

		const [applications, total] = await Promise.all([
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
		]);

		return PaginatedResponseDto.create(
			applications.map((app) => this.mapToResponseDto(app)),
			page,
			limit,
			total,
		);
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

		// Handle approved application
		if (
			respondDto.status === RoommateApplicationStatus.approved_by_tenant ||
			respondDto.status === RoommateApplicationStatus.approved_by_landlord
		) {
			await this.handleApprovedApplication(application.roommateSeekingPostId);
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
