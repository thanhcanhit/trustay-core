import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class BookingRequestResponseDto {
	@ApiProperty({
		description: 'ID của booking request',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id: string;

	@ApiProperty({
		description: 'ID của tenant',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	tenantId: string;

	@ApiProperty({
		description: 'ID của room',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	roomId: string;

	@ApiProperty({
		description: 'Ngày move-in dự kiến',
		example: '2024-02-01T00:00:00.000Z',
	})
	moveInDate: Date;

	@ApiPropertyOptional({
		description: 'Ngày move-out dự kiến',
		example: '2024-08-01T00:00:00.000Z',
	})
	moveOutDate?: Date;

	@ApiPropertyOptional({
		description: 'Số tháng thuê',
		example: 6,
	})
	rentalMonths?: number;

	@ApiProperty({
		description: 'Tiền thuê hàng tháng',
		example: '3500000',
	})
	monthlyRent: string;

	@ApiProperty({
		description: 'Tiền cọc',
		example: '7000000',
	})
	depositAmount: string;

	@ApiProperty({
		description: 'Tổng tiền',
		example: '28000000',
	})
	totalAmount: string;

	@ApiPropertyOptional({
		description: 'Tin nhắn cho chủ nhà',
		example: 'Quan tâm đến phòng này',
	})
	messageToOwner?: string;

	@ApiPropertyOptional({
		description: 'Ghi chú từ chủ nhà',
		example: 'Phòng sẵn sàng từ đầu tháng 2',
	})
	ownerNotes?: string;

	@ApiProperty({
		description: 'Trạng thái booking',
		enum: BookingStatus,
		example: 'pending',
	})
	status: BookingStatus;

	@ApiProperty({
		description: 'Thời gian tạo',
		example: '2024-01-15T10:30:00.000Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Thời gian cập nhật',
		example: '2024-01-15T10:30:00.000Z',
	})
	updatedAt: Date;

	// Relation data (optional, loaded when needed)
	tenant?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		phone: string;
	};

	room?: {
		id: string;
		name: string;
		building: {
			id: string;
			name: string;
		};
	};
}

export class PaginatedBookingRequestResponseDto {
	@ApiProperty({
		description: 'Danh sách booking requests',
		type: [BookingRequestResponseDto],
	})
	data: BookingRequestResponseDto[];

	@ApiProperty({
		description: 'Thông tin phân trang',
	})
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}
