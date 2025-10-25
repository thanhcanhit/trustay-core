import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RespondToApplicationDto {
	@ApiProperty({
		description: 'Quyết định phê duyệt',
		enum: RequestStatus,
		example: 'accepted',
	})
	@IsEnum(RequestStatus)
	status: RequestStatus;

	@ApiPropertyOptional({ description: 'Lời nhắn phản hồi' })
	@IsOptional()
	@IsString()
	response?: string;
}
