import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { ApiResponseDto } from '../../common/dto';
import { RoomDetailOutputDto } from '../../common/dto/room-output.dto';
import {
	BulkUpdateRoomInstanceStatusDto,
	CreateRoomDto,
	RoomDetailWithMetaResponseDto,
	UpdateRoomDto,
	UpdateRoomInstanceStatusDto,
} from './dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
	constructor(private readonly roomsService: RoomsService) {}

	@Post(':buildingId/rooms')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiConsumes('application/json')
	@ApiOperation({
		summary: 'Tạo room type mới cho building với hình ảnh',
		description: `Tạo loại phòng mới với đầy đủ thông tin và hình ảnh:
- **Pricing**: Giá thuê, tiền cọc, điều kiện thuê
- **Amenities**: Danh sách tiện ích từ system amenities
- **Costs**: Chi phí phát sinh (điện, nước, internet, v.v.)
- **Rules**: Quy tắc từ system rules
- **Images**: Danh sách hình ảnh với URL, alt text, isPrimary, sortOrder
- **Room Instances**: Tự động sinh phòng cụ thể theo totalRooms

Sau khi tạo thành công, hệ thống sẽ tự động:
1. Xử lý danh sách hình ảnh từ URL
2. Generate unique slug cho room type
3. Tạo pricing record
4. Link amenities, costs, rules từ system data
5. Batch tạo room instances với room numbers
6. Set tất cả instances = "available" status`,
	})
	@ApiParam({
		name: 'buildingId',
		description: 'ID của building (slug)',
		example: 'nha-tro-minh-phat-quan-1',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Room type được tạo thành công kèm room instances',
		type: ApiResponseDto<RoomDetailOutputDto>,
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
	): Promise<ApiResponseDto<RoomDetailOutputDto>> {
		const room = await this.roomsService.create(userId, buildingId, createRoomDto);

		return ApiResponseDto.success(room, 'Room created successfully with instances');
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy danh sách rooms của tôi',
		description: 'Lấy danh sách tất cả room types thuộc sở hữu của user hiện tại với phân trang',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		description: 'Số trang (bắt đầu từ 1)',
		example: 1,
		type: Number,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Số lượng items per page',
		example: 10,
		type: Number,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy danh sách rooms thành công',
		schema: {
			example: {
				success: true,
				message: 'My rooms retrieved successfully',
				data: {
					rooms: [
						{
							id: 'uuid-room-1',
							name: 'Phòng VIP',
							roomType: 'boarding_house',
							areaSqm: 25.5,
							totalRooms: 5,
							availableInstancesCount: 3,
							occupiedInstancesCount: 2,
							pricing: {
								basePriceMonthly: 3500000,
								depositAmount: 7000000,
							},
						},
					],
					total: 3,
					page: 1,
					limit: 10,
					totalPages: 1,
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Chưa đăng nhập',
	})
	async findMyRooms(
		@CurrentUser('id') userId: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	): Promise<
		ApiResponseDto<{
			rooms: RoomDetailOutputDto[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		}>
	> {
		const pageNum = page ? parseInt(page, 10) : 1;
		const limitNum = limit ? parseInt(limit, 10) : 10;

		const result = await this.roomsService.findMyRooms(userId, pageNum, limitNum);

		return ApiResponseDto.success(result, 'My rooms retrieved successfully');
	}

	@Get(':roomId')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Lấy thông tin chi tiết room type',
		description:
			'Lấy thông tin chi tiết của room type bao gồm pricing, amenities, costs, rules và room instances',
	})
	@ApiParam({
		name: 'roomId',
		description: 'ID hoặc slug của room type',
		example: '002f0e6c-a2f6-4214-9b9c-90a949cdee58',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy thông tin room type thành công',
		type: ApiResponseDto<RoomDetailOutputDto>,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Room type không tồn tại',
	})
	async findOne(
		@Param('roomId') roomId: string,
		@Req() req: Request,
	): Promise<ApiResponseDto<RoomDetailOutputDto>> {
		const isAuthenticated = Boolean((req as any)?.user);
		const room = await this.roomsService.findOne(roomId, { isAuthenticated });

		return ApiResponseDto.success(room, 'Room retrieved successfully');
	}

	@Get('public/id/:roomId')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get room details by ID (Public API)',
		description:
			'Public endpoint for users to browse room details without authentication. Returns comprehensive room information including pricing, amenities, and availability. Use this endpoint instead of the slug-based endpoint.',
	})
	@ApiParam({
		name: 'roomId',
		description: 'Room ID identifier',
		example: 'uuid-room-id',
	})
	@ApiResponse({
		status: 200,
		description: 'Room details retrieved successfully',
		type: RoomDetailWithMetaResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Room not found',
	})
	async getRoomById(
		@Param('roomId') roomId: string,
		@Req() req: Request,
	): Promise<RoomDetailWithMetaResponseDto> {
		const clientIp =
			req.ip || req.connection?.remoteAddress || (req.headers['x-forwarded-for'] as string);
		const isAuthenticated = Boolean((req as any).user);
		return this.roomsService.getRoomById(roomId, clientIp, { isAuthenticated });
	}

	/**
	 * @deprecated Use GET /rooms/public/id/:roomId instead. This endpoint will be removed in a future version.
	 */
	@Get('public/:slug')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get room details by slug (Public API) - DEPRECATED',
		description:
			'⚠️ **DEPRECATED**: This endpoint is deprecated and will be removed in a future version. Please use GET /rooms/public/id/:roomId instead.\n\n' +
			'Public endpoint for users to browse room details without authentication. Returns comprehensive room information including pricing, amenities, and availability.',
		deprecated: true,
	})
	@ApiParam({
		name: 'slug',
		description: 'Room slug identifier (deprecated - use roomId instead)',
		example: 'nhu-quynhquan-go-vap-phong-ap2653',
	})
	@ApiResponse({
		status: 200,
		description: 'Room details retrieved successfully',
		type: RoomDetailWithMetaResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Room not found',
	})
	async getRoomBySlug(
		@Param('slug') slug: string,
		@Req() req: Request,
	): Promise<RoomDetailWithMetaResponseDto> {
		const clientIp =
			req.ip || req.connection?.remoteAddress || (req.headers['x-forwarded-for'] as string);
		const isAuthenticated = Boolean((req as any).user);
		return this.roomsService.getRoomBySlug(slug, clientIp, { isAuthenticated });
	}

	@Put(':roomId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Cập nhật room type',
		description: `Cập nhật thông tin room type với xử lý đặc biệt:
- **Pricing**: Cập nhật từng field riêng lẻ
- **Amenities**: GHI ĐÈ HOÀN TOÀN danh sách cũ
- **Costs**: GHI ĐÈ HOÀN TOÀN danh sách cũ  
- **Rules**: GHI ĐÈ HOÀN TOÀN danh sách cũ
- **totalRooms**: Chỉ cho phép TĂNG (tự động tạo thêm instances)

⚠️ **LUU Ý**: Khi gửi amenities/costs/rules, hệ thống sẽ XÓA HẾT danh sách cũ và thay thế hoàn toàn bằng danh sách mới. Để giữ nguyên, không gửi field đó.`,
	})
	@ApiParam({
		name: 'roomId',
		description: 'ID của room type',
		example: 'uuid-room-id',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Cập nhật room thành công',
		type: ApiResponseDto<RoomDetailOutputDto>,
		schema: {
			example: {
				success: true,
				message: 'Room updated successfully',
				data: {
					id: 'uuid-room',
					name: 'Phòng VIP Deluxe',
					roomType: 'boarding_house',
					areaSqm: 28.5,
					totalRooms: 8, // Đã tăng từ 5 lên 8
					availableInstancesCount: 8,
					pricing: {
						basePriceMonthly: 3800000, // Đã tăng giá
						depositAmount: 7600000,
					},
					amenities: [
						{
							name: 'Điều hòa',
							customValue: '3 chiếc LG inverter', // Đã thay đổi
						},
						{
							name: 'WiFi',
							customValue: 'Viettel 100Mbps', // Amenity mới
						},
					],
					roomInstances: [
						{ roomNumber: 'A101', status: 'available' },
						{ roomNumber: 'A102', status: 'available' },
						{ roomNumber: 'A103', status: 'available' },
						{ roomNumber: 'A104', status: 'available' },
						{ roomNumber: 'A105', status: 'available' },
						{ roomNumber: 'A106', status: 'available' }, // Instance mới
						{ roomNumber: 'A107', status: 'available' }, // Instance mới
						{ roomNumber: 'A108', status: 'available' }, // Instance mới
					],
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Dữ liệu không hợp lệ hoặc totalRooms < hiện tại',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner có thể cập nhật room',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Room không tồn tại',
	})
	async update(
		@CurrentUser('id') userId: string,
		@Param('roomId') roomId: string,
		@Body() updateRoomDto: UpdateRoomDto,
	): Promise<ApiResponseDto<RoomDetailOutputDto>> {
		const room = await this.roomsService.update(userId, roomId, updateRoomDto);

		return ApiResponseDto.success(room, 'Room updated successfully');
	}

	@Delete(':roomId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xóa room type',
		description: 'Xóa room type và tất cả room instances. Không thể xóa nếu có rental đang active.',
	})
	@ApiParam({
		name: 'roomId',
		description: 'ID của room type',
		example: 'uuid-room-id',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Xóa room thành công',
		schema: {
			example: {
				success: true,
				message: 'Room deleted successfully',
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Không thể xóa room có rental đang active',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner có thể xóa room',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Room không tồn tại',
	})
	async remove(
		@CurrentUser('id') userId: string,
		@Param('roomId') roomId: string,
	): Promise<ApiResponseDto<null>> {
		await this.roomsService.remove(userId, roomId);

		return ApiResponseDto.success(null, 'Room deleted successfully');
	}

	@Get('building/:buildingId/rooms')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy danh sách rooms của building',
		description: 'Lấy danh sách tất cả room types thuộc building với phân trang',
	})
	@ApiParam({
		name: 'buildingId',
		description: 'ID của building (slug)',
		example: 'nha-tro-minh-phat-quan-1',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy danh sách rooms thành công',
		schema: {
			example: {
				success: true,
				message: 'Rooms retrieved successfully',
				data: {
					rooms: [
						{
							id: 'uuid-room-1',
							name: 'Phòng VIP',
							roomType: 'boarding_house',
							areaSqm: 25.5,
							totalRooms: 5,
							availableInstancesCount: 3,
							occupiedInstancesCount: 2,
							pricing: {
								basePriceMonthly: 3500000,
								depositAmount: 7000000,
							},
						},
					],
					total: 3,
					page: 1,
					limit: 10,
					totalPages: 1,
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner có thể xem rooms',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Building không tồn tại',
	})
	async findManyByBuilding(
		@CurrentUser('id') userId: string,
		@Param('buildingId') buildingId: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	): Promise<
		ApiResponseDto<{
			rooms: RoomDetailOutputDto[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		}>
	> {
		const pageNum = page ? parseInt(page, 10) : 1;
		const limitNum = limit ? parseInt(limit, 10) : 10;

		const result = await this.roomsService.findManyByBuilding(
			userId,
			buildingId,
			pageNum,
			limitNum,
		);

		return ApiResponseDto.success(result, 'Rooms retrieved successfully');
	}

	@Put('instance/:roomInstanceId/status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Cập nhật trạng thái của 1 room instance',
		description: `Cập nhật trạng thái của room instance riêng lẻ với business logic validation:

**Các trạng thái có sẵn:**
- \`available\`: Phòng trống, sẵn sàng cho thuê
- \`occupied\`: Phòng đã có người ở  
- \`maintenance\`: Phòng đang sửa chữa/bảo trì
- \`reserved\`: Phòng đã được đặt cọc nhưng chưa vào ở
- \`unavailable\`: Phòng tạm thời không cho thuê

**Business Rules:**
- \`occupied\`: Chỉ từ \`available\` hoặc \`reserved\`
- \`available\`: Không được có rental đang active
- \`maintenance\`: Nếu \`occupied\` + có rental thì cần relocate trước
- \`reserved\`: Chỉ từ \`available\`
- \`unavailable\`: Luôn được phép (có warning nếu có rental)`,
	})
	@ApiParam({
		name: 'roomInstanceId',
		description: 'ID của room instance',
		example: 'uuid-instance-id',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Cập nhật trạng thái thành công',
		schema: {
			example: {
				success: true,
				message: 'Room instance status updated successfully',
				data: {
					success: true,
					message: 'Room instance status updated to maintenance',
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Chuyển trạng thái không hợp lệ hoặc vi phạm business rules',
		schema: {
			example: {
				success: false,
				message: 'Cannot change status from occupied to available while there are active rentals',
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner có thể cập nhật trạng thái',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Room instance không tồn tại',
	})
	async updateRoomInstanceStatus(
		@CurrentUser('id') userId: string,
		@Param('roomInstanceId') roomInstanceId: string,
		@Body() updateStatusDto: UpdateRoomInstanceStatusDto,
	): Promise<ApiResponseDto<{ success: boolean; message: string }>> {
		const result = await this.roomsService.updateRoomInstanceStatus(
			userId,
			roomInstanceId,
			updateStatusDto,
		);

		return ApiResponseDto.success(result, 'Room instance status updated successfully');
	}

	@Put(':roomId/instances/status/bulk')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Cập nhật trạng thái nhiều room instances cùng lúc',
		description: `Cập nhật trạng thái cho nhiều room instances thuộc cùng 1 room type với validation business logic cho từng instance.

**Ưu điểm:**
- Tiết kiệm thời gian khi cần update hàng loạt
- Atomic operation - tất cả thành công hoặc tất cả thất bại
- Validation riêng biệt cho từng instance

**Use Cases:**
- Bảo trì định kỳ cả tầng/toà nhà
- Chuyển đổi trạng thái hàng loạt sau khi hoàn thành sửa chữa
- Đặt nhiều phòng về unavailable tạm thời`,
	})
	@ApiParam({
		name: 'roomId',
		description: 'ID của room type',
		example: 'uuid-room-id',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Cập nhật trạng thái hàng loạt thành công',
		schema: {
			example: {
				success: true,
				message: 'Bulk room instance status update completed',
				data: {
					success: true,
					message: '3 room instances updated to maintenance',
					updatedCount: 3,
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Một số instances không thuộc room này hoặc vi phạm business rules',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner có thể cập nhật trạng thái',
	})
	async bulkUpdateRoomInstanceStatus(
		@CurrentUser('id') userId: string,
		@Param('roomId') roomId: string,
		@Body() bulkUpdateDto: BulkUpdateRoomInstanceStatusDto,
	): Promise<ApiResponseDto<{ success: boolean; message: string; updatedCount: number }>> {
		const result = await this.roomsService.bulkUpdateRoomInstanceStatus(
			userId,
			roomId,
			bulkUpdateDto,
		);

		return ApiResponseDto.success(result, 'Bulk room instance status update completed');
	}

	@Get(':roomId/instances/status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy danh sách room instances theo trạng thái',
		description: `Lấy danh sách room instances với filter theo status và thống kê số lượng từng trạng thái.

**Response bao gồm:**
- Danh sách instances (có thể filter theo status)
- Thống kê số lượng từng trạng thái
- Lý do thay đổi status và thời gian cập nhật

**Useful for:**
- Dashboard quản lý phòng
- Báo cáo tình trạng phòng
- Monitoring và analytics`,
	})
	@ApiParam({
		name: 'roomId',
		description: 'ID của room type',
		example: 'uuid-room-id',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy danh sách instances thành công',
		schema: {
			example: {
				success: true,
				message: 'Room instances retrieved successfully',
				data: {
					instances: [
						{
							id: 'uuid-instance-1',
							roomNumber: 'A101',
							status: 'occupied',
							notes: null,
							updatedAt: '2025-01-01T00:00:00.000Z',
							isActive: true,
						},
						{
							id: 'uuid-instance-2',
							roomNumber: 'A102',
							status: 'maintenance',
							notes: 'Sửa chữa điều hòa và sơn lại tường',
							updatedAt: '2025-01-01T10:30:00.000Z',
							isActive: true,
						},
						{
							id: 'uuid-instance-3',
							roomNumber: 'A103',
							status: 'available',
							notes: null,
							updatedAt: '2025-01-01T08:15:00.000Z',
							isActive: true,
						},
					],
					statusCounts: {
						available: 1,
						occupied: 1,
						maintenance: 1,
						reserved: 0,
						unavailable: 0,
					},
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner có thể xem room instances',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Room không tồn tại',
	})
	async getRoomInstancesByStatus(
		@CurrentUser('id') userId: string,
		@Param('roomId') roomId: string,
		@Query('status') status?: string,
	): Promise<
		ApiResponseDto<{
			instances: Array<{
				id: string;
				roomNumber: string;
				status: string;
				notes?: string;
				updatedAt: Date;
				isActive: boolean;
			}>;
			statusCounts: Record<string, number>;
		}>
	> {
		const result = await this.roomsService.getRoomInstancesByStatus(userId, roomId, status);

		return ApiResponseDto.success(result, 'Room instances retrieved successfully');
	}
}
