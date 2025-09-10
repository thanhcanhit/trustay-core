import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryPaymentDto extends PaginationQueryDto {
	@ApiProperty({ description: 'ID của rental', required: false })
	@IsOptional()
	@IsUUID()
	rentalId?: string;

	@ApiProperty({ enum: PaymentType, description: 'Loại thanh toán', required: false })
	@IsOptional()
	@IsEnum(PaymentType)
	paymentType?: PaymentType;

	@ApiProperty({ enum: PaymentStatus, description: 'Trạng thái thanh toán', required: false })
	@IsOptional()
	@IsEnum(PaymentStatus)
	paymentStatus?: PaymentStatus;

	@ApiProperty({ description: 'Từ ngày thanh toán', required: false })
	@IsOptional()
	@IsDateString()
	fromDate?: string;

	@ApiProperty({ description: 'Đến ngày thanh toán', required: false })
	@IsOptional()
	@IsDateString()
	toDate?: string;
}
