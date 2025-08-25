import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { SearchPostStatus, User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateRoomRequestDto, RoomRequestResponseDto, UpdateRoomRequestDto } from './dto';
import { RoomRequestService } from './room-seeking-post.service';

@ApiTags('Room Requests')
@Controller('room-requests')
export class RoomRequestController {
	constructor(private readonly roomRequestService: RoomRequestService) {}

	@Post()
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tạo bài đăng tìm trọ mới' })
	@ApiResponse({
		status: 201,
		description: 'Tạo bài đăng thành công',
		type: RoomRequestResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async create(
		@Body() createRoomRequestDto: CreateRoomRequestDto,
		@CurrentUser() user: User,
	): Promise<RoomRequestResponseDto> {
		return this.roomRequestService.create(createRoomRequestDto, user.id);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Lấy chi tiết bài đăng tìm trọ' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết thành công',
		type: RoomRequestResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async findOne(@Param('id') id: string): Promise<RoomRequestResponseDto> {
		return this.roomRequestService.findOne(id);
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật bài đăng tìm trọ' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({
		status: 200,
		description: 'Cập nhật thành công',
		type: RoomRequestResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async update(
		@Param('id') id: string,
		@Body() updateRoomRequestDto: UpdateRoomRequestDto,
		@CurrentUser() user: User,
	): Promise<RoomRequestResponseDto> {
		return this.roomRequestService.update(id, updateRoomRequestDto, user.id);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xóa bài đăng tìm trọ' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({ status: 204, description: 'Xóa thành công' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền xóa' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	@HttpCode(HttpStatus.NO_CONTENT)
	async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
		return this.roomRequestService.remove(id, user.id);
	}

	@Patch(':id/status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật trạng thái bài đăng' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({
		status: 200,
		description: 'Cập nhật trạng thái thành công',
		type: RoomRequestResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Trạng thái không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền thay đổi trạng thái' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async updateStatus(
		@Param('id') id: string,
		@Body('status') status: SearchPostStatus,
		@CurrentUser() user: User,
	): Promise<RoomRequestResponseDto> {
		return this.roomRequestService.updateStatus(id, status, user.id);
	}

	@Post(':id/contact')
	@ApiOperation({ summary: 'Tăng số lượt liên hệ cho bài đăng' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({ status: 200, description: 'Tăng lượt liên hệ thành công' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	@HttpCode(HttpStatus.OK)
	async incrementContactCount(@Param('id') id: string): Promise<void> {
		return this.roomRequestService.incrementContactCount(id);
	}

	@Get('admin/test')
	@ApiOperation({ summary: 'Test endpoint cho admin' })
	@ApiResponse({ status: 200, description: 'Test thành công' })
	async test() {
		return { message: 'Room Request API is working!' };
	}
}
