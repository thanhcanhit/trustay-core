import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Transform, Type } from 'class-transformer';
import {
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
} from 'class-validator';

export class CreatePaymentDto {
	@ApiProperty({ description: 'ID của rental' })
	@IsUUID()
	rentalId: string;

	@ApiProperty({ description: 'ID của bill (optional)', required: false })
	@IsOptional()
	@IsUUID()
	billId?: string;

	@ApiProperty({ enum: PaymentType, description: 'Loại thanh toán' })
	@IsEnum(PaymentType)
	paymentType: PaymentType;

	@ApiProperty({ description: 'Số tiền thanh toán', type: 'number', example: 4021451.61 })
	@IsNotEmpty()
	@Type(() => Number)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Transform(({ value }) => new Decimal(value))
	amount: Decimal;

	@ApiProperty({ default: 'VND', description: 'Loại tiền tệ' })
	@IsOptional()
	@IsString()
	currency?: string = 'VND';

	@ApiProperty({ enum: PaymentMethod, description: 'Phương thức thanh toán', required: false })
	@IsOptional()
	@IsEnum(PaymentMethod)
	paymentMethod?: PaymentMethod;

	@ApiProperty({ description: 'Ngày đáo hạn thanh toán', required: false })
	@IsOptional()
	@IsDateString()
	dueDate?: string;

	@ApiProperty({ description: 'Mô tả thanh toán', required: false })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ description: 'Mã giao dịch tham chiếu', required: false })
	@IsOptional()
	@IsString()
	transactionReference?: string;
}
