import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsNumber,
	IsOptional,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';

export class MeterReadingDto {
	@ApiProperty({ description: 'ID của room cost (metered type)' })
	@IsString()
	roomCostId: string;

	@ApiProperty({ description: 'Số đồng hồ hiện tại', example: 1500.5 })
	@IsNumber()
	@Min(0)
	currentReading: number;

	@ApiProperty({ description: 'Số đồng hồ tháng trước', example: 1200.0 })
	@IsNumber()
	@Min(0)
	lastReading: number;
}

export class CreateBillForRoomDto {
	@ApiProperty({ description: 'ID của room instance' })
	@IsString()
	roomInstanceId: string;

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

	@ApiProperty({ description: 'Số người ở trong kỳ (cho per_person costs)', example: 2 })
	@IsNumber()
	@Min(1)
	occupancyCount: number;

	@ApiProperty({ description: 'Dữ liệu đồng hồ cho metered costs', type: [MeterReadingDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MeterReadingDto)
	meterReadings: MeterReadingDto[];

	@ApiPropertyOptional({ description: 'Ghi chú' })
	@IsOptional()
	@IsString()
	notes?: string;
}
