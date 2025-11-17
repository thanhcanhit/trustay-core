import { ApiProperty } from '@nestjs/swagger';

class BuildingSummaryDto {
	@ApiProperty({ example: 3 })
	readonly total: number;

	@ApiProperty({ example: 2 })
	readonly active: number;
}

class RoomOccupancySummaryDto {
	@ApiProperty({ example: 12 })
	readonly totalInstances: number;

	@ApiProperty({ example: 7 })
	readonly occupiedInstances: number;

	@ApiProperty({ example: 3 })
	readonly availableInstances: number;

	@ApiProperty({ example: 1 })
	readonly reservedInstances: number;

	@ApiProperty({ example: 1 })
	readonly maintenanceInstances: number;

	@ApiProperty({ example: 0.58, description: 'Tỷ lệ lấp đầy (0-1)' })
	readonly occupancyRate: number;
}

class PipelineSnapshotDto {
	@ApiProperty({ example: 4 })
	readonly pendingBookings: number;

	@ApiProperty({ example: 2 })
	readonly pendingInvitations: number;

	@ApiProperty({ example: 1 })
	readonly roommateApprovals: number;

	@ApiProperty({ example: 3 })
	readonly upcomingMoveIns: number;
}

class TenantSnapshotDto {
	@ApiProperty({ example: 15 })
	readonly activeTenants: number;

	@ApiProperty({ example: 12 })
	readonly verifiedTenants: number;

	@ApiProperty({ example: 4.5 })
	readonly averageRating: number;
}

class AlertSnapshotDto {
	@ApiProperty({ example: 3 })
	readonly expiringRentals: number;

	@ApiProperty({ example: 2 })
	readonly expiringContracts: number;

	@ApiProperty({ example: 5 })
	readonly openAlerts: number;
}

/**
 * Thông tin tổng quan cho dashboard landlord.
 */
export class DashboardOverviewResponseDto {
	@ApiProperty({ type: () => BuildingSummaryDto })
	readonly buildings: BuildingSummaryDto;

	@ApiProperty({ type: () => RoomOccupancySummaryDto })
	readonly rooms: RoomOccupancySummaryDto;

	@ApiProperty({ type: () => PipelineSnapshotDto })
	readonly pipeline: PipelineSnapshotDto;

	@ApiProperty({ type: () => TenantSnapshotDto })
	readonly tenants: TenantSnapshotDto;

	@ApiProperty({ type: () => AlertSnapshotDto })
	readonly alerts: AlertSnapshotDto;
}
