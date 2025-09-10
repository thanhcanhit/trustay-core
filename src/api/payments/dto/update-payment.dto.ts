import { ApiProperty, PartialType } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CreatePaymentDto } from './create-payment.dto';

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {
	@ApiProperty({ enum: PaymentStatus, description: 'Trạng thái thanh toán', required: false })
	@IsOptional()
	@IsEnum(PaymentStatus)
	paymentStatus?: PaymentStatus;

	@ApiProperty({ description: 'Ngày thanh toán thực tế', required: false })
	@IsOptional()
	@IsDateString()
	paymentDate?: string;
}
