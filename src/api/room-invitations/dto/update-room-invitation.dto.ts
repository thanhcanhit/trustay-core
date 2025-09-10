import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateRoomInvitationDto {
	@ApiPropertyOptional({
		description: 'Trạng thái lời mời',
		enum: InvitationStatus,
		example: 'accepted',
	})
	@IsOptional()
	@IsEnum(InvitationStatus, {
		message: `status must be one of: ${Object.values(InvitationStatus).join(', ')}`,
	})
	status?: InvitationStatus;

	@ApiPropertyOptional({
		description: 'Ghi chú phản hồi từ tenant',
		example: 'Tôi quan tâm và muốn xem phòng trước',
	})
	@IsOptional()
	@IsString()
	tenantNotes?: string;
}
