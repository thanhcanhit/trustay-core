import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingRequestDto {
	@ApiProperty({
		description: 'ID của room muốn book',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	@IsNotEmpty()
	roomId: string;

	@ApiProperty({
		description: 'Ngày dự kiến move-in',
		example: '2024-02-01T00:00:00.000Z',
	})
	@IsDateString()
	@IsNotEmpty()
	moveInDate: string;

	@ApiPropertyOptional({
		description: 'Ngày dự kiến move-out (nếu có)',
		example: '2024-08-01T00:00:00.000Z',
	})
	@IsOptional()
	@IsDateString()
	moveOutDate?: string;

	@ApiPropertyOptional({
		description: 'Tin nhắn gửi cho chủ nhà',
		example: 'Xin chào, tôi quan tâm đến phòng này và mong muốn được thuê.',
	})
	@IsOptional()
	@IsString()
	messageToOwner?: string;
}
