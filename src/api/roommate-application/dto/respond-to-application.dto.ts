import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RoommateApplicationStatus } from '../../../common/enums/roommate-application-status.enum';

export class RespondToApplicationDto {
	@ApiProperty({
		description: 'Quyết định phê duyệt',
		enum: [
			RoommateApplicationStatus.approved_by_tenant,
			RoommateApplicationStatus.rejected_by_tenant,
			RoommateApplicationStatus.approved_by_landlord,
			RoommateApplicationStatus.rejected_by_landlord,
		],
	})
	@IsEnum([
		RoommateApplicationStatus.approved_by_tenant,
		RoommateApplicationStatus.rejected_by_tenant,
		RoommateApplicationStatus.approved_by_landlord,
		RoommateApplicationStatus.rejected_by_landlord,
	])
	status: RoommateApplicationStatus;

	@ApiPropertyOptional({ description: 'Lời nhắn phản hồi' })
	@IsOptional()
	@IsString()
	response?: string;
}
