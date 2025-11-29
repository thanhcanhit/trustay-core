import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FindRoomInstanceQueryDto {
	@ApiPropertyOptional({
		description: 'Building ID (UUID)',
		example: 'b6e8a8f2-8c8c-4b8a-9b8a-7c8b8a8b8a8b',
	})
	@IsOptional()
	@IsUUID()
	buildingId?: string;

	@ApiPropertyOptional({
		description:
			'Search text. If matches UUID format, the search will target IDs (roomInstanceId/roomId). Otherwise it searches by building name, room name, owner name, or room number',
		example: 'Phòng VIP',
	})
	@IsOptional()
	@IsString()
	search?: string;
}

export class RoomInstanceSearchResultDto {
	@ApiProperty({ example: 'uuid-room-instance-id' })
	id: string;

	@ApiProperty({ example: 'A101' })
	roomNumber: string;

	@ApiProperty({ example: 'uuid-room-id' })
	roomId: string;

	@ApiProperty({ example: 'Phòng VIP' })
	roomName: string;

	@ApiProperty({ example: 'uuid-building-id' })
	buildingId: string;

	@ApiProperty({ example: 'Nhà trọ Minh Phát' })
	buildingName: string;

	@ApiProperty({ example: 'uuid-owner-id' })
	ownerId: string;

	@ApiProperty({ example: 'Nguyễn Văn Minh' })
	ownerName: string;
}
