import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoommateApplicationStatus } from '../../../common/enums/roommate-application-status.enum';

export class RoommateApplicationResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	roommateSeekingPostId: string;

	@ApiProperty()
	applicantId: string;

	@ApiProperty()
	fullName: string;

	@ApiPropertyOptional()
	occupation?: string;

	@ApiProperty()
	phoneNumber: string;

	@ApiProperty()
	moveInDate: string;

	@ApiPropertyOptional()
	intendedStayMonths?: number;

	@ApiPropertyOptional()
	applicationMessage?: string;

	@ApiProperty({ enum: RoommateApplicationStatus })
	status: RoommateApplicationStatus;

	@ApiPropertyOptional()
	tenantResponse?: string;

	@ApiPropertyOptional()
	tenantRespondedAt?: string;

	@ApiPropertyOptional()
	landlordResponse?: string;

	@ApiPropertyOptional()
	landlordRespondedAt?: string;

	@ApiProperty()
	isUrgent: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	// Relations
	@ApiPropertyOptional()
	applicant?: {
		id: string;
		firstName: string;
		lastName: string;
		avatarUrl?: string;
		email?: string;
	};

	@ApiPropertyOptional()
	roommateSeekingPost?: {
		id: string;
		title: string;
		slug: string;
		monthlyRent: number;
		tenant: {
			id: string;
			firstName: string;
			lastName: string;
			avatarUrl?: string;
		};
	};
}
