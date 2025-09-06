import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus } from '@prisma/client';

export class RoomInvitationResponseDto {
	@ApiProperty({
		description: 'ID của room invitation',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id: string;

	@ApiProperty({
		description: 'ID của landlord',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	senderId: string;

	@ApiProperty({
		description: 'ID của tenant được mời',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	recipientId: string;

	@ApiProperty({
		description: 'ID của room instance',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	roomInstanceId: string;

	@ApiProperty({
		description: 'Ngày có thể move-in',
		example: '2024-02-01T00:00:00.000Z',
	})
	moveInDate: Date;

	@ApiPropertyOptional({
		description: 'Số tháng thuê',
		example: 6,
	})
	rentalMonths?: number;

	@ApiPropertyOptional({
		description: 'Tin nhắn mời',
		example: 'Tôi nghĩ phòng này phù hợp với bạn',
	})
	message?: string;

	@ApiProperty({
		description: 'Giá thuê đề xuất',
		example: '3200000',
	})
	monthlyRent: number;

	@ApiProperty({
		description: 'Tiền cọc',
		example: '6400000',
	})
	depositAmount: number;

	@ApiProperty({
		description: 'Trạng thái lời mời',
		enum: InvitationStatus,
		example: 'pending',
	})
	status: InvitationStatus;

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
	recipient?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		phone: string;
	};

	sender?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		phone: string;
	};

	roomInstance?: {
		id: string;
		roomNumber: string;
		room: {
			id: string;
			name: string;
			building: {
				id: string;
				name: string;
			};
		};
	};
}

export class PaginatedRoomInvitationResponseDto {
	@ApiProperty({
		description: 'Danh sách room invitations',
		type: [RoomInvitationResponseDto],
	})
	data: RoomInvitationResponseDto[];

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
