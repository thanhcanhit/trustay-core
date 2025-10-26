import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBillDto {
	@ApiPropertyOptional({ description: 'Trạng thái hóa đơn' })
	@IsOptional()
	@IsEnum(BillStatus)
	status?: BillStatus;

	@ApiPropertyOptional({ description: 'Số tiền giảm giá' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	discountAmount?: number;

	@ApiPropertyOptional({ description: 'Số tiền thuế' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	taxAmount?: number;

	@ApiPropertyOptional({ description: 'Tổng tiền phải trả' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	totalAmount?: number;

	@ApiPropertyOptional({ description: 'Ngày đến hạn' })
	@IsOptional()
	@IsDateString()
	dueDate?: string;

	@ApiPropertyOptional({ description: 'Ghi chú' })
	@IsOptional()
	notes?: string;
}
