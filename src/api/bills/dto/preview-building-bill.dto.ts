import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsString, Min } from 'class-validator';

export class PreviewBuildingBillDto {
	@ApiProperty({ description: 'ID của building' })
	@IsString()
	buildingId: string;

	@ApiProperty({ description: 'Kỳ hóa đơn (format: YYYY-MM)', example: '2025-01' })
	@IsString()
	billingPeriod: string;

	@ApiProperty({ description: 'Tháng hóa đơn (1-12)', example: 1 })
	@IsNumber()
	@Min(1)
	billingMonth: number;

	@ApiProperty({ description: 'Năm hóa đơn', example: 2025 })
	@IsNumber()
	@Min(2020)
	billingYear: number;

	@ApiProperty({ description: 'Ngày bắt đầu kỳ', example: '2025-01-01' })
	@IsDateString()
	periodStart: string;

	@ApiProperty({ description: 'Ngày kết thúc kỳ', example: '2025-01-31' })
	@IsDateString()
	periodEnd: string;
}

export class RoomBillPreviewDto {
	@ApiProperty({ description: 'ID của room instance' })
	roomInstanceId: string;

	@ApiProperty({ description: 'Số phòng', example: '101' })
	roomNumber: string;

	@ApiProperty({ description: 'Tên phòng', example: 'Phòng đôi' })
	roomName: string;

	@ApiProperty({ description: 'ID của rental' })
	rentalId: string;

	@ApiProperty({ description: 'Tên tenant', example: 'Nguyễn Văn A' })
	tenantName: string;

	@ApiProperty({ description: 'Số người ở', example: 2 })
	occupancyCount: number;

	@ApiProperty({ description: 'Các bill items đã tính toán', type: [Object] })
	calculatedItems: any[];

	@ApiProperty({ description: 'Tổng tiền đã tính', example: 5000000 })
	calculatedTotal: number;

	@ApiProperty({ description: 'Các costs cần nhập meter data', type: [Object] })
	meterCostsToInput: any[];
}

export class BuildingBillPreviewDto {
	@ApiProperty({ description: 'ID của building' })
	buildingId: string;

	@ApiProperty({ description: 'Tên building', example: 'Chung cư ABC' })
	buildingName: string;

	@ApiProperty({ description: 'Kỳ hóa đơn', example: '2025-01' })
	billingPeriod: string;

	@ApiProperty({ description: 'Danh sách hóa đơn các phòng', type: [RoomBillPreviewDto] })
	roomBills: RoomBillPreviewDto[];

	@ApiProperty({ description: 'Tổng tiền toàn building', example: 50000000 })
	totalBuildingAmount: number;

	@ApiProperty({ description: 'Số phòng có hóa đơn', example: 10 })
	totalRooms: number;

	@ApiProperty({ description: 'Số phòng cần nhập meter data', example: 5 })
	roomsNeedingMeterData: number;
}
