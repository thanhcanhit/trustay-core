import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { RoomRoomSeekingPostDto } from '../../room-seeking-post/dto/room-seeking-post-response.dto';

export class PaginatedRoomSeekingResponseDto extends PaginatedResponseDto<RoomRoomSeekingPostDto> {
	@ApiProperty({ type: [RoomRoomSeekingPostDto] })
	declare data: RoomRoomSeekingPostDto[];
}
