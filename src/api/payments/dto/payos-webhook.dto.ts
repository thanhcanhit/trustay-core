import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';

export class PayosWebhookDataDto {
	@ApiProperty()
	@IsNumber()
	orderCode: number;

	@ApiProperty()
	@IsNumber()
	amount: number;

	@ApiProperty()
	@IsString()
	description: string;

	@ApiProperty()
	@IsString()
	accountNumber: string;

	@ApiProperty()
	@IsString()
	reference: string;

	@ApiProperty()
	@IsString()
	transactionDateTime: string;

	@ApiProperty()
	@IsString()
	currency: string;

	@ApiProperty()
	@IsString()
	paymentLinkId: string;

	@ApiProperty()
	@IsString()
	code: string;

	@ApiProperty()
	@IsString()
	desc: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	counterAccountBankId?: string | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	counterAccountBankName?: string | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	counterAccountName?: string | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	counterAccountNumber?: string | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	virtualAccountName?: string | null;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	virtualAccountNumber?: string | null;
}

export class PayosWebhookDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	code: string;

	@ApiProperty()
	@IsString()
	desc: string;

	@ApiProperty()
	@IsBoolean()
	success: boolean;

	@ApiProperty()
	@IsString()
	signature: string;

	@ApiProperty({ type: PayosWebhookDataDto })
	@ValidateNested()
	@Type(() => PayosWebhookDataDto)
	data: PayosWebhookDataDto;
}
