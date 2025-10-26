import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GenerateBillDto {
	@ApiProperty({ description: 'ID của rental' })
	@IsString()
	rentalId: string;

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

	@ApiPropertyOptional({ description: 'Số người ở trong kỳ (cho per_person costs)', example: 2 })
	@IsOptional()
	@IsNumber()
	@Min(1)
	occupancyCount?: number;

	@ApiPropertyOptional({ description: 'Ngày bắt đầu rental trong kỳ (cho prorated calculation)' })
	@IsOptional()
	@IsDateString()
	rentalStartDate?: string;

	@ApiPropertyOptional({ description: 'Ngày kết thúc rental trong kỳ (cho prorated calculation)' })
	@IsOptional()
	@IsDateString()
	rentalEndDate?: string;

	@ApiPropertyOptional({ description: 'Ghi chú' })
	@IsOptional()
	@IsString()
	notes?: string;
}
