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
	Request,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
	CreateNotificationDto,
	NotificationCountResponseDto,
	NotificationResponseDto,
	PaginatedNotificationResponseDto,
	QueryNotificationsDto,
} from './dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
	constructor(private readonly notificationsService: NotificationsService) {}

	@Post()
	@ApiOperation({ summary: 'Tạo thông báo mới (System use only)' })
	@ApiResponse({
		status: 201,
		description: 'Thông báo được tạo thành công',
		type: NotificationResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 404, description: 'User không tồn tại' })
	async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
		return this.notificationsService.createNotification(createNotificationDto);
	}

	@Get()
	@ApiOperation({ summary: 'Lấy danh sách thông báo của user hiện tại' })
	@ApiResponse({
		status: 200,
		description: 'Danh sách thông báo với phân trang',
		type: PaginatedNotificationResponseDto,
	})
	@ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (default: 1)' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Số items per page (default: 20, max: 100)',
	})
	@ApiQuery({
		name: 'isRead',
		required: false,
		type: Boolean,
		description: 'Lọc theo trạng thái đã đọc',
	})
	@ApiQuery({
		name: 'notificationType',
		required: false,
		type: String,
		description: 'Lọc theo loại thông báo',
	})
	async getUserNotifications(@Request() req, @Query() query: QueryNotificationsDto) {
		return this.notificationsService.getUserNotifications(req.user.userId, query);
	}

	@Patch(':id/read')
	@ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
	@ApiParam({ name: 'id', description: 'ID của thông báo' })
	@ApiResponse({
		status: 200,
		description: 'Thông báo đã được đánh dấu là đã đọc',
		type: NotificationResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Thông báo không tồn tại' })
	@ApiResponse({ status: 403, description: 'Không có quyền truy cập thông báo này' })
	async markAsRead(@Param('id') id: string, @Request() req) {
		return this.notificationsService.markAsRead(id, req.user.userId);
	}

	@Patch('mark-all-read')
	@ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
	@ApiResponse({
		status: 200,
		description: 'Tất cả thông báo đã được đánh dấu là đã đọc',
	})
	@HttpCode(HttpStatus.OK)
	async markAllAsRead(@Request() req) {
		return this.notificationsService.markAllAsRead(req.user.userId);
	}

	@Delete(':id')
	@ApiOperation({ summary: 'Xóa thông báo' })
	@ApiParam({ name: 'id', description: 'ID của thông báo' })
	@ApiResponse({
		status: 200,
		description: 'Thông báo đã được xóa thành công',
	})
	@ApiResponse({ status: 404, description: 'Thông báo không tồn tại' })
	@ApiResponse({ status: 403, description: 'Không có quyền xóa thông báo này' })
	async deleteNotification(@Param('id') id: string, @Request() req) {
		return this.notificationsService.deleteNotification(id, req.user.userId);
	}

	@Get('count')
	@ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
	@ApiResponse({
		status: 200,
		description: 'Số lượng thông báo chưa đọc',
		type: NotificationCountResponseDto,
	})
	async getUnreadCount(@Request() req) {
		return this.notificationsService.getUnreadCount(req.user.userId);
	}
}
