import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PreviewBuildingBillDto {
	@ApiProperty({ description: 'ID của building' })
	@IsString()
	buildingId: string;

	@ApiPropertyOptional({ description: 'Kỳ hóa đơn (format: YYYY-MM)', example: '2025-01' })
	@IsOptional()
	@IsString()
	billingPeriod?: string;

	@ApiPropertyOptional({ description: 'Tháng hóa đơn (1-12)', example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	billingMonth?: number;

	@ApiPropertyOptional({ description: 'Năm hóa đơn', example: 2025 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(2020)
	billingYear?: number;

	@ApiPropertyOptional({
		description: 'Ngày bắt đầu kỳ (mặc định: đầu tháng trước)',
		example: '2025-01-01',
	})
	@IsOptional()
	@IsDateString()
	periodStart?: string;

	@ApiPropertyOptional({
		description: 'Ngày kết thúc kỳ (mặc định: ngày hiện tại)',
		example: '2025-01-31',
	})
	@IsOptional()
	@IsDateString()
	periodEnd?: string;
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
