import { Injectable } from '@nestjs/common';
import {
	BillStatus,
	ContractStatus,
	PaymentStatus,
	Prisma,
	RentalStatus,
	RequestStatus,
	RoomIssueStatus,
	RoomStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChartResponseDto } from './dto/chart-response.dto';
import { DashboardFilterQueryDto } from './dto/dashboard-filter-query.dto';
import { DashboardFinanceResponseDto } from './dto/dashboard-finance-response.dto';
import { DashboardOperationsResponseDto } from './dto/dashboard-operations-response.dto';
import { DashboardOverviewResponseDto } from './dto/dashboard-overview-response.dto';

const ACTIVE_RENTAL_STATUSES: RentalStatus[] = [RentalStatus.active, RentalStatus.pending_renewal];
const PENDING_REQUEST_STATUSES: RequestStatus[] = [
	RequestStatus.pending,
	RequestStatus.awaiting_confirmation,
];
const OPERATION_QUEUE_LIMIT = 5;
const EXPIRING_WINDOW_DAYS = 30;
const DUE_SOON_WINDOW_DAYS = 7;
const MAX_BUILDINGS_IN_CHART = 5;
const OPEN_ROOM_ISSUE_STATUSES: RoomIssueStatus[] = [
	RoomIssueStatus.new,
	RoomIssueStatus.in_progress,
];

interface BuildingSummary {
	total: number;
	active: number;
}

interface RoomSummary {
	totalInstances: number;
	occupiedInstances: number;
	availableInstances: number;
	reservedInstances: number;
	maintenanceInstances: number;
	occupancyRate: number;
}

interface PipelineSummary {
	pendingBookings: number;
	pendingInvitations: number;
	roommateApprovals: number;
	upcomingMoveIns: number;
}

interface TenantSummary {
	activeTenants: number;
	verifiedTenants: number;
	averageRating: number;
}

interface AlertSummary {
	expiringRentals: number;
	expiringContracts: number;
	openAlerts: number;
}

interface QueueResult {
	total: number;
	items: OperationItem[];
}

interface OperationItem {
	id: string;
	type: string;
	title: string;
	status: string;
	requesterName: string;
	targetDate?: Date;
}

interface RevenueSnapshot {
	totalBilled: number;
	totalPaid: number;
	outstandingAmount: number;
}

interface BillAlertSummary {
	overdueCount: number;
	dueSoonCount: number;
	overdueBills: BillAlertItem[];
	dueSoonBills: BillAlertItem[];
}

interface BillAlertItem {
	id: string;
	title: string;
	amount: number;
	dueDate: Date;
	tenantName: string;
}

interface PaymentSummary {
	pendingPayments: number;
	latestPayments: PaymentHighlight[];
}

interface PaymentHighlight {
	id: string;
	amount: number;
	paidAt: Date;
	reference: string;
}

interface ReferencePeriod {
	start: Date;
	end: Date;
}

/**
 * Service tổng hợp dữ liệu dashboard landlord.
 */
