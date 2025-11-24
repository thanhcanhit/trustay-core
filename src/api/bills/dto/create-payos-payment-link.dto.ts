import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class CreatePayosPaymentLinkDto {
	@ApiPropertyOptional({
		description: 'URL người dùng được chuyển tới sau khi thanh toán thành công',
		example: 'https://app.trustay.vn/payments/success',
	})
	@IsOptional()
	@IsUrl()
	returnUrl?: string;

	@ApiPropertyOptional({
		description: 'URL quay về khi người dùng hủy thanh toán',
		example: 'https://app.trustay.vn/payments/cancel',
	})
	@IsOptional()
	@IsUrl()
	cancelUrl?: string;
}
