import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for sending a message in a conversation
 */
export class ConversationMessageDto {
	@ApiProperty({
		description: 'Message content',
		example: 'Tìm phòng trọ giá rẻ ở quận 1',
	})
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Pathname of current page (for context)',
		example: '/rooms/tuyenquan-go-vap-phong-ap1443',
	})
	@IsOptional()
	@IsString()
	currentPage?: string;

	@ApiPropertyOptional({
		description: 'Images attached to the message',
		type: [String],
		format: 'binary',
	})
	@IsOptional()
	images?: string[];
}

/**
 * DTO for creating a new conversation
 */
export class CreateConversationDto {
	@ApiPropertyOptional({
		description: 'Initial message for the conversation',
		example: 'Tìm phòng trọ giá rẻ ở quận 1',
	})
	@IsOptional()
	@IsString()
	initialMessage?: string;

	@ApiPropertyOptional({
		description: 'Custom title for the conversation',
		example: 'Tìm phòng Gò Vấp',
	})
	@IsOptional()
	@IsString()
	title?: string;

	@ApiPropertyOptional({
		description: 'Pathname of current page (for context)',
		example: '/rooms/tuyenquan-go-vap-phong-ap1443',
	})
	@IsOptional()
	@IsString()
	currentPage?: string;
}
