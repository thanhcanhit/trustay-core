import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus, PaymentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class PaymentResponseDto {
	@ApiProperty({ description: 'ID thanh toán' })
	id: string;

	@ApiProperty({ description: 'ID của rental' })
	rentalId: string;

	@ApiProperty({ description: 'ID của monthly bill', required: false })
	monthlyBillId?: string;

	@ApiProperty({ description: 'ID người thanh toán' })
	payerId: string;

	@ApiProperty({ enum: PaymentType, description: 'Loại thanh toán' })
	paymentType: PaymentType;

	@ApiProperty({ description: 'Số tiền thanh toán' })
	amount: Decimal;

	@ApiProperty({ description: 'Loại tiền tệ' })
	currency: string;

	@ApiProperty({ enum: PaymentMethod, description: 'Phương thức thanh toán', required: false })
	paymentMethod?: PaymentMethod;

	@ApiProperty({ enum: PaymentStatus, description: 'Trạng thái thanh toán' })
	paymentStatus: PaymentStatus;

	@ApiProperty({ description: 'Ngày thanh toán thực tế', required: false })
	paymentDate?: Date;

	@ApiProperty({ description: 'Ngày đáo hạn thanh toán', required: false })
	dueDate?: Date;

	@ApiProperty({ description: 'Mô tả thanh toán', required: false })
	description?: string;

	@ApiProperty({ description: 'Mã giao dịch tham chiếu', required: false })
	transactionReference?: string;

	@ApiProperty({ description: 'Ngày tạo' })
	createdAt: Date;

	@ApiProperty({ description: 'Ngày cập nhật' })
	updatedAt: Date;

	@ApiProperty({ description: 'Thông tin người thanh toán', required: false })
	payer?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
	};

	@ApiProperty({ description: 'Thông tin rental', required: false })
	rental?: {
		id: string;
		monthlyRent: Decimal;
		roomInstance: {
			roomNumber: string;
			room: {
				name: string;
			};
		};
	};
}
