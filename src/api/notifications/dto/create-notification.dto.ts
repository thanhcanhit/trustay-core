import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsJSON, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNotificationDto {
	@ApiProperty({
		description: 'ID của user nhận thông báo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	userId: string;

	@ApiProperty({
		description: 'Loại thông báo',
		example: 'booking_request',
	})
	@IsString()
	notificationType: string;

	@ApiProperty({
		description: 'Tiêu đề thông báo',
		example: 'Yêu cầu booking mới',
	})
	@IsString()
	title: string;

	@ApiProperty({
		description: 'Nội dung thông báo',
		example: 'Bạn có một yêu cầu booking mới cho phòng #101',
	})
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Dữ liệu bổ sung dạng JSON',
		example: { bookingId: '123', roomId: '456' },
	})
	@IsOptional()
	@IsJSON()
	data?: any;

	@ApiPropertyOptional({
		description: 'Thời gian hết hạn thông báo',
		example: '2024-12-31T23:59:59.000Z',
	})
	@IsOptional()
	@IsDateString()
	expiresAt?: string;
}
