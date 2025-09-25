import { ApiProperty } from '@nestjs/swagger';
import { RoommateApplicationStatus } from '@prisma/client';

export class ApplicationStatisticsDto {
	@ApiProperty({ description: 'Tổng số đơn ứng tuyển' })
	total: number;

	@ApiProperty({ description: 'Số đơn đang chờ xử lý' })
	pending: number;

	@ApiProperty({ description: 'Số đơn đã được tenant phê duyệt' })
	approvedByTenant: number;

	@ApiProperty({ description: 'Số đơn bị tenant từ chối' })
	rejectedByTenant: number;

	@ApiProperty({ description: 'Số đơn đã được landlord phê duyệt' })
	approvedByLandlord: number;

	@ApiProperty({ description: 'Số đơn bị landlord từ chối' })
	rejectedByLandlord: number;

	@ApiProperty({ description: 'Số đơn đã bị hủy' })
	cancelled: number;

	@ApiProperty({ description: 'Số đơn hết hạn' })
	expired: number;

	@ApiProperty({ description: 'Số đơn khẩn cấp' })
	urgent: number;

	@ApiProperty({ description: 'Thống kê theo ngày trong 7 ngày qua' })
	dailyStats: {
		date: string;
		count: number;
	}[];

	@ApiProperty({ description: 'Thống kê theo trạng thái' })
	statusBreakdown: {
		status: RoommateApplicationStatus;
		count: number;
		percentage: number;
	}[];
}
