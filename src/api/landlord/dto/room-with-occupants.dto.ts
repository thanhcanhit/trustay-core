import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OccupantDto {
	@ApiProperty()
	tenantId: string;

	@ApiPropertyOptional()
	firstName?: string;

	@ApiPropertyOptional()
	lastName?: string;

	@ApiPropertyOptional()
	email?: string;

	@ApiPropertyOptional()
	phone?: string;

	@ApiPropertyOptional()
	avatarUrl?: string;

	@ApiProperty()
	rentalId: string;
}

export class RoomWithOccupantsDto {
	@ApiProperty()
	roomId: string;

	@ApiPropertyOptional()
	roomName?: string;

	@ApiProperty()
	buildingId: string;

	@ApiProperty()
	buildingName: string;

	@ApiProperty()
	totalInstances: number;

	@ApiProperty()
	occupiedInstances: number;

	@ApiProperty({ type: [OccupantDto] })
	occupants: OccupantDto[];
}
