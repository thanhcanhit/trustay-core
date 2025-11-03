import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalStatus } from '@prisma/client';

export class RentalResponseDto {
	@ApiProperty({
		description: 'ID của rental',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	id: string;

	@ApiPropertyOptional({
		description: 'ID của room booking',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	bookingRequestId?: string;

	@ApiPropertyOptional({
		description: 'ID của invitation',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	invitationId?: string;

	@ApiProperty({
		description: 'ID của room instance',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	roomInstanceId: string;

	@ApiProperty({
		description: 'ID của tenant',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	tenantId: string;

	@ApiProperty({
		description: 'ID của owner',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	ownerId: string;

	@ApiProperty({
		description: 'Ngày bắt đầu hợp đồng',
		example: '2024-02-01T00:00:00.000Z',
	})
	contractStartDate: Date;

	@ApiPropertyOptional({
		description: 'Ngày kết thúc hợp đồng',
		example: '2024-08-01T00:00:00.000Z',
	})
	contractEndDate?: Date;

	@ApiProperty({
		description: 'Tiền thuê hàng tháng',
		example: '3500000',
	})
	monthlyRent: string;

	@ApiProperty({
		description: 'Tiền cọc đã trả',
		example: '7000000',
	})
	depositPaid: string;

	@ApiProperty({
		description: 'Trạng thái rental',
		enum: RentalStatus,
		example: 'active',
	})
	status: RentalStatus;

	@ApiPropertyOptional({
		description: 'URL document hợp đồng',
		example: 'https://example.com/contracts/contract-123.pdf',
	})
	contractDocumentUrl?: string;

	@ApiPropertyOptional({
		description: 'Ngày thông báo chấm dứt hợp đồng',
		example: '2024-07-15T00:00:00.000Z',
	})
	terminationNoticeDate?: Date;

	@ApiPropertyOptional({
		description: 'Lý do chấm dứt hợp đồng',
		example: 'Tenant vi phạm điều khoản hợp đồng',
	})
	terminationReason?: string;

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

	owner?: {
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

	roomBooking?: {
		id: string;
		moveInDate: Date;
		moveOutDate?: Date;
	};

	invitation?: {
		id: string;
		moveInDate: Date;
		message?: string;
	};

	@ApiPropertyOptional({
		description: 'Danh sách thành viên trong cùng phòng',
		type: [Object],
	})
	members?: Array<{
		tenantId: string;
		firstName?: string;
		lastName?: string;
		email?: string;
		phone?: string;
		avatarUrl?: string;
		rentalId: string;
	}>;
}

export class PaginatedRentalResponseDto {
	@ApiProperty({
		description: 'Danh sách rentals',
		type: [RentalResponseDto],
	})
	data: RentalResponseDto[];

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
