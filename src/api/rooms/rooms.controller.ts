import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoomDetailDto } from './dto/room-detail.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller('api/rooms')
export class RoomsController {
	constructor(private readonly roomsService: RoomsService) {}

	@Get(':slug')
	@ApiOperation({ summary: 'Get room details by slug' })
	@ApiParam({
		name: 'slug',
		description: 'Room slug identifier',
		example: 'van528-quan-10-phong-101887',
	})
	@ApiResponse({
		status: 200,
		description: 'Room details retrieved successfully',
		type: RoomDetailDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Room not found',
	})
	async getRoomBySlug(@Param('slug') slug: string): Promise<RoomDetailDto> {
		return this.roomsService.getRoomBySlug(slug);
	}
}