@Injectable()
export class DashboardService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Trả về dữ liệu overview trên dashboard.
	 */
	async getOverview(
		landlordId: string,
		query: DashboardFilterQueryDto,
	): Promise<DashboardOverviewResponseDto> {
		const { buildingId } = query;
		const [buildings, rooms, pipeline, tenants, alerts] = await Promise.all([
			this.getBuildingSummary(landlordId, buildingId),
			this.getRoomSummary(landlordId, buildingId),
			this.getPipelineSummary(landlordId, buildingId),
			this.getTenantSummary(landlordId, buildingId),
			this.getAlertSummary(landlordId, buildingId),
		]);
		return {
			buildings,
			rooms,
			pipeline,
			tenants,
			alerts,
		};
	}

	/**
	 * Trả về hàng đợi vận hành.
	 */
	async getOperations(
		landlordId: string,
		query: DashboardFilterQueryDto,
	): Promise<DashboardOperationsResponseDto> {
		const { buildingId } = query;
		const [bookingQueue, invitationQueue, roommateQueue, contractQueue, roomIssueQueue] =
			await Promise.all([
				this.getBookingQueue(landlordId, buildingId),
				this.getInvitationQueue(landlordId, buildingId),
				this.getRoommateQueue(landlordId, buildingId),
				this.getContractQueue(landlordId, buildingId),
				this.getRoomIssueQueue(landlordId, buildingId),
			]);
		return {
			summary: {
				pendingBookings: bookingQueue.total,
				pendingInvitations: invitationQueue.total,
				roommateApplications: roommateQueue.total,
				contractAlerts: contractQueue.total,
				roomIssues: roomIssueQueue.total,
			},
			queues: {
				bookings: bookingQueue.items,
				invitations: invitationQueue.items,
				roommateApplications: roommateQueue.items,
				contracts: contractQueue.items,
				roomIssues: roomIssueQueue.items,
			},
		};
	}

	/**
	 * Trả về dữ liệu tài chính theo kỳ tham chiếu.
	 */
	async getFinance(
		landlordId: string,
		query: DashboardFilterQueryDto,
	): Promise<DashboardFinanceResponseDto> {
		const { buildingId } = query;
		const reference = this.resolveReferencePeriod(query.referenceMonth);
		const [revenue, bills, payments, charts] = await Promise.all([
			this.getRevenueSnapshot(landlordId, buildingId, reference),
			this.getBillAlerts(landlordId, buildingId),
			this.getPaymentSummary(landlordId, buildingId, reference),
			this.getFinanceCharts(landlordId, buildingId, reference, query.referenceMonth),
		]);
		return {
			referencePeriod: {
				startDate: reference.start,
				endDate: reference.end,
			},
			revenue,
			bills,
			payments,
			charts,
		};
	}

	private async getBuildingSummary(
		landlordId: string,
		buildingId?: string,
	): Promise<BuildingSummary> {
		const where = this.buildBuildingWhere(landlordId, buildingId);
		const [total, active] = await this.prisma.$transaction([
			this.prisma.building.count({ where }),
			this.prisma.building.count({ where: { ...where, isActive: true } }),
		]);
		return {
			total,
			active,
		};
	}

	private async getRoomSummary(landlordId: string, buildingId?: string): Promise<RoomSummary> {
		const where = this.buildRoomInstanceWhere(landlordId, buildingId);
		const [
			totalInstances,
			occupiedInstances,
			availableInstances,
			reservedInstances,
			maintenanceInstances,
		] = await this.prisma.$transaction([
			this.prisma.roomInstance.count({ where }),
			this.prisma.roomInstance.count({ where: { ...where, status: RoomStatus.occupied } }),
			this.prisma.roomInstance.count({ where: { ...where, status: RoomStatus.available } }),
			this.prisma.roomInstance.count({ where: { ...where, status: RoomStatus.reserved } }),
			this.prisma.roomInstance.count({ where: { ...where, status: RoomStatus.maintenance } }),
		]);
		const occupancyRate =
			totalInstances === 0 ? 0 : Number((occupiedInstances / totalInstances).toFixed(2));
		return {
			totalInstances,
			occupiedInstances,
			availableInstances,
			reservedInstances,
			maintenanceInstances,
			occupancyRate,
		};
	}

	private async getPipelineSummary(
		landlordId: string,
		buildingId?: string,
	): Promise<PipelineSummary> {
		const roomFilter = this.buildRoomRelationFilter(landlordId, buildingId);
		const roomInstanceFilter = this.buildRoomInstanceWhere(landlordId, buildingId);
		const [pendingBookings, pendingInvitations, roommateApprovals, upcomingMoveIns] =
			await Promise.all([
				this.prisma.roomBooking.count({
					where: {
						status: { in: PENDING_REQUEST_STATUSES },
						room: roomFilter,
					},
				}),
				this.prisma.roomInvitation.count({
					where: {
						status: { in: PENDING_REQUEST_STATUSES },
						room: { building: roomFilter.building },
					},
				}),
				this.prisma.roommateApplication.count({
					where: {
						status: { in: PENDING_REQUEST_STATUSES },
						roommateSeekingPost: {
							roomInstance: roomInstanceFilter,
						},
					},
				}),
				this.prisma.rental.count({
					where: {
						ownerId: landlordId,
						status: { in: ACTIVE_RENTAL_STATUSES },
						roomInstance: roomInstanceFilter,
						contractStartDate: {
							gte: new Date(),
							lte: this.addDays(new Date(), EXPIRING_WINDOW_DAYS),
						},
					},
				}),
			]);
		return {
			pendingBookings,
			pendingInvitations,
			roommateApprovals,
			upcomingMoveIns,
		};
	}

	private async getTenantSummary(landlordId: string, buildingId?: string): Promise<TenantSummary> {
		const rentalWhere = this.buildRentalWhere(landlordId, buildingId);
		const rentals = await this.prisma.rental.findMany({
			where: {
				...rentalWhere,
				status: { in: ACTIVE_RENTAL_STATUSES },
			},
			select: {
				tenantId: true,
				tenant: {
					select: {
						id: true,
						overallRating: true,
						isVerifiedIdentity: true,
					},
				},
			},
		});
		const tenantMap = new Map<string, { rating?: number; verified: boolean }>();
		for (const rental of rentals) {
			if (!tenantMap.has(rental.tenantId)) {
				tenantMap.set(rental.tenantId, {
					rating: rental.tenant?.overallRating ? Number(rental.tenant.overallRating) : undefined,
					verified: Boolean(rental.tenant?.isVerifiedIdentity),
				});
			}
		}
		const values = Array.from(tenantMap.values());
		const activeTenants = values.length;
		const verifiedTenants = values.filter((tenant) => tenant.verified).length;
		const ratings = values
			.map((tenant) => tenant.rating)
			.filter((rating): rating is number => typeof rating === 'number');
		const averageRating =
			ratings.length === 0
				? 0
				: Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2));
		return {
			activeTenants,
			verifiedTenants,
			averageRating,
		};
	}

	private async getAlertSummary(landlordId: string, buildingId?: string): Promise<AlertSummary> {
		const rentalWhere = this.buildRentalWhere(landlordId, buildingId);
		const now = new Date();
		const expiringDate = this.addDays(now, EXPIRING_WINDOW_DAYS);
		const [expiringRentals, expiringContracts, openAlerts] = await Promise.all([
			this.prisma.rental.count({
				where: {
					...rentalWhere,
					status: { in: ACTIVE_RENTAL_STATUSES },
					contractEndDate: {
						gte: now,
						lte: expiringDate,
					},
				},
			}),
			this.prisma.contract.count({
				where: {
					status: { in: [ContractStatus.pending_signature, ContractStatus.partially_signed] },
					landlordId,
					roomInstance: this.buildRoomInstanceWhere(landlordId, buildingId),
					endDate: {
						gte: now,
						lte: expiringDate,
					},
				},
			}),
			this.prisma.notification.count({
				where: {
					userId: landlordId,
					isRead: false,
				},
			}),
		]);
		return {
			expiringRentals,
			expiringContracts,
			openAlerts,
		};
	}

	private async getBookingQueue(landlordId: string, buildingId?: string): Promise<QueueResult> {
		const roomFilter = this.buildRoomRelationFilter(landlordId, buildingId);
		const where: Prisma.RoomBookingWhereInput = {
			status: { in: PENDING_REQUEST_STATUSES },
			room: roomFilter,
		};
		const [total, items] = await Promise.all([
			this.prisma.roomBooking.count({ where }),
			this.prisma.roomBooking.findMany({
				where,
				orderBy: { createdAt: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					room: {
						include: { building: true },
					},
					tenant: true,
				},
			}),
		]);
		const mappedItems = items.map<OperationItem>((booking) => ({
			id: booking.id,
			type: 'roomBooking',
			title: `${booking.room?.name ?? 'Room'} - ${booking.room?.building.name ?? 'Building'}`,
			status: booking.status,
			requesterName: this.buildFullName(booking.tenant?.firstName, booking.tenant?.lastName),
			targetDate: booking.moveInDate ?? undefined,
		}));
		return {
			total,
			items: mappedItems,
		};
	}

	private async getInvitationQueue(landlordId: string, buildingId?: string): Promise<QueueResult> {
		const roomFilter = this.buildRoomRelationFilter(landlordId, buildingId);
		const where: Prisma.RoomInvitationWhereInput = {
			status: { in: PENDING_REQUEST_STATUSES },
			room: { building: roomFilter.building },
			senderId: landlordId,
		};
		const [total, items] = await Promise.all([
			this.prisma.roomInvitation.count({ where }),
			this.prisma.roomInvitation.findMany({
				where,
				orderBy: { createdAt: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					room: {
						include: { building: true },
					},
					recipient: true,
				},
			}),
		]);
		const mappedItems = items.map<OperationItem>((invitation) => ({
			id: invitation.id,
			type: 'roomInvitation',
			title: `${invitation.room?.name ?? 'Room'} - ${invitation.room?.building.name ?? 'Building'}`,
			status: invitation.status,
			requesterName:
				this.buildFullName(invitation.recipient?.firstName, invitation.recipient?.lastName) ??
				invitation.recipientEmail ??
				'Unknown',
			targetDate: invitation.moveInDate ?? undefined,
		}));
		return {
			total,
			items: mappedItems,
		};
	}

	private async getRoommateQueue(landlordId: string, buildingId?: string): Promise<QueueResult> {
		const roomInstanceWhere = this.buildRoomInstanceWhere(landlordId, buildingId);
		const where: Prisma.RoommateApplicationWhereInput = {
			status: { in: PENDING_REQUEST_STATUSES },
			roommateSeekingPost: {
				roomInstance: roomInstanceWhere,
			},
		};
		const [total, items] = await Promise.all([
			this.prisma.roommateApplication.count({ where }),
			this.prisma.roommateApplication.findMany({
				where,
				orderBy: { createdAt: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					roommateSeekingPost: {
						include: {
							roomInstance: {
								include: {
									room: {
										include: { building: true },
									},
								},
							},
						},
					},
					applicant: true,
				},
			}),
		]);
		const mappedItems = items.map<OperationItem>((application) => ({
			id: application.id,
			type: 'roommateApplication',
			title: `${application.roommateSeekingPost?.roomInstance?.room?.name ?? 'Room'} - ${application.roommateSeekingPost?.roomInstance?.room?.building.name ?? 'Building'}`,
			status: application.status,
			requesterName: this.buildFullName(
				application.applicant?.firstName,
				application.applicant?.lastName,
			),
			targetDate: application.moveInDate,
		}));
		return {
			total,
			items: mappedItems,
		};
	}

	private async getContractQueue(landlordId: string, buildingId?: string): Promise<QueueResult> {
		const roomInstanceWhere = this.buildRoomInstanceWhere(landlordId, buildingId);
		const where: Prisma.ContractWhereInput = {
			landlordId,
			status: {
				in: [
					ContractStatus.draft,
					ContractStatus.pending_signature,
					ContractStatus.partially_signed,
				],
			},
			roomInstance: roomInstanceWhere,
		};
		const [total, items] = await Promise.all([
			this.prisma.contract.count({ where }),
			this.prisma.contract.findMany({
				where,
				orderBy: { createdAt: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					roomInstance: {
						include: {
							room: {
								include: { building: true },
							},
						},
					},
					tenant: true,
				},
			}),
		]);
		const mappedItems = items.map<OperationItem>((contract) => ({
			id: contract.id,
			type: 'contract',
			title: `${contract.roomInstance?.room?.name ?? 'Room'} - ${contract.roomInstance?.room?.building.name ?? 'Building'}`,
			status: contract.status,
			requesterName: this.buildFullName(contract.tenant?.firstName, contract.tenant?.lastName),
			targetDate: contract.endDate ?? undefined,
		}));
		return {
			total,
			items: mappedItems,
		};
	}

	private async getRoomIssueQueue(landlordId: string, buildingId?: string): Promise<QueueResult> {
		const where: Prisma.RoomIssueWhereInput = {
			status: { in: OPEN_ROOM_ISSUE_STATUSES },
			roomInstance: {
				room: {
					building: this.buildBuildingWhere(landlordId, buildingId),
				},
			},
		};
		const [total, items] = await Promise.all([
			this.prisma.roomIssue.count({ where }),
			this.prisma.roomIssue.findMany({
				where,
				orderBy: { createdAt: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					reporter: true,
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
			}),
		]);
		const mappedItems = items.map<OperationItem>((issue) => ({
			id: issue.id,
			type: 'roomIssue',
			title: `${issue.roomInstance?.room?.name ?? 'Room'} - ${issue.roomInstance?.room?.building.name ?? 'Building'}`,
			status: issue.status,
			requesterName: this.buildFullName(issue.reporter?.firstName, issue.reporter?.lastName),
		}));
		return {
			total,
			items: mappedItems,
		};
	}

	private async getRevenueSnapshot(
		landlordId: string,
		buildingId: string | undefined,
		reference: ReferencePeriod,
	): Promise<RevenueSnapshot> {
		const billWhere: Prisma.BillWhereInput = {
			periodStart: { gte: reference.start },
			periodEnd: { lte: reference.end },
			rental: this.buildRentalWhere(landlordId, buildingId),
		};
		const paymentWhere: Prisma.PaymentWhereInput = {
			paymentStatus: PaymentStatus.completed,
			paymentDate: { gte: reference.start, lte: reference.end },
			rental: this.buildRentalWhere(landlordId, buildingId),
		};
		const [billAggregate, paymentAggregate] = await Promise.all([
			this.prisma.bill.aggregate({
				where: billWhere,
				_sum: { totalAmount: true },
			}),
			this.prisma.payment.aggregate({
				where: paymentWhere,
				_sum: { amount: true },
			}),
		]);
		const totalBilled = this.toNumber(billAggregate._sum.totalAmount);
		const totalPaid = this.toNumber(paymentAggregate._sum.amount);
		return {
			totalBilled,
			totalPaid,
			outstandingAmount: Number((totalBilled - totalPaid).toFixed(2)),
		};
	}

	private async getBillAlerts(landlordId: string, buildingId?: string): Promise<BillAlertSummary> {
		const now = new Date();
		const dueSoonDate = this.addDays(now, DUE_SOON_WINDOW_DAYS);
		const commonWhere: Prisma.BillWhereInput = {
			rental: this.buildRentalWhere(landlordId, buildingId),
			status: { notIn: [BillStatus.cancelled, BillStatus.paid] },
		};
		const overdueWhere: Prisma.BillWhereInput = {
			...commonWhere,
			OR: [{ status: BillStatus.overdue }, { status: BillStatus.pending, dueDate: { lt: now } }],
		};
		const dueSoonWhere: Prisma.BillWhereInput = {
			...commonWhere,
			dueDate: { gte: now, lte: dueSoonDate },
		};
		const [overdueCount, dueSoonCount, overdueBills, dueSoonBills] = await Promise.all([
			this.prisma.bill.count({ where: overdueWhere }),
			this.prisma.bill.count({ where: dueSoonWhere }),
			this.prisma.bill.findMany({
				where: overdueWhere,
				orderBy: { dueDate: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					rental: {
						include: {
							tenant: true,
							roomInstance: {
								include: { room: { include: { building: true } } },
							},
						},
					},
				},
			}),
			this.prisma.bill.findMany({
				where: dueSoonWhere,
				orderBy: { dueDate: 'asc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					rental: {
						include: {
							tenant: true,
							roomInstance: {
								include: { room: { include: { building: true } } },
							},
						},
					},
				},
			}),
		]);
		return {
			overdueCount,
			dueSoonCount,
			overdueBills: overdueBills.map((bill) => this.mapBillAlertItem(bill)),
			dueSoonBills: dueSoonBills.map((bill) => this.mapBillAlertItem(bill)),
		};
	}

	private async getPaymentSummary(
		landlordId: string,
		buildingId: string | undefined,
		reference: ReferencePeriod,
	): Promise<PaymentSummary> {
		const pendingWhere: Prisma.PaymentWhereInput = {
			paymentStatus: { in: [PaymentStatus.pending] },
			rental: this.buildRentalWhere(landlordId, buildingId),
		};
		const latestWhere: Prisma.PaymentWhereInput = {
			paymentStatus: PaymentStatus.completed,
			paymentDate: { gte: reference.start, lte: reference.end },
			rental: this.buildRentalWhere(landlordId, buildingId),
		};
		const [pendingPayments, latestPayments] = await Promise.all([
			this.prisma.payment.count({ where: pendingWhere }),
			this.prisma.payment.findMany({
				where: latestWhere,
				orderBy: { paymentDate: 'desc' },
				take: OPERATION_QUEUE_LIMIT,
				include: {
					rental: {
						include: {
							roomInstance: {
								include: { room: { include: { building: true } } },
							},
						},
					},
				},
			}),
		]);
		return {
			pendingPayments,
			latestPayments: latestPayments.map((payment) => ({
				id: payment.id,
				amount: this.toNumber(payment.amount),
				paidAt: payment.paymentDate ?? new Date(),
				reference: `${payment.rental.roomInstance.room.name ?? 'Room'} - ${payment.rental.roomInstance.room.building.name ?? 'Building'}`,
			})),
		};
	}

	private async getFinanceCharts(
		landlordId: string,
		buildingId: string | undefined,
		reference: ReferencePeriod,
		referenceMonth?: string,
	): Promise<Record<string, ChartResponseDto>> {
		const [revenueTrend, buildingPerformance, roomTypeDistribution] = await Promise.all([
			this.getRevenueTrendChart(landlordId, buildingId, reference, referenceMonth),
			this.getBuildingPerformanceChart(landlordId, buildingId, reference, referenceMonth),
			this.getRoomTypeDistributionChart(landlordId, buildingId),
		]);
		return {
			revenueTrend,
			buildingPerformance,
			roomTypeDistribution,
		};
	}

	private async getRevenueTrendChart(
		landlordId: string,
		buildingId: string | undefined,
		reference: ReferencePeriod,
		referenceMonth?: string,
	): Promise<ChartResponseDto> {
		const billWhere: Prisma.BillWhereInput = {
			periodStart: { gte: reference.start },
			periodEnd: { lte: reference.end },
			rental: this.buildRentalWhere(landlordId, buildingId),
		};
		const bills = await this.prisma.bill.findMany({
			where: billWhere,
			select: {
				periodStart: true,
				totalAmount: true,
			},
		});
		const dayKeys = this.generateDateKeys(reference);
		const totals = dayKeys.reduce<Record<string, number>>((acc, key) => {
			acc[key] = 0;
			return acc;
		}, {});
		for (const bill of bills) {
			const key = this.toDateKey(bill.periodStart ?? reference.start);
			if (totals[key] === undefined) {
				totals[key] = 0;
			}
			totals[key] += this.toNumber(bill.totalAmount);
		}
		return {
			type: 'line',
			title: 'Doanh thu theo ngày',
			meta: {
				unit: 'VND',
				period: { start: reference.start.toISOString(), end: reference.end.toISOString() },
				filters: {
					...(buildingId ? { buildingId } : {}),
					...(referenceMonth ? { referenceMonth } : {}),
				},
			},
			dataset: [
				{
					label: 'Tổng doanh thu',
					points: dayKeys.map((key) => ({
						x: key,
						y: Number((totals[key] ?? 0).toFixed(2)),
					})),
				},
			],
		};
	}

	private async getBuildingPerformanceChart(
		landlordId: string,
		buildingId: string | undefined,
		reference: ReferencePeriod,
		referenceMonth?: string,
	): Promise<ChartResponseDto> {
		const buildingWhere = this.buildBuildingWhere(landlordId, buildingId);
		const buildings = await this.prisma.building.findMany({
			where: buildingWhere,
			select: {
				id: true,
				name: true,
				rooms: {
					select: {
						roomInstances: {
							select: {
								status: true,
							},
						},
					},
				},
			},
			take: MAX_BUILDINGS_IN_CHART,
		});
		if (buildings.length === 0) {
			return {
				type: 'bar',
				title: 'Hiệu suất tòa nhà',
				meta: { unit: 'VND' },
				dataset: [],
			};
		}
		const bills = await this.prisma.bill.findMany({
			where: {
				periodStart: { gte: reference.start },
				periodEnd: { lte: reference.end },
				rental: {
					ownerId: landlordId,
					roomInstance: {
						room: {
							building: this.buildBuildingWhere(landlordId, buildingId),
						},
					},
				},
			},
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: {
									select: {
										buildingId: true,
									},
								},
							},
						},
					},
				},
			},
		});
		const revenueMap = new Map<string, number>();
		for (const bill of bills) {
			const buildingKey = bill.rental.roomInstance.room.buildingId;
			if (!buildingKey) {
				continue;
			}
			revenueMap.set(
				buildingKey,
				(revenueMap.get(buildingKey) ?? 0) + this.toNumber(bill.totalAmount),
			);
		}
		const revenueDataset = {
			label: 'Doanh thu',
			points: [] as { x: string; y: number }[],
		};
		const occupancyDataset = {
			label: 'Tỷ lệ lấp đầy (%)',
			points: [] as { x: string; y: number }[],
		};
		for (const building of buildings) {
			const totalInstances = building.rooms.reduce(
				(sum, room) => sum + room.roomInstances.length,
				0,
			);
			const occupiedInstances = building.rooms.reduce(
				(sum, room) =>
					sum + room.roomInstances.filter((ri) => ri.status === RoomStatus.occupied).length,
				0,
			);
			const occupancyPercent =
				totalInstances === 0 ? 0 : Number(((occupiedInstances / totalInstances) * 100).toFixed(2));
			const revenueValue = Number((revenueMap.get(building.id) ?? 0).toFixed(2));
			const label = building.name;
			revenueDataset.points.push({ x: label, y: revenueValue });
			occupancyDataset.points.push({ x: label, y: occupancyPercent });
		}
		return {
			type: 'bar',
			title: 'Hiệu suất tòa nhà',
			meta: {
				unit: 'VND',
				period: { start: reference.start.toISOString(), end: reference.end.toISOString() },
				filters: {
					...(buildingId ? { buildingId } : {}),
					...(referenceMonth ? { referenceMonth } : {}),
				},
			},
			dataset: [revenueDataset, occupancyDataset],
		};
	}

	private async getRoomTypeDistributionChart(
		landlordId: string,
		buildingId: string | undefined,
	): Promise<ChartResponseDto> {
		const instances = await this.prisma.roomInstance.findMany({
			where: this.buildRoomInstanceWhere(landlordId, buildingId),
			select: {
				room: {
					select: {
						roomType: true,
					},
				},
			},
		});
		const typeCounts = instances.reduce<Record<string, number>>((acc, instance) => {
			const type = instance.room.roomType ?? 'unknown';
			acc[type] = (acc[type] ?? 0) + 1;
			return acc;
		}, {});
		const points = Object.entries(typeCounts).map(([type, count]) => ({
			x: type,
			y: count,
		}));
		return {
			type: 'pie',
			title: 'Phân bổ loại phòng',
			meta: {
				unit: 'rooms',
				filters: { ...(buildingId ? { buildingId } : {}) },
			},
			dataset: [
				{
					label: 'Số lượng phòng',
					points,
				},
			],
		};
	}

	private buildBuildingWhere(landlordId: string, buildingId?: string): Prisma.BuildingWhereInput {
		return {
			ownerId: landlordId,
			...(buildingId ? { id: buildingId } : {}),
		};
	}

	private buildRoomRelationFilter(landlordId: string, buildingId?: string): Prisma.RoomWhereInput {
		return {
			building: this.buildBuildingWhere(landlordId, buildingId),
		};
	}

	private buildRoomInstanceWhere(
		landlordId: string,
		buildingId?: string,
	): Prisma.RoomInstanceWhereInput {
		return {
			room: {
				building: this.buildBuildingWhere(landlordId, buildingId),
			},
		};
	}

	private buildRentalWhere(landlordId: string, buildingId?: string): Prisma.RentalWhereInput {
		return {
			ownerId: landlordId,
			...(buildingId
				? {
						roomInstance: {
							room: {
								buildingId: buildingId,
							},
						},
					}
				: {}),
		};
	}

	private resolveReferencePeriod(referenceMonth?: string): ReferencePeriod {
		if (!referenceMonth) {
			const now = new Date();
			return {
				start: new Date(now.getFullYear(), now.getMonth(), 1),
				end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
			};
		}
		const [yearStr, monthStr] = referenceMonth.split('-');
		const year = Number(yearStr);
		const month = Number(monthStr) - 1;
		return {
			start: new Date(year, month, 1),
			end: new Date(year, month + 1, 0, 23, 59, 59, 999),
		};
	}

	private addDays(date: Date, days: number): Date {
		const clone = new Date(date);
		clone.setDate(clone.getDate() + days);
		return clone;
	}

	private generateDateKeys(reference: ReferencePeriod): string[] {
		const keys: string[] = [];
		let cursor = new Date(reference.start);
		while (cursor <= reference.end) {
			keys.push(this.toDateKey(cursor));
			cursor = this.addDays(cursor, 1);
		}
		return keys;
	}

	private toDateKey(date: Date): string {
		return date.toISOString().slice(0, 10);
	}

	private toNumber(value?: Prisma.Decimal | null | number): number {
		return value ? Number(value) : 0;
	}

	private buildFullName(firstName?: string | null, lastName?: string | null): string {
		const parts = [firstName, lastName].filter((part): part is string => Boolean(part));
		return parts.length > 0 ? parts.join(' ') : 'Unknown';
	}

	private mapBillAlertItem(bill: {
		id: string;
		totalAmount: Prisma.Decimal;
		dueDate: Date;
		rental: {
			tenant: { firstName: string | null; lastName: string | null };
			roomInstance: { room: { name: string | null; building: { name: string } } };
		};
	}): BillAlertItem {
		const tenantName = this.buildFullName(
			bill.rental.tenant.firstName,
			bill.rental.tenant.lastName,
		);
		const roomName = bill.rental.roomInstance.room.name ?? 'Room';
		const buildingName = bill.rental.roomInstance.room.building.name ?? 'Building';
		return {
			id: bill.id,
			title: `${roomName} - ${buildingName}`,
			amount: this.toNumber(bill.totalAmount),
			dueDate: bill.dueDate,
			tenantName,
		};
	}
}
