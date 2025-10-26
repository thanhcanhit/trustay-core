import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBillDto {
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

	@ApiProperty({ description: 'Tổng tiền trước thuế', example: 5000000 })
	@IsNumber()
	@Min(0)
	subtotal: number;

	@ApiPropertyOptional({ description: 'Số tiền giảm giá', example: 0 })
	@IsOptional()
	@IsNumber()
	@Min(0)
	discountAmount?: number;

	@ApiPropertyOptional({ description: 'Số tiền thuế', example: 0 })
	@IsOptional()
	@IsNumber()
	@Min(0)
	taxAmount?: number;

	@ApiProperty({ description: 'Tổng tiền phải trả', example: 5000000 })
	@IsNumber()
	@Min(0)
	totalAmount: number;

	@ApiProperty({ description: 'Ngày đến hạn', example: '2025-02-05' })
	@IsDateString()
	dueDate: string;

	@ApiPropertyOptional({ description: 'Ghi chú' })
	@IsOptional()
	@IsString()
	notes?: string;
}
