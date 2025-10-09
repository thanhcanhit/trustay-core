import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantRoomInfoDto {
	@ApiProperty()
	roomId: string;

	@ApiPropertyOptional()
	roomName?: string;

	@ApiProperty()
	roomNumber: string;

	@ApiProperty()
	buildingId: string;

	@ApiProperty()
	buildingName: string;

	@ApiProperty({ description: 'Total instances for this room' })
	occupancy: number;
}

export class TenantListItemDto {
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

	@ApiProperty({ type: TenantRoomInfoDto })
	room: TenantRoomInfoDto;

	@ApiProperty()
	rentalId: string;

	@ApiProperty()
	rentalStatus: string;

	@ApiProperty()
	contractStartDate: Date;

	@ApiPropertyOptional()
	contractEndDate?: Date;
}
