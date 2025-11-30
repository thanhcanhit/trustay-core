import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RequestStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { RoommatePostStatus } from '../../common/enums/roommate-post-status.enum';
import { convertDecimalToNumber, generateSlug, generateUniqueSlug } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalsService } from '../rentals/rentals.service';
import {
	AcceptInviteDto,
	AddRoommateDirectlyDto,
	ApplicationStatisticsDto,
	BulkRespondApplicationsDto,
	BulkResponseResultDto,
	CreateRoommateApplicationDto,
	GenerateInviteLinkResponseDto,
	QueryRoommateApplicationDto,
	RespondToApplicationDto,
	RoommateApplicationResponseDto,
	UpdateRoommateApplicationDto,
} from './dto';

@Injectable()
export class RoommateApplicationService {
	private readonly logger = new Logger(RoommateApplicationService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
		private readonly rentalsService: RentalsService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
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
					not: RequestStatus.cancelled,
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
			awaitingConfirmationCount,
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
				where: { ...where, status: RequestStatus.pending },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.accepted },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.rejected },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.awaiting_confirmation },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.cancelled },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.expired },
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
				approvedByLandlord: awaitingConfirmationCount,
				rejectedByLandlord: 0,
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
			awaitingConfirmationCount,
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
				where: { ...where, status: RequestStatus.pending },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.accepted },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.rejected },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.awaiting_confirmation },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.cancelled },
			}),
			this.prisma.roommateApplication.count({
				where: { ...where, status: RequestStatus.expired },
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
				approvedByLandlord: awaitingConfirmationCount,
				rejectedByLandlord: 0,
				cancelled: cancelledCount,
				expired: expiredCount,
				total,
			},
		} as unknown as PaginatedResponseDto<RoommateApplicationResponseDto>;
	}

	async findOne(id: string, userId?: string): Promise<RoommateApplicationResponseDto> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id },
			include: {
				...this.getIncludeOptions(),
				roommateSeekingPost: {
					select: {
						...this.getIncludeOptions().roommateSeekingPost.select,
						roomInstanceId: true,
						roomInstance: {
							select: {
								room: {
									select: {
										building: {
											select: {
												ownerId: true,
											},
										},
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

		// Check if user has permission to view
		if (userId) {
			const isApplicant = application.applicantId === userId;
			const isTenant = application.roommateSeekingPost.tenantId === userId;
			const isLandlord =
				application.roommateSeekingPost.roomInstance?.room?.building?.ownerId === userId;

			if (!isApplicant && !isTenant && !isLandlord) {
				throw new ForbiddenException('Không có quyền xem đơn ứng tuyển này');
			}
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

		if (application.status !== RequestStatus.pending) {
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
									include: {
										building: true,
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

		// Only tenant can respond via this endpoint
		const isTenant = application.roommateSeekingPost.tenantId === userId;
		if (!isTenant) {
			throw new ForbiddenException('Chỉ tenant có quyền phản hồi đơn ứng tuyển này');
		}

		if (application.status !== RequestStatus.pending) {
			throw new BadRequestException('Chỉ có thể phản hồi đơn ứng tuyển đang chờ xử lý');
		}

		// Validate status transition
		if (
			respondDto.status !== RequestStatus.accepted &&
			respondDto.status !== RequestStatus.rejected
		) {
			throw new BadRequestException('Tenant chỉ có thể approve hoặc reject đơn ứng tuyển');
		}

		const post = application.roommateSeekingPost;
		const isPlatformRoom = !!post.roomInstanceId;

		// Prepare update data
		// For external room: if accepted, set status to awaiting_confirmation (applicant can confirm)
		// For platform room: if accepted, keep status as accepted (wait for landlord)
		const finalStatus =
			respondDto.status === RequestStatus.accepted && !isPlatformRoom
				? RequestStatus.awaiting_confirmation
				: respondDto.status;

		const updateData: any = {
			status: finalStatus,
			tenantResponse: respondDto.response,
			tenantRespondedAt: new Date(),
		};

		// Update application
		const updatedApplication = await this.prisma.roommateApplication.update({
			where: { id },
			data: updateData,
			include: this.getIncludeOptions(),
		});

		// Get room name for notifications
		const roomName = post.roomInstance?.room?.name || 'phòng';

		// Send notifications based on status
		if (respondDto.status === RequestStatus.accepted) {
			// Tenant approved
			if (isPlatformRoom) {
				// Platform room: notify landlord for approval, notify applicant
				const landlordId = post.roomInstance?.room?.building?.ownerId;
				if (landlordId) {
					await this.notificationsService.notifyRoommateApplicationReceived(landlordId, {
						applicantName: application.fullName,
						roomName,
						applicationId: application.id,
					});
				}
				await this.notificationsService.notifyRoommateApplicationApproved(application.applicantId, {
					roomName,
					applicationId: application.id,
				});
			} else {
				// External room: notify applicant they can confirm
				await this.notificationsService.notifyRoommateApplicationApproved(application.applicantId, {
					roomName,
					applicationId: application.id,
				});
			}
		} else if (respondDto.status === RequestStatus.rejected) {
			// Tenant rejected - notify applicant
			await this.notificationsService.notifyRoommateApplicationRejected(application.applicantId, {
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

		if (application.status !== RequestStatus.pending) {
			throw new BadRequestException('Chỉ có thể hủy đơn ứng tuyển đang chờ xử lý');
		}

		await this.prisma.roommateApplication.update({
			where: { id },
			data: { status: RequestStatus.cancelled },
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
							},
						},
					},
				},
			},
		});

		if (!application) {
			throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
		}

		// Only applicant can confirm
		if (application.applicantId !== userId) {
			throw new ForbiddenException('Chỉ applicant có quyền xác nhận đơn ứng tuyển này');
		}

		const post = application.roommateSeekingPost;
		const isPlatformRoom = !!post.roomInstanceId;

		// Validate status based on room type
		if (isPlatformRoom) {
			// Platform room: status must be awaiting_confirmation (after landlord approval)
			if (application.status !== RequestStatus.awaiting_confirmation) {
				throw new BadRequestException(
					'Chỉ có thể xác nhận đơn ứng tuyển đã được tenant và landlord phê duyệt',
				);
			}
		} else {
			// External room: status must be awaiting_confirmation (after tenant approval)
			if (application.status !== RequestStatus.awaiting_confirmation) {
				throw new BadRequestException('Chỉ có thể xác nhận đơn ứng tuyển đã được tenant phê duyệt');
			}
		}

		// Create rental for roommate (this will handle all validations, updates including confirmedAt)
		return this.createRentalForRoommate(application, post, false, false);
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

	async findApplicationsForLandlord(
		query: QueryRoommateApplicationDto,
		landlordId: string,
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

		// Build where clause - only platform rooms owned by landlord
		const where: any = {
			roommateSeekingPost: {
				roomInstance: {
					room: {
						building: {
							ownerId: landlordId,
						},
					},
				},
			},
		};

		// Default filter to show applications awaiting landlord approval
		if (!status) {
			where.status = RequestStatus.accepted;
		} else {
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
			awaitingConfirmationCount,
			rejectedCount,
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
				where: {
					...where,
					status: RequestStatus.pending,
				},
			}),
			this.prisma.roommateApplication.count({
				where: {
					...where,
					status: RequestStatus.accepted,
				},
			}),
			this.prisma.roommateApplication.count({
				where: {
					...where,
					status: RequestStatus.awaiting_confirmation,
				},
			}),
			this.prisma.roommateApplication.count({
				where: {
					...where,
					status: RequestStatus.rejected,
				},
			}),
			this.prisma.roommateApplication.count({
				where: {
					...where,
					status: RequestStatus.cancelled,
				},
			}),
			this.prisma.roommateApplication.count({
				where: {
					...where,
					status: RequestStatus.expired,
				},
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
				rejectedByTenant: 0,
				approvedByLandlord: awaitingConfirmationCount,
				rejectedByLandlord: rejectedCount,
				cancelled: cancelledCount,
				expired: expiredCount,
				total,
			},
		} as unknown as PaginatedResponseDto<RoommateApplicationResponseDto>;
	}

	async addRoommateDirectly(addDto: AddRoommateDirectlyDto, userId: string): Promise<void> {
		// Find active rental for current user (tenant)
		const activeRental = await this.prisma.rental.findFirst({
			where: {
				tenantId: userId,
				status: 'active',
			},
			include: {
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		if (!activeRental) {
			throw new NotFoundException('Bạn chưa có rental active');
		}

		if (!activeRental.roomInstanceId) {
			throw new BadRequestException('Chỉ có thể thêm người vào phòng trong platform');
		}

		// Find or create hidden post for this rental
		let post = await this.prisma.roommateSeekingPost.findFirst({
			where: {
				rentalId: activeRental.id,
				status: RoommatePostStatus.active,
			},
			include: {
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		// If no post exists, create a hidden post automatically
		if (!post) {
			const roomName = activeRental.roomInstance?.room?.name || 'Phòng';
			const title = `Tìm người ở ghép - ${roomName}`;
			const baseSlug = generateSlug(title);
			const slug = await generateUniqueSlug(baseSlug, async (slug: string) => {
				const existing = await this.prisma.roommateSeekingPost.findUnique({
					where: { slug },
				});
				return existing !== null;
			});

			const monthlyRent = activeRental.monthlyRent;
			const depositAmount = activeRental.depositPaid || 0;

			// Check current occupancy using rentals service
			const currentOccupancy = await this.rentalsService.getOccupancyCountByRoomInstance(
				activeRental.roomInstanceId,
			);

			const maxOccupancy = activeRental.roomInstance?.room?.maxOccupancy || 2;
			const seekingCount = maxOccupancy - currentOccupancy;

			// Create hidden post (isActive: false - not public)
			post = await this.prisma.roommateSeekingPost.create({
				data: {
					title,
					slug,
					description: 'Bài đăng tự động tạo cho việc thêm roommate trực tiếp',
					tenantId: userId,
					rentalId: activeRental.id,
					roomInstanceId: activeRental.roomInstanceId,
					monthlyRent,
					depositAmount,
					seekingCount,
					remainingSlots: seekingCount,
					maxOccupancy,
					currentOccupancy,
					availableFromDate: new Date(),
					status: RoommatePostStatus.active,
					isActive: false, // Hidden post, not public
				},
				include: {
					tenant: true,
					roomInstance: {
						include: {
							room: {
								include: {
									building: true,
								},
							},
						},
					},
				},
			});
		}

		// Validate post has available slots
		if (post.remainingSlots <= 0) {
			throw new BadRequestException('Phòng đã hết slot trống');
		}

		// Validate user permission - tenant hoặc landlord
		const isTenant = post.tenantId === userId;
		const isLandlord = post.roomInstanceId
			? post.roomInstance?.room?.building?.ownerId === userId
			: false;

		if (!isTenant && !isLandlord) {
			throw new ForbiddenException('Chỉ tenant hoặc landlord có quyền thêm người vào phòng');
		}

		// Find user by userId, email, or phone
		let userToAdd: any = null;
		if (addDto.userId) {
			userToAdd = await this.prisma.user.findUnique({
				where: { id: addDto.userId },
			});
		} else if (addDto.email) {
			userToAdd = await this.prisma.user.findUnique({
				where: { email: addDto.email },
			});
		} else if (addDto.phone) {
			userToAdd = await this.prisma.user.findFirst({
				where: { phone: addDto.phone },
			});
		} else {
			throw new BadRequestException('Phải cung cấp userId, email hoặc phone');
		}

		if (!userToAdd) {
			const identifier = addDto.userId || addDto.email || addDto.phone;
			throw new NotFoundException(
				`Không tìm thấy user với thông tin: ${identifier}. Vui lòng kiểm tra lại email hoặc số điện thoại.`,
			);
		}

		const userIdToAdd = userToAdd.id;

		if (userIdToAdd === post.tenantId) {
			throw new BadRequestException('Không thể thêm chính tenant vào phòng');
		}

		// Only support platform rooms for direct add
		if (!post.roomInstanceId) {
			throw new BadRequestException('Chỉ có thể thêm người trực tiếp vào phòng trong platform');
		}

		const roomInstance = post.roomInstance;
		if (!roomInstance) {
			throw new NotFoundException('Không tìm thấy room instance');
		}

		// Check if user already has active rental elsewhere
		const existingRental = await this.prisma.rental.findFirst({
			where: {
				tenantId: userIdToAdd,
				status: 'active',
			},
			include: {
				roomInstance: {
					include: {
						room: true,
					},
				},
			},
		});

		if (existingRental) {
			throw new BadRequestException(
				`User đã có rental active tại ${existingRental.roomInstance.room.name} - ${existingRental.roomInstance.roomNumber}`,
			);
		}

		// Validate move-in date (default to today if not provided)
		const moveInDate = addDto.moveInDate ? new Date(addDto.moveInDate) : new Date();
		if (moveInDate < new Date()) {
			throw new BadRequestException('Ngày chuyển vào không thể trong quá khứ');
		}

		// If tenant adds someone, create application that needs landlord approval
		// Only landlord can add directly without approval
		if (isTenant && !isLandlord) {
			// Check if user already has application for this rental
			const existingApplication = await this.prisma.roommateApplication.findFirst({
				where: {
					roommateSeekingPostId: post.id,
					applicantId: userIdToAdd,
					status: {
						not: RequestStatus.cancelled,
					},
				},
			});

			if (existingApplication) {
				throw new BadRequestException('User đã có đơn ứng tuyển cho phòng này rồi');
			}

			// Get user info for application
			const fullName = `${userToAdd.firstName} ${userToAdd.lastName}`.trim();
			const phoneNumber = userToAdd.phone || '';

			// Create application with tenant auto-approved, waiting for landlord
			const application = await this.prisma.roommateApplication.create({
				data: {
					roommateSeekingPostId: post.id,
					applicantId: userIdToAdd,
					fullName,
					phoneNumber,
					moveInDate,
					intendedStayMonths: addDto.intendedStayMonths,
					status: RequestStatus.accepted, // Tenant approved, wait for landlord
					tenantResponse: 'Tenant đã chấp nhận trực tiếp',
					tenantRespondedAt: new Date(),
				},
			});

			// Increment contact count
			await this.prisma.roommateSeekingPost.update({
				where: { id: post.id },
				data: { contactCount: { increment: 1 } },
			});

			// Notify landlord for approval
			const landlordId = roomInstance.room.building.ownerId;
			const roomName = roomInstance.room.name;
			if (landlordId) {
				await this.notificationsService.notifyRoommateApplicationReceived(landlordId, {
					applicantName: fullName,
					roomName,
					applicationId: application.id,
				});
			}

			// Notify applicant that tenant approved
			await this.notificationsService.notifyRoommateApplicationApproved(userIdToAdd, {
				roomName,
				applicationId: application.id,
			});

			return; // Exit early, don't create rental yet
		}

		// Only landlord can add directly and create rental immediately
		// Create rental and update post in transaction
		await this.prisma.$transaction(async (tx) => {
			// Check room occupancy using rentals service
			const activeRentalsCount = await this.rentalsService.getOccupancyCountByRoomInstance(
				post.roomInstanceId,
			);

			// Validate max occupancy
			if (activeRentalsCount >= roomInstance.room.maxOccupancy) {
				throw new BadRequestException(
					`Phòng đã đạt tối đa ${roomInstance.room.maxOccupancy} người`,
				);
			}

			// Calculate contract end date if intended stay months provided
			let contractEndDate = null;
			if (addDto.intendedStayMonths) {
				contractEndDate = new Date(
					moveInDate.getTime() + addDto.intendedStayMonths * 30 * 24 * 60 * 60 * 1000,
				);
			}

			// Create rental for roommate
			const newRental = await tx.rental.create({
				data: {
					roomInstanceId: post.roomInstanceId,
					tenantId: userIdToAdd,
					ownerId: roomInstance.room.building.ownerId,
					contractStartDate: moveInDate,
					contractEndDate,
					monthlyRent: post.monthlyRent,
					depositPaid: post.depositAmount || 0,
					status: 'active',
				},
			});

			// Update post counts (approvedCount++, remainingSlots--)
			await tx.roommateSeekingPost.update({
				where: { id: post.id },
				data: {
					approvedCount: { increment: 1 },
					remainingSlots: { decrement: 1 },
				},
			});

			// Update room instance status to occupied if at max capacity
			const updatedActiveCount = activeRentalsCount + 1;
			if (updatedActiveCount >= roomInstance.room.maxOccupancy) {
				await tx.roomInstance.update({
					where: { id: roomInstance.id },
					data: { status: 'occupied' },
				});
			}

			// Check if should close post
			const updatedPost = await tx.roommateSeekingPost.findUnique({
				where: { id: post.id },
			});

			if (updatedPost && updatedPost.remainingSlots <= 0) {
				await tx.roommateSeekingPost.update({
					where: { id: post.id },
					data: { status: RoommatePostStatus.closed },
				});
			}

			// Send notifications
			const roomName = roomInstance.room.name;

			try {
				// Notify user being added - they were directly added (equivalent to approved without application)
				// This makes it clear they were accepted/approved to join the room
				await this.notificationsService.notifyRoommateApplicationApproved(userIdToAdd, {
					roomName,
					applicationId: newRental.id, // Use rental ID as identifier
				});

				// Also notify rental created so they know rental details
				await this.notificationsService.notifyRentalCreated(userIdToAdd, {
					roomName,
					rentalId: newRental.id,
					startDate: moveInDate.toISOString(),
				});

				// Notify tenant - they added someone to their room
				await this.notificationsService.notifyRentalCreated(post.tenantId, {
					roomName,
					rentalId: newRental.id,
					startDate: moveInDate.toISOString(),
				});

				// Notify landlord - someone was added to their property
				await this.notificationsService.notifyRentalCreated(roomInstance.room.building.ownerId, {
					roomName,
					rentalId: newRental.id,
					startDate: moveInDate.toISOString(),
				});
			} catch (error) {
				// Log error but don't fail the rental creation
				this.logger.error(
					`Failed to send rental created notifications: ${error.message}`,
					error.stack,
				);
			}
		});
	}

	async acceptInvite(
		acceptDto: AcceptInviteDto,
		applicantId: string,
	): Promise<RoommateApplicationResponseDto> {
		// Verify and decode JWT token
		let inviteData: any;
		try {
			inviteData = this.jwtService.verify(acceptDto.token);
		} catch {
			throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
		}

		const { rentalId, roomInstanceId, tenantId } = inviteData;

		if (!rentalId || !tenantId) {
			throw new BadRequestException('Token không chứa đủ thông tin cần thiết');
		}

		// Validate tenant is not the same as applicant
		if (tenantId === applicantId) {
			throw new BadRequestException('Không thể ứng tuyển vào phòng của chính mình');
		}

		// Get user information for applicant (to get fullName, phoneNumber)
		const applicant = await this.prisma.user.findUnique({
			where: { id: applicantId },
			select: {
				firstName: true,
				lastName: true,
				phone: true,
			},
		});

		if (!applicant) {
			throw new NotFoundException('Không tìm thấy thông tin user');
		}

		const fullName = `${applicant.firstName} ${applicant.lastName}`.trim();
		const phoneNumber = applicant.phone || '';

		// Get rental information
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: {
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				tenant: true,
			},
		});

		if (!rental) {
			throw new NotFoundException('Không tìm thấy rental');
		}

		if (rental.status !== 'active') {
			throw new BadRequestException('Rental không còn active');
		}

		// Check if user already has application for this rental
		const existingApplication = await this.prisma.roommateApplication.findFirst({
			where: {
				roommateSeekingPost: {
					rentalId,
				},
				applicantId,
				status: {
					not: RequestStatus.cancelled,
				},
			},
		});

		if (existingApplication) {
			throw new BadRequestException('Bạn đã ứng tuyển cho phòng này rồi');
		}

		// Check if user already has active rental
		const existingRental = await this.prisma.rental.findFirst({
			where: {
				tenantId: applicantId,
				status: 'active',
			},
		});

		if (existingRental) {
			throw new BadRequestException('Bạn đã có rental active khác');
		}

		// Validate room instance from rental (tính trực tiếp từ room instance, không từ post)
		// Post chỉ là thực thể phụ để lưu trữ, không dùng để validate capacity
		const rentalRoomInstanceId = rental.roomInstanceId || roomInstanceId;
		if (!rentalRoomInstanceId) {
			throw new BadRequestException('Chỉ có thể accept invite cho platform rooms');
		}

		if (!rental.roomInstance || !rental.roomInstance.room) {
			throw new NotFoundException('Không tìm thấy thông tin phòng');
		}

		// Verify actual room capacity directly from room instance (not from post)
		const currentOccupancy =
			await this.rentalsService.getOccupancyCountByRoomInstance(rentalRoomInstanceId);
		const maxOccupancy = rental.roomInstance.room.maxOccupancy || 2;
		const availableSlots = maxOccupancy - currentOccupancy;

		if (availableSlots <= 0) {
			throw new BadRequestException('Phòng đã đủ người, không còn chỗ trống');
		}

		const isPlatformRoom = !!rentalRoomInstanceId;

		// Find or create hidden post for this rental (post chỉ để lưu trữ thông tin)
		let roommateSeekingPost = await this.prisma.roommateSeekingPost.findFirst({
			where: {
				rentalId,
				status: RoommatePostStatus.active,
			},
		});

		// If no post exists, create a hidden post automatically (for storage only)
		if (!roommateSeekingPost) {
			const roomName = rental.roomInstance?.room?.name || 'Phòng';
			const title = `Tìm người ở ghép - ${roomName}`;
			const baseSlug = generateSlug(title);
			const slug = await generateUniqueSlug(baseSlug, async (slug: string) => {
				const existing = await this.prisma.roommateSeekingPost.findUnique({
					where: { slug },
				});
				return existing !== null;
			});

			const monthlyRent = rental.monthlyRent;
			const depositAmount = rental.depositPaid || 0;

			roommateSeekingPost = await this.prisma.roommateSeekingPost.create({
				data: {
					title,
					slug,
					description: 'Bài đăng tự động tạo từ invite link',
					tenantId,
					rentalId,
					roomInstanceId: rentalRoomInstanceId,
					monthlyRent,
					depositAmount,
					seekingCount: availableSlots,
					remainingSlots: availableSlots,
					maxOccupancy,
					currentOccupancy,
					availableFromDate: new Date(),
					status: RoommatePostStatus.active,
					isActive: false, // Hidden post, not public
				},
			});
		} else {
			// Update existing post with current occupancy data (bypass remainingSlots check for invite links)
			await this.prisma.roommateSeekingPost.update({
				where: { id: roommateSeekingPost.id },
				data: {
					seekingCount: availableSlots,
					remainingSlots: availableSlots,
					currentOccupancy,
				},
			});
		}

		// Validate post status only (bypass remainingSlots check for invite links)
		if (roommateSeekingPost.status !== RoommatePostStatus.active) {
			throw new BadRequestException('Bài đăng không còn mở cho ứng tuyển');
		}

		const postId = roommateSeekingPost.id;

		// Since tenant created the invite link, auto-approve from tenant
		// But still need landlord approval for platform rooms
		const initialStatus = isPlatformRoom
			? RequestStatus.accepted // Platform room: tenant auto-approved, wait for landlord
			: RequestStatus.awaiting_confirmation; // External room: tenant auto-approved, applicant can confirm

		// Default moveInDate to today if not provided
		const moveInDate = acceptDto.moveInDate ? new Date(acceptDto.moveInDate) : new Date();

		// Create application with tenant auto-approved (since they created the invite)
		const application = await this.prisma.roommateApplication.create({
			data: {
				roommateSeekingPostId: postId,
				applicantId,
				fullName,
				phoneNumber,
				moveInDate,
				intendedStayMonths: acceptDto.intendedStayMonths,
				status: initialStatus,
				tenantResponse: 'Tự động chấp nhận từ invite link',
				tenantRespondedAt: new Date(),
			},
			include: this.getIncludeOptions(),
		});

		// Increment contact count
		await this.prisma.roommateSeekingPost.update({
			where: { id: postId },
			data: { contactCount: { increment: 1 } },
		});

		const roomName = rental.roomInstance?.room?.name || 'phòng';

		// Notifications based on room type
		if (isPlatformRoom) {
			// Platform room: notify landlord for approval (tenant already approved by creating invite)
			const landlordId = rental.roomInstance?.room?.building?.ownerId;
			if (landlordId) {
				await this.notificationsService.notifyRoommateApplicationReceived(landlordId, {
					applicantName: fullName,
					roomName,
					applicationId: application.id,
				});
			}
			// Notify applicant that tenant approved
			await this.notificationsService.notifyRoommateApplicationApproved(applicantId, {
				roomName,
				applicationId: application.id,
			});
		} else {
			// External room: tenant auto-approved, applicant can confirm
			await this.notificationsService.notifyRoommateApplicationApproved(applicantId, {
				roomName,
				applicationId: application.id,
			});
		}

		return this.mapToResponseDto(application);
	}

	async generateInviteLink(userId: string): Promise<GenerateInviteLinkResponseDto> {
		// Find active rental for current user
		const activeRental = await this.prisma.rental.findFirst({
			where: {
				tenantId: userId,
				status: 'active',
			},
			include: {
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		if (!activeRental) {
			throw new BadRequestException('Bạn chưa có phòng thuê active để tạo link mời');
		}

		if (!activeRental.roomInstanceId) {
			throw new BadRequestException('Chỉ có thể tạo link mời cho platform rooms');
		}

		// Find or create hidden post for this rental
		let roommateSeekingPost = await this.prisma.roommateSeekingPost.findFirst({
			where: {
				rentalId: activeRental.id,
				status: RoommatePostStatus.active,
			},
		});

		// Check current occupancy using rentals service
		const currentOccupancy = await this.rentalsService.getOccupancyCountByRoomInstance(
			activeRental.roomInstanceId,
		);

		const maxOccupancy = activeRental.roomInstance?.room?.maxOccupancy || 2;
		const seekingCount = maxOccupancy - currentOccupancy;

		// If no post exists, create a hidden post automatically
		if (!roommateSeekingPost) {
			const roomName = activeRental.roomInstance?.room?.name || 'Phòng';
			const title = `Tìm người ở ghép - ${roomName}`;
			const baseSlug = generateSlug(title);
			const slug = await generateUniqueSlug(baseSlug, async (slug: string) => {
				const existing = await this.prisma.roommateSeekingPost.findUnique({
					where: { slug },
				});
				return existing !== null;
			});

			const monthlyRent = activeRental.monthlyRent;
			const depositAmount = activeRental.depositPaid || 0;

			// Create hidden post (isActive: false - not public, only for direct invites)
			roommateSeekingPost = await this.prisma.roommateSeekingPost.create({
				data: {
					title,
					slug,
					description: 'Bài đăng tự động tạo từ invite link',
					tenantId: userId,
					rentalId: activeRental.id,
					roomInstanceId: activeRental.roomInstanceId,
					monthlyRent,
					depositAmount,
					seekingCount,
					remainingSlots: seekingCount,
					maxOccupancy,
					currentOccupancy,
					availableFromDate: new Date(),
					status: RoommatePostStatus.active,
					isActive: false, // Hidden post, not public
				},
			});
		} else {
			// Update existing post with current occupancy data (số người tìm bằng với số người tìm phòng hiện tại)
			await this.prisma.roommateSeekingPost.update({
				where: { id: roommateSeekingPost.id },
				data: {
					seekingCount,
					remainingSlots: seekingCount,
					currentOccupancy,
				},
			});
		}

		// Token chỉ cần rentalId, post sẽ được tự động tạo hoặc tìm từ rental
		const inviteData = {
			rentalId: activeRental.id,
			roomInstanceId: activeRental.roomInstanceId,
			tenantId: userId,
		};

		// Generate JWT token with invite data (expires in 30 days)
		const expiresIn = '30d';
		const token = this.jwtService.sign(inviteData, {
			expiresIn,
		});

		// Calculate expiration date
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 30);

		// Get frontend URL from config or use default
		const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
		const inviteLink = `${frontendUrl}/invite?token=${token}`;

		return {
			inviteLink,
			token,
			rentalId: activeRental.id,
			roommateSeekingPostId: roommateSeekingPost.id,
			expiresAt: expiresAt.toISOString(),
		};
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
				status: item.status as RequestStatus,
				count: item._count,
				percentage: total > 0 ? Math.round((item._count / total) * 100) : 0,
			})),
		};

		// Map status counts
		statusCounts.forEach((item) => {
			switch (item.status) {
				case RequestStatus.pending:
					stats.pending = item._count;
					break;
				case RequestStatus.accepted:
					stats.approvedByTenant = item._count;
					break;
				case RequestStatus.rejected:
					stats.rejectedByTenant = item._count;
					break;
				case RequestStatus.awaiting_confirmation:
					stats.approvedByLandlord = item._count;
					break;
				case RequestStatus.cancelled:
					stats.cancelled = item._count;
					break;
				case RequestStatus.expired:
					stats.expired = item._count;
					break;
			}
		});

		return stats;
	}

	private async validateLandlordAccess(applicationId: string, landlordId: string): Promise<any> {
		const application = await this.prisma.roommateApplication.findUnique({
			where: { id: applicationId },
			include: {
				roommateSeekingPost: {
					include: {
						roomInstance: {
							include: {
								room: {
									include: {
										building: true,
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

		if (!application.roommateSeekingPost.roomInstanceId) {
			throw new BadRequestException('Phòng ngoài hệ thống không cần phê duyệt từ chủ nhà');
		}

		const building = application.roommateSeekingPost.roomInstance?.room?.building;

		if (!building || building.ownerId !== landlordId) {
			throw new ForbiddenException('Không có quyền phê duyệt đơn ứng tuyển này');
		}

		return application;
	}

	async landlordApproveApplication(
		id: string,
		respondDto: RespondToApplicationDto,
		landlordId: string,
	): Promise<RoommateApplicationResponseDto> {
		const application = await this.validateLandlordAccess(id, landlordId);

		if (application.status !== RequestStatus.accepted) {
			throw new BadRequestException('Chỉ có thể phê duyệt đơn ứng tuyển đã được tenant phê duyệt');
		}

		// Update application
		const updatedApplication = await this.prisma.roommateApplication.update({
			where: { id },
			data: {
				status: RequestStatus.awaiting_confirmation,
				landlordResponse: respondDto.response,
				landlordRespondedAt: new Date(),
			},
			include: this.getIncludeOptions(),
		});

		// Get room name for notifications
		const post = application.roommateSeekingPost;
		const roomName = post.roomInstance?.room?.name || 'phòng';

		// Notify applicant and tenant
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

		return this.mapToResponseDto(updatedApplication);
	}

	async landlordRejectApplication(
		id: string,
		respondDto: RespondToApplicationDto,
		landlordId: string,
	): Promise<RoommateApplicationResponseDto> {
		const application = await this.validateLandlordAccess(id, landlordId);

		if (application.status !== RequestStatus.accepted) {
			throw new BadRequestException('Chỉ có thể từ chối đơn ứng tuyển đã được tenant phê duyệt');
		}

		// Update application
		const updatedApplication = await this.prisma.roommateApplication.update({
			where: { id },
			data: {
				status: RequestStatus.rejected,
				landlordResponse: respondDto.response || 'Đơn ứng tuyển bị từ chối bởi chủ nhà',
				landlordRespondedAt: new Date(),
			},
			include: this.getIncludeOptions(),
		});

		// Get room name for notifications
		const post = application.roommateSeekingPost;
		const roomName = post.roomInstance?.room?.name || 'phòng';

		// Notify applicant about rejection
		await this.notificationsService.notifyRoommateApplicationRejected(application.applicantId, {
			roomName,
			reason: respondDto.response,
			applicationId: application.id,
		});

		return this.mapToResponseDto(updatedApplication);
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

		if (post && post.remainingSlots <= 0) {
			await this.prisma.roommateSeekingPost.update({
				where: { id: roommateSeekingPostId },
				data: { status: RoommatePostStatus.closed },
			});
		}
	}

	private async createRentalForRoommate(
		application: any,
		post: any,
		_isTenantConfirm: boolean,
		_isLandlordConfirm: boolean,
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

		// Kiểm tra applicant chưa có active rental nào khác (1 người chỉ ở 1 rental tại 1 thời điểm)
		const existingTenantRental = await this.prisma.rental.findFirst({
			where: {
				tenantId: application.applicantId,
				status: 'active',
			},
			include: {
				roomInstance: {
					include: {
						room: true,
					},
				},
			},
		});

		if (existingTenantRental) {
			throw new BadRequestException(
				`Applicant đã có rental active tại ${existingTenantRental.roomInstance.room.name} - ${existingTenantRental.roomInstance.roomNumber}`,
			);
		}

		// Tạo rental và update application trong transaction
		const rental = await this.prisma.$transaction(async (tx) => {
			// Check room occupancy using rentals service
			const activeRentalsCount = await this.rentalsService.getOccupancyCountByRoomInstance(
				post.roomInstanceId,
			);

			// Validate max occupancy
			if (activeRentalsCount >= roomInstance.room.maxOccupancy) {
				throw new BadRequestException(
					`Phòng đã đạt tối đa ${roomInstance.room.maxOccupancy} người`,
				);
			}

			// Update application status
			await tx.roommateApplication.update({
				where: { id: application.id },
				data: {
					status: RequestStatus.accepted, // Final status when rental is created
					confirmedAt: new Date(),
				},
			});

			// Update post counts (approvedCount++, remainingSlots--)
			await tx.roommateSeekingPost.update({
				where: { id: post.id },
				data: {
					approvedCount: { increment: 1 },
					remainingSlots: { decrement: 1 },
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

			// Update room instance status to occupied if at max capacity
			const updatedActiveCount = activeRentalsCount + 1;
			if (updatedActiveCount >= roomInstance.room.maxOccupancy) {
				await tx.roomInstance.update({
					where: { id: roomInstance.id },
					data: { status: 'occupied' },
				});
			}

			return newRental;
		});

		// Gửi notifications
		const roomName = roomInstance.room.name;

		try {
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
			if (post.roomInstanceId) {
				await this.notificationsService.notifyRentalCreated(roomInstance.room.building.ownerId, {
					roomName,
					rentalId: rental.id,
					startDate: application.moveInDate.toISOString(),
				});
			}
		} catch (error) {
			// Log error but don't fail the rental creation
			this.logger.error(
				`Failed to send rental created notifications: ${error.message}`,
				error.stack,
			);
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
						monthlyRent: convertDecimalToNumber(application.roommateSeekingPost.monthlyRent),
					}
				: undefined,
		};
	}
}
