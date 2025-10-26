import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateRoomInvitationDto {
	@ApiPropertyOptional({
		description: 'Trạng thái lời mời',
		enum: RequestStatus,
		example: 'accepted',
	})
	@IsOptional()
	@IsEnum(RequestStatus, {
		message: `status must be one of: ${Object.values(RequestStatus).join(', ')}`,
	})
	status?: RequestStatus;

	@ApiPropertyOptional({
		description: 'Ghi chú phản hồi từ tenant',
		example: 'Tôi quan tâm và muốn xem phòng trước',
	})
	@IsOptional()
	@IsString()
	tenantNotes?: string;
}
