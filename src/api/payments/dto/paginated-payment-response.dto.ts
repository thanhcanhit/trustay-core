import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { PaymentResponseDto } from './payment-response.dto';

export class PaginatedPaymentResponseDto extends PaginatedResponseDto<PaymentResponseDto> {
	@ApiProperty({ type: [PaymentResponseDto] })
	declare data: PaymentResponseDto[];
}
