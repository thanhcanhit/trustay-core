import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayosPaymentLinkResponseDto {
	@ApiProperty({ description: 'Đường dẫn thanh toán PayOS' })
	checkoutUrl: string;

	@ApiProperty({ description: 'Mã QR để thanh toán nhanh' })
	qrCode: string;

	@ApiProperty({ description: 'Mã đơn hàng (order code) đã gửi tới PayOS' })
	orderCode: number;

	@ApiProperty({ description: 'Tổng số tiền yêu cầu thanh toán' })
	amount: number;

	@ApiProperty({ description: 'Loại tiền tệ của giao dịch' })
	currency: string;

	@ApiProperty({ description: 'Mô tả giao dịch hiển thị cho người dùng' })
	description: string;

	@ApiProperty({ description: 'ID link thanh toán trên PayOS' })
	paymentLinkId: string;

	@ApiPropertyOptional({ description: 'Thời điểm hết hạn link thanh toán (epoch seconds)' })
	expiredAt: number | null;
}
