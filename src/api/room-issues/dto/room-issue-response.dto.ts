import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomIssueCategory, RoomIssueStatus } from '@prisma/client';

class RoomIssueReporterDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ required: false })
	firstName?: string | null;

	@ApiProperty({ required: false })
	lastName?: string | null;

	@ApiProperty()
	email: string;

	@ApiProperty({ required: false })
	phone?: string | null;
}

class RoomIssueRoomDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	buildingId: string;

	@ApiProperty()
	buildingName: string;

	@ApiProperty()
	ownerId: string;
}

class RoomIssueRoomInstanceDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	roomNumber: string;

	@ApiProperty({ type: () => RoomIssueRoomDto })
	room: RoomIssueRoomDto;
}

export class RoomIssueResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	title: string;

	@ApiProperty({ enum: RoomIssueCategory })
	category: RoomIssueCategory;

	@ApiProperty({ enum: RoomIssueStatus })
	status: RoomIssueStatus;

	@ApiPropertyOptional({
		description: 'Latest note from landlord about how the issue is being handled',
	})
	landlordNote?: string | null;

	@ApiProperty({ type: [String] })
	imageUrls: string[];

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;

	@ApiProperty({ type: () => RoomIssueReporterDto })
	reporter: RoomIssueReporterDto;

	@ApiProperty({ type: () => RoomIssueRoomInstanceDto })
	roomInstance: RoomIssueRoomInstanceDto;
}
