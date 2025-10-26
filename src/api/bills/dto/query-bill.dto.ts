import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryBillDto {
	@ApiPropertyOptional({ description: 'Trang', example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({ description: 'Số lượng mỗi trang', example: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	limit?: number;

	@ApiPropertyOptional({ description: 'ID của rental' })
	@IsOptional()
	@IsString()
	rentalId?: string;

	@ApiPropertyOptional({ description: 'ID của room instance' })
	@IsOptional()
	@IsString()
	roomInstanceId?: string;

	@ApiPropertyOptional({ description: 'Trạng thái hóa đơn' })
	@IsOptional()
	@IsEnum(BillStatus)
	status?: BillStatus;

	@ApiPropertyOptional({ description: 'Từ ngày' })
	@IsOptional()
	@IsDateString()
	fromDate?: string;

	@ApiPropertyOptional({ description: 'Đến ngày' })
	@IsOptional()
	@IsDateString()
	toDate?: string;

	@ApiPropertyOptional({ description: 'Kỳ hóa đơn (format: YYYY-MM)' })
	@IsOptional()
	@IsString()
	billingPeriod?: string;
}
