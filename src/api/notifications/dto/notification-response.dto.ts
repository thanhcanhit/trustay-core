import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
	@ApiProperty({
		description: 'ID của thông báo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id: string;

	@ApiProperty({
		description: 'ID của user nhận thông báo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	userId: string;

	@ApiProperty({
		description: 'Loại thông báo',
		example: 'booking_request',
	})
	notificationType: string;

	@ApiProperty({
		description: 'Tiêu đề thông báo',
		example: 'Yêu cầu booking mới',
	})
	title: string;

	@ApiProperty({
		description: 'Nội dung thông báo',
		example: 'Bạn có một yêu cầu booking mới cho phòng #101',
	})
	message: string;

	@ApiPropertyOptional({
		description: 'Dữ liệu bổ sung dạng JSON',
		example: { bookingId: '123', roomId: '456' },
	})
	data?: any;

	@ApiProperty({
		description: 'Trạng thái đã đọc',
		example: false,
	})
	isRead: boolean;

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

	@ApiPropertyOptional({
		description: 'Thời gian hết hạn thông báo',
		example: '2024-12-31T23:59:59.000Z',
	})
	expiresAt?: Date;
}

export class NotificationCountResponseDto {
	@ApiProperty({
		description: 'Số lượng thông báo chưa đọc',
		example: 5,
	})
	unreadCount: number;
}

export class PaginatedNotificationResponseDto {
	@ApiProperty({
		description: 'Danh sách thông báo',
		type: [NotificationResponseDto],
	})
	data: NotificationResponseDto[];

	@ApiProperty({
		description: 'Thông tin phân trang',
		example: {
			page: 1,
			limit: 20,
			total: 100,
			totalPages: 5,
		},
	})
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}
