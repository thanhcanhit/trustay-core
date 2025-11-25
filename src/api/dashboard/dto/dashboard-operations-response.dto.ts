import { ApiProperty } from '@nestjs/swagger';

class OperationItemDto {
	@ApiProperty({ example: 'booking-id' })
	readonly id: string;

	@ApiProperty({ example: 'roomBooking' })
	readonly type: string;

	@ApiProperty({ example: 'Phòng Deluxe - Tòa nhà Minh Phát' })
	readonly title: string;

	@ApiProperty({ example: 'pending' })
	readonly status: string;

	@ApiProperty({ example: 'Nguyễn Văn A' })
	readonly requesterName: string;

	@ApiProperty({ example: '2025-11-05T00:00:00.000Z', nullable: true })
	readonly targetDate?: Date;
}

class OperationsSummaryDto {
	@ApiProperty({ example: 4 })
	readonly pendingBookings: number;

	@ApiProperty({ example: 3 })
	readonly pendingInvitations: number;

	@ApiProperty({ example: 2 })
	readonly roommateApplications: number;

	@ApiProperty({ example: 5 })
	readonly contractAlerts: number;

	@ApiProperty({ example: 2 })
	readonly roomIssues: number;
}

class OperationsQueueDto {
	@ApiProperty({ type: () => OperationItemDto, isArray: true })
	readonly bookings: OperationItemDto[];

	@ApiProperty({ type: () => OperationItemDto, isArray: true })
	readonly invitations: OperationItemDto[];

	@ApiProperty({ type: () => OperationItemDto, isArray: true })
	readonly roommateApplications: OperationItemDto[];

	@ApiProperty({ type: () => OperationItemDto, isArray: true })
	readonly contracts: OperationItemDto[];

	@ApiProperty({ type: () => OperationItemDto, isArray: true })
	readonly roomIssues: OperationItemDto[];
}

/**
 * Thông tin các hàng đợi vận hành trên dashboard.
 */
export class DashboardOperationsResponseDto {
	@ApiProperty({ type: () => OperationsSummaryDto })
	readonly summary: OperationsSummaryDto;

	@ApiProperty({ type: () => OperationsQueueDto })
	readonly queues: OperationsQueueDto;
}
