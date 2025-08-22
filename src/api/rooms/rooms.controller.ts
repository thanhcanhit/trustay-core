import { Body, Controller, Get, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../../common/dto';
import { CreateRoomDto, RoomResponseDto } from './dto';
import { RoomDetailDto } from './dto/room-detail.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
	constructor(private readonly roomsService: RoomsService) {}

	@Post(':buildingId/rooms')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Tạo room type mới cho building',
		description: `Tạo loại phòng mới với đầy đủ thông tin:
- **Pricing**: Giá thuê, tiền cọc, điều kiện thuê
- **Amenities**: Danh sách tiện ích từ system amenities
- **Costs**: Chi phí phát sinh (điện, nước, internet, v.v.)
- **Rules**: Quy tắc từ system rules
- **Room Instances**: Tự động sinh phòng cụ thể theo totalRooms

Sau khi tạo thành công, hệ thống sẽ tự động:
1. Generate unique slug cho room type
2. Tạo pricing record
3. Link amenities, costs, rules từ system data
4. Batch tạo room instances với room numbers
5. Set tất cả instances = "available" status`,
	})
	@ApiParam({
		name: 'buildingId',
		description: 'ID của building (slug)',
		example: 'nha-tro-minh-phat-quan-1',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Room type được tạo thành công kèm room instances',
		type: ApiResponseDto<RoomResponseDto>,
		schema: {
			example: {
				success: true,
				message: 'Room created successfully with instances',
				data: {
					id: 'uuid-room',
					slug: 'nha-tro-minh-phat-quan-1-phong-vip',
					name: 'Phòng VIP',
					roomType: 'boarding_house',
					areaSqm: 25.5,
					totalRooms: 5,
					availableInstancesCount: 5,
					occupiedInstancesCount: 0,
					pricing: {
						basePriceMonthly: 3500000,
						depositAmount: 7000000,
						depositMonths: 2,
					},
					amenities: [
						{
							name: 'Điều hòa',
							customValue: '2 chiếc',
							notes: 'Điều hòa Daikin inverter',
						},
					],
					costs: [
						{
							name: 'Điện',
							value: 3500,
							costType: 'per_unit',
							unit: 'kWh',
						},
					],
					roomInstances: [
						{ roomNumber: 'A101', status: 'available' },
						{ roomNumber: 'A102', status: 'available' },
						{ roomNumber: 'A103', status: 'available' },
						{ roomNumber: 'A104', status: 'available' },
						{ roomNumber: 'A105', status: 'available' },
					],
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Dữ liệu đầu vào không hợp lệ hoặc system references không tồn tại',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner của building mới có thể tạo rooms',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Building không tồn tại',
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Chưa đăng nhập',
	})
	async create(
		@CurrentUser('id') userId: string,
		@Param('buildingId') buildingId: string,
		@Body() createRoomDto: CreateRoomDto,
	): Promise<ApiResponseDto<RoomResponseDto>> {
		const room = await this.roomsService.create(userId, buildingId, createRoomDto);

		return ApiResponseDto.success(room, 'Room created successfully with instances');
	}

	@Get(':roomId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy thông tin chi tiết room type',
		description:
			'Lấy thông tin chi tiết của room type bao gồm pricing, amenities, costs, rules và room instances',
	})
	@ApiParam({
		name: 'roomId',
		description: 'ID của room type',
		example: 'uuid',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy thông tin room type thành công',
		type: ApiResponseDto<RoomResponseDto>,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Room type không tồn tại',
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Chưa đăng nhập',
	})
	async findOne(@Param('roomId') roomId: string): Promise<ApiResponseDto<RoomResponseDto>> {
		const room = await this.roomsService.findOne(roomId);

		return ApiResponseDto.success(room, 'Room retrieved successfully');
	}

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
