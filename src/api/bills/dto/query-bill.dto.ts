import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryBillDto {
	@ApiPropertyOptional({ description: 'Trang', example: 1, default: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Số lượng mỗi trang',
		example: 20,
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

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
