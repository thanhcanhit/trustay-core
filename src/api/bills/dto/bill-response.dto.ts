import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { Expose, Transform } from 'class-transformer';

export class BillItemResponseDto {
	@ApiProperty({ description: 'ID của bill item' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Loại item' })
	@Expose()
	itemType: string;

	@ApiProperty({ description: 'Tên item' })
	@Expose()
	itemName: string;

	@ApiPropertyOptional({ description: 'Mô tả' })
	@Expose()
	description?: string;

	@ApiPropertyOptional({ description: 'Số lượng' })
	@Expose()
	quantity?: number;

	@ApiPropertyOptional({ description: 'Đơn giá' })
	@Expose()
	unitPrice?: number;

	@ApiProperty({ description: 'Thành tiền' })
	@Expose()
	amount: number;

	@ApiProperty({ description: 'Tiền tệ' })
	@Expose()
	currency: string;

	@ApiPropertyOptional({ description: 'Ghi chú' })
	@Expose()
	notes?: string;

	@ApiProperty({ description: 'Ngày tạo' })
	@Expose()
	createdAt: Date;
}

export class BillResponseDto {
	@ApiProperty({ description: 'ID của hóa đơn' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'ID của rental' })
	@Expose()
	rentalId: string;

	@ApiProperty({ description: 'ID của room instance' })
	@Expose()
	roomInstanceId: string;

	@ApiProperty({ description: 'Kỳ hóa đơn' })
	@Expose()
	billingPeriod: string;

	@ApiProperty({ description: 'Tháng hóa đơn' })
	@Expose()
	billingMonth: number;

	@ApiProperty({ description: 'Năm hóa đơn' })
	@Expose()
	billingYear: number;

	@ApiProperty({ description: 'Ngày bắt đầu kỳ' })
	@Expose()
	periodStart: Date;

	@ApiProperty({ description: 'Ngày kết thúc kỳ' })
	@Expose()
	periodEnd: Date;

	@ApiProperty({ description: 'Tổng tiền trước thuế' })
	@Expose()
	subtotal: number;

	@ApiProperty({ description: 'Số tiền giảm giá' })
	@Expose()
	discountAmount: number;

	@ApiProperty({ description: 'Số tiền thuế' })
	@Expose()
	taxAmount: number;

	@ApiProperty({ description: 'Tổng tiền phải trả' })
	@Expose()
	totalAmount: number;

	@ApiProperty({ description: 'Số tiền đã trả' })
	@Expose()
	paidAmount: number;

	@ApiProperty({ description: 'Số tiền còn lại' })
	@Expose()
	remainingAmount: number;

	@ApiProperty({ description: 'Trạng thái hóa đơn', enum: BillStatus })
	@Expose()
	status: BillStatus;

	@ApiProperty({ description: 'Ngày đến hạn' })
	@Expose()
	dueDate: Date;

	@ApiPropertyOptional({ description: 'Ngày thanh toán' })
	@Expose()
	paidDate?: Date;

	@ApiPropertyOptional({ description: 'Ghi chú' })
	@Expose()
	notes?: string;

	@ApiProperty({ description: 'Ngày tạo' })
	@Expose()
	createdAt: Date;

	@ApiProperty({ description: 'Ngày cập nhật' })
	@Expose()
	updatedAt: Date;

	@ApiPropertyOptional({ description: 'Chi tiết hóa đơn', type: [BillItemResponseDto] })
	@Expose()
	@Transform(({ obj }) =>
		obj.billItems?.map((item: any) => ({
			id: item.id,
			itemType: item.itemType,
			itemName: item.itemName,
			description: item.description,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			amount: item.amount,
			currency: item.currency,
			notes: item.notes,
			createdAt: item.createdAt,
		})),
	)
	billItems?: BillItemResponseDto[];

	@ApiPropertyOptional({ description: 'Thông tin rental' })
	@Expose()
	@Transform(({ obj }) =>
		obj.rental
			? {
					id: obj.rental.id,
					monthlyRent: obj.rental.monthlyRent,
					roomInstance: {
						roomNumber: obj.rental.roomInstance?.roomNumber,
						room: {
							name: obj.rental.roomInstance?.room?.name,
						},
					},
				}
			: undefined,
	)
	rental?: {
		id: string;
		monthlyRent: number;
		roomInstance: {
			roomNumber: string;
			room: {
				name: string;
			};
		};
	};
}
