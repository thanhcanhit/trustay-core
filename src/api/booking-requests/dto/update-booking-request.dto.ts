import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBookingRequestDto {
	@ApiPropertyOptional({
		description: 'Ghi chú từ chủ nhà',
		example: 'Phòng đã sẵn sàng, vui lòng liên hệ để xem phòng.',
	})
	@IsOptional()
	@IsString()
	ownerNotes?: string;

	@ApiPropertyOptional({
		description: 'Cập nhật trạng thái (chỉ landlord)',
		enum: BookingStatus,
		example: 'approved',
	})
	@IsOptional()
	@IsEnum(BookingStatus, {
		message: `status must be one of: ${Object.values(BookingStatus).join(', ')}`,
	})
	status?: BookingStatus;
}

export class CancelBookingRequestDto {
	@ApiPropertyOptional({
		description: 'Lý do hủy booking',
		example: 'Đã tìm được phòng khác phù hợp hơn',
	})
	@IsOptional()
	@IsString()
	cancellationReason?: string;
}
