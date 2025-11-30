import { ApiProperty } from '@nestjs/swagger';
import { ChartResponseDto } from './chart-response.dto';

class ReferencePeriodDto {
	@ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
	readonly startDate: Date;

	@ApiProperty({ example: '2025-11-30T23:59:59.999Z' })
	readonly endDate: Date;
}

class RevenueSnapshotDto {
	@ApiProperty({ example: 12000000 })
	readonly totalBilled: number;

	@ApiProperty({ example: 9000000 })
	readonly totalPaid: number;

	@ApiProperty({ example: 3000000 })
	readonly outstandingAmount: number;

	@ApiProperty({ example: 50000000, description: 'Số dư tài khoản hiện tại' })
	readonly accountBalance: number;
}

class BillAlertItemDto {
	@ApiProperty({ example: 'bill-id' })
	readonly id: string;

	@ApiProperty({ example: 'Hóa đơn tháng 11 phòng 101' })
	readonly title: string;

	@ApiProperty({ example: 5000000 })
	readonly amount: number;

	@ApiProperty({ example: '2025-11-10T00:00:00.000Z' })
	readonly dueDate: Date;

	@ApiProperty({ example: 'Nguyễn Văn B' })
	readonly tenantName: string;
}

class BillAlertSummaryDto {
	@ApiProperty({ example: 2 })
	readonly overdueCount: number;

	@ApiProperty({ example: 3 })
	readonly dueSoonCount: number;

	@ApiProperty({ type: () => BillAlertItemDto, isArray: true })
	readonly overdueBills: BillAlertItemDto[];

	@ApiProperty({ type: () => BillAlertItemDto, isArray: true })
	readonly dueSoonBills: BillAlertItemDto[];
}

class PaymentHighlightDto {
	@ApiProperty({ example: 'payment-id' })
	readonly id: string;

	@ApiProperty({ example: 4500000 })
	readonly amount: number;

	@ApiProperty({ example: '2025-11-04T00:00:00.000Z' })
	readonly paidAt: Date;

	@ApiProperty({ example: 'Phòng 201 - Minh Quân' })
	readonly reference: string;
}

class PaymentSummaryDto {
	@ApiProperty({ example: 2 })
	readonly pendingPayments: number;

	@ApiProperty({ type: () => PaymentHighlightDto, isArray: true })
	readonly latestPayments: PaymentHighlightDto[];
}

/**
 * Thông tin tài chính cho dashboard landlord.
 */
export class DashboardFinanceResponseDto {
	@ApiProperty({ type: () => ReferencePeriodDto })
	readonly referencePeriod: ReferencePeriodDto;

	@ApiProperty({ type: () => RevenueSnapshotDto })
	readonly revenue: RevenueSnapshotDto;

	@ApiProperty({ type: () => BillAlertSummaryDto })
	readonly bills: BillAlertSummaryDto;

	@ApiProperty({ type: () => PaymentSummaryDto })
	readonly payments: PaymentSummaryDto;

	@ApiProperty({
		description: 'Những biểu đồ chính trên dashboard tài chính',
		example: ['revenueTrend', 'buildingPerformance', 'roomTypeDistribution'],
	})
	readonly charts: Record<string, ChartResponseDto>;
}
