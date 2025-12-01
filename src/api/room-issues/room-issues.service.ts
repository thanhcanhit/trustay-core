import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RentalStatus, RoomIssueStatus, UserRole } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
	CreateRoomIssueDto,
	LandlordRoomIssueQueryDto,
	RoomIssueQueryDto,
	RoomIssueResponseDto,
	UpdateRoomIssueStatusDto,
} from './dto';

const DEFAULT_OPEN_STATUSES: readonly RoomIssueStatus[] = [
	RoomIssueStatus.new,
	RoomIssueStatus.in_progress,
] as const;

const roomIssueRelations = Prisma.validator<Prisma.RoomIssueInclude>()({
	reporter: {
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
		},
	},
	roomInstance: {
		select: {
			id: true,
			roomNumber: true,
			room: {
				select: {
					id: true,
					name: true,
					slug: true,
					building: {
						select: {
							id: true,
							name: true,
							ownerId: true,
						},
					},
				},
			},
		},
	},
}) satisfies Prisma.RoomIssueInclude;

type RoomIssueWithRelations = Prisma.RoomIssueGetPayload<{
	include: typeof roomIssueRelations;
}>;

@Injectable()
export class RoomIssuesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
	) {}

	async createIssue(userId: string, dto: CreateRoomIssueDto): Promise<RoomIssueResponseDto> {
		const activeRental = await this.prisma.rental.findFirst({
			where: {
				roomInstanceId: dto.roomInstanceId,
				tenantId: userId,
				status: RentalStatus.active,
			},
			select: { id: true },
		});
		if (!activeRental) {
			throw new ForbiddenException('You can only report issues for your active room');
		}
		const issue = await this.prisma.roomIssue.create({
			data: {
				roomInstanceId: dto.roomInstanceId,
				reporterId: userId,
				title: dto.title,
				category: dto.category,
				status: RoomIssueStatus.new,
				imageUrls: dto.imageUrls ?? [],
			},
			include: roomIssueRelations,
		});
		await this.notifyLandlordIssueReported(issue);
		return this.mapIssue(issue);
	}

	async getMyIssues(
		userId: string,
		query: RoomIssueQueryDto,
	): Promise<PaginatedResponseDto<RoomIssueResponseDto>> {
		const { page = 1, limit = 20, roomInstanceId, category } = query;
		const skip = (page - 1) * limit;
		const where: Prisma.RoomIssueWhereInput = {
			reporterId: userId,
			...(roomInstanceId && { roomInstanceId }),
			...(category && { category }),
			status: this.buildStatusFilter(query.status),
		};
		const [issues, total] = await Promise.all([
			this.prisma.roomIssue.findMany({
				where,
				include: roomIssueRelations,
				orderBy: { createdAt: 'asc' },
				skip,
				take: limit,
			}),
			this.prisma.roomIssue.count({ where }),
		]);
		const data = issues.map((issue) => this.mapIssue(issue));
		return PaginatedResponseDto.create(data, page, limit, total);
	}

	async getLandlordIssues(
		userId: string,
		query: LandlordRoomIssueQueryDto,
	): Promise<PaginatedResponseDto<RoomIssueResponseDto>> {
		const landlord = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		if (!landlord) {
			throw new NotFoundException('User not found');
		}
		if (landlord.role !== UserRole.landlord) {
			throw new ForbiddenException('Only landlords can view property issues');
		}
		const { page = 1, limit = 20, roomInstanceId, category, reporterId } = query;
		const skip = (page - 1) * limit;
		const where: Prisma.RoomIssueWhereInput = {
			...(roomInstanceId && { roomInstanceId }),
			...(category && { category }),
			...(reporterId && { reporterId }),
			status: this.buildStatusFilter(query.status),
			roomInstance: {
				room: {
					building: {
						ownerId: userId,
					},
				},
			},
		};
		const [issues, total] = await Promise.all([
			this.prisma.roomIssue.findMany({
				where,
				include: roomIssueRelations,
				orderBy: { createdAt: 'asc' },
				skip,
				take: limit,
			}),
			this.prisma.roomIssue.count({ where }),
		]);
		const data = issues.map((issue) => this.mapIssue(issue));
		return PaginatedResponseDto.create(data, page, limit, total);
	}

	async getIssueDetail(issueId: string, userId: string): Promise<RoomIssueResponseDto> {
		const issue = await this.prisma.roomIssue.findUnique({
			where: { id: issueId },
			include: roomIssueRelations,
		});
		if (!issue) {
			throw new NotFoundException('Room issue not found');
		}
		const isReporter = issue.reporterId === userId;
		const ownerId = issue.roomInstance.room.building.ownerId;
		const isOwner = ownerId === userId;
		if (!isReporter && !isOwner) {
			throw new ForbiddenException('You are not allowed to view this issue');
		}
		return this.mapIssue(issue);
	}

	async updateIssueStatusAsLandlord(
		userId: string,
		issueId: string,
		dto: UpdateRoomIssueStatusDto,
	): Promise<RoomIssueResponseDto> {
		const issue = await this.prisma.roomIssue.findUnique({
			where: { id: issueId },
			include: roomIssueRelations,
		});
		if (!issue) {
			throw new NotFoundException('Room issue not found');
		}
		const ownerId = issue.roomInstance.room.building.ownerId;
		if (ownerId !== userId) {
			throw new ForbiddenException('Only property owner can update this issue');
		}
		const updatedIssue = await this.prisma.roomIssue.update({
			where: { id: issueId },
			data: {
				status: dto.status,
				...(dto.note && { landlordNote: dto.note }),
			},
			include: roomIssueRelations,
		});
		await this.notifyTenantIssueStatusUpdated(updatedIssue, dto);
		return this.mapIssue(updatedIssue);
	}

	private mapIssue(issue: RoomIssueWithRelations): RoomIssueResponseDto {
		const issueWithNote = issue as RoomIssueWithRelations & { landlordNote?: string | null };
		return {
			id: issue.id,
			title: issue.title,
			category: issue.category,
			status: issue.status,
			landlordNote: issueWithNote.landlordNote ?? null,
			imageUrls: issue.imageUrls,
			createdAt: issue.createdAt,
			updatedAt: issue.updatedAt,
			reporter: {
				id: issue.reporter.id,
				firstName: issue.reporter.firstName,
				lastName: issue.reporter.lastName,
				email: issue.reporter.email,
				phone: issue.reporter.phone,
			},
			roomInstance: {
				id: issue.roomInstance.id,
				roomNumber: issue.roomInstance.roomNumber,
				room: {
					id: issue.roomInstance.room.id,
					name: issue.roomInstance.room.name,
					slug: issue.roomInstance.room.slug,
					buildingId: issue.roomInstance.room.building.id,
					buildingName: issue.roomInstance.room.building.name,
					ownerId: issue.roomInstance.room.building.ownerId,
				},
			},
		};
	}

	private buildStatusFilter(status?: RoomIssueStatus): Prisma.EnumRoomIssueStatusFilter {
		if (status) {
			return { equals: status };
		}
		return { in: [...DEFAULT_OPEN_STATUSES] };
	}

	private async notifyLandlordIssueReported(issue: RoomIssueWithRelations): Promise<void> {
		const ownerId = issue.roomInstance.room.building.ownerId;
		if (!ownerId) {
			return;
		}
		const tenantName =
			[issue.reporter.firstName, issue.reporter.lastName].filter(Boolean).join(' ').trim() ||
			issue.reporter.email;
		await this.notificationsService.notifyRoomIssueReported(ownerId, {
			roomName: issue.roomInstance.room.name,
			roomNumber: issue.roomInstance.roomNumber,
			tenantName,
			issueId: issue.id,
			category: issue.category,
			title: issue.title,
		});
	}

	private async notifyTenantIssueStatusUpdated(
		issue: RoomIssueWithRelations,
		dto: UpdateRoomIssueStatusDto,
	): Promise<void> {
		const tenantId = issue.reporter.id;
		const roomName = issue.roomInstance.room.name;
		const roomNumber = issue.roomInstance.roomNumber;
		const status = issue.status;
		const note = dto.note ?? '';
		await this.notificationsService.notifyRoomIssueStatusUpdated(tenantId, {
			roomName,
			roomNumber,
			status,
			issueId: issue.id,
			note,
		});
	}
}
