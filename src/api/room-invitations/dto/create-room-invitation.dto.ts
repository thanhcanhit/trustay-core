import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoomInvitationDto {
	@ApiProperty({
		description: 'ID của room để mời',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsString()
	@IsNotEmpty()
	roomId: string;

	@ApiProperty({
		description: 'ID của tenant được mời',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	@IsNotEmpty()
	tenantId: string;

	@ApiPropertyOptional({
		description: 'Optional Room Seeking Post ID to link this invitation',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	roomSeekingPostId?: string;

	@ApiProperty({
		description: 'Ngày có thể move-in',
		example: '2024-02-01T00:00:00.000Z',
	})
	@IsDateString()
	@IsNotEmpty()
	availableFrom: string;

	@ApiPropertyOptional({
		description: 'Ngày cuối có thể move-in',
		example: '2024-03-01T00:00:00.000Z',
	})
	@IsOptional()
	@IsDateString()
	availableUntil?: string;

	@ApiPropertyOptional({
		description: 'Tin nhắn mời từ landlord',
		example: 'Tôi nghĩ phòng này phù hợp với bạn. Bạn có quan tâm không?',
	})
	@IsOptional()
	@IsString()
	invitationMessage?: string;

	@ApiPropertyOptional({
		description: 'Giá thuê đề xuất (nếu khác giá gốc)',
		example: '3200000',
	})
	@IsOptional()
	@IsString()
	proposedRent?: string;
}
