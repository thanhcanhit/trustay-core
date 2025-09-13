import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { RoomListItemOutputDto } from '../../../common/dto/room-output.dto';

export class PaginatedListingResponseDto extends PaginatedResponseDto<RoomListItemOutputDto> {
	@ApiProperty({ type: [RoomListItemOutputDto] })
	declare data: RoomListItemOutputDto[];
}
