import {
	Body,
	Controller,
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BookingRequestsService } from './booking-requests.service';
import {
	BookingRequestResponseDto,
	CancelBookingRequestDto,
	CreateBookingRequestDto,
	PaginatedBookingRequestResponseDto,
	QueryBookingRequestsDto,
	UpdateBookingRequestDto,
} from './dto';

@ApiTags('Booking Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('booking-requests')
export class BookingRequestsController {
	constructor(private readonly bookingRequestsService: BookingRequestsService) {}

	@Post()
	@ApiOperation({ summary: 'Tạo yêu cầu booking mới (Tenant only)' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Booking request được tạo thành công',
		type: BookingRequestResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 403, description: 'Chỉ tenant mới có thể tạo booking request' })
	@ApiResponse({ status: 404, description: 'Room không tồn tại' })
	async createBookingRequest(
		@Body() createBookingRequestDto: CreateBookingRequestDto,
		@CurrentUser('id') userId: string,
	) {
		return this.bookingRequestsService.createBookingRequest(userId, createBookingRequestDto);
	}

	@Get('received')
	@ApiOperation({ summary: 'Lấy booking requests đã nhận (Landlord only)' })
	@ApiResponse({
		status: 200,
		description: 'Danh sách booking requests cho landlord',
		type: PaginatedBookingRequestResponseDto,
	})
	@ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (default: 1)' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Số items per page (default: 20, max: 100)',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: ['pending', 'approved', 'rejected', 'cancelled'],
		description: 'Lọc theo trạng thái',
	})
	@ApiQuery({
		name: 'buildingId',
		required: false,
		type: String,
		description: 'Lọc theo building ID',
	})
	@ApiQuery({ name: 'roomId', required: false, type: String, description: 'Lọc theo room ID' })
	async getReceivedBookingRequests(
		@Query() query: QueryBookingRequestsDto,
		@CurrentUser('id') userId: string,
	) {
		return this.bookingRequestsService.getBookingRequestsForLandlord(userId, query);
	}

	@Get('me')
	@ApiOperation({
		summary: 'Lấy booking requests của tôi',
		description:
			'Tự động hiển thị booking requests đã nhận (landlord) hoặc đã tạo (tenant) dựa trên role',
	})
	@ApiResponse({
		status: 200,
		description: 'Danh sách booking requests của user',
		type: PaginatedBookingRequestResponseDto,
	})
	@ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (default: 1)' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Số items per page (default: 20, max: 100)',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: ['pending', 'approved', 'rejected', 'cancelled'],
		description: 'Lọc theo trạng thái',
	})
	@ApiQuery({
		name: 'buildingId',
		required: false,
		type: String,
		description: 'Lọc theo building ID (chỉ áp dụng cho landlord)',
	})
	@ApiQuery({
		name: 'roomId',
		required: false,
		type: String,
		description: 'Lọc theo room ID (chỉ áp dụng cho landlord)',
	})
	async getMyBookingRequests(
		@Query() query: QueryBookingRequestsDto,
		@CurrentUser('id') userId: string,
	) {
		return this.bookingRequestsService.getMyBookingRequests(userId, query);
	}

	@Get('my-requests')
	@ApiOperation({ summary: 'Lấy booking requests của tôi (Tenant only)' })
	@ApiResponse({
		status: 200,
		description: 'Danh sách booking requests của tenant',
		type: PaginatedBookingRequestResponseDto,
	})
	@ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (default: 1)' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Số items per page (default: 20, max: 100)',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: ['pending', 'approved', 'rejected', 'cancelled'],
		description: 'Lọc theo trạng thái',
	})
	async getMyBookingRequestsAsTenant(
		@Query() query: QueryBookingRequestsDto,
		@CurrentUser('id') userId: string,
	) {
		return this.bookingRequestsService.getMyBookingRequestsAsTenant(userId, query);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Lấy chi tiết booking request' })
	@ApiParam({ name: 'id', description: 'Booking request ID' })
	@ApiResponse({
		status: 200,
		description: 'Chi tiết booking request',
		type: BookingRequestResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Booking request không tồn tại' })
	@ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
	async getBookingRequestById(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.bookingRequestsService.getBookingRequestById(id, userId);
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Cập nhật booking request (Landlord only)' })
	@ApiParam({ name: 'id', description: 'Booking request ID' })
	@ApiResponse({
		status: 200,
		description: 'Booking request được cập nhật thành công',
		type: BookingRequestResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Booking request không tồn tại' })
	@ApiResponse({ status: 403, description: 'Chỉ landlord mới có thể cập nhật' })
	@ApiResponse({ status: 400, description: 'Không thể cập nhật booking request này' })
	async updateBookingRequest(
		@Param('id') id: string,
		@Body() updateBookingRequestDto: UpdateBookingRequestDto,
		@CurrentUser('id') userId: string,
	) {
		return this.bookingRequestsService.updateBookingRequest(id, userId, updateBookingRequestDto);
	}

	@Post(':id/confirm')
	@ApiOperation({
		summary: 'Xác nhận booking request sau khi landlord approve (Tenant only)',
		description: 'Sau khi landlord approve, tenant confirm để tự động tạo rental',
	})
	@ApiParam({ name: 'id', description: 'Booking request ID' })
	@ApiResponse({
		status: 200,
		description: 'Xác nhận thành công, tự động tạo rental',
		type: BookingRequestResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Booking request không tồn tại' })
	@ApiResponse({ status: 403, description: 'Chỉ tenant mới có thể confirm' })
	@ApiResponse({
		status: 400,
		description: 'Booking chưa được approve hoặc đã confirmed rồi',
	})
	@HttpCode(HttpStatus.OK)
	async confirmBookingRequest(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.bookingRequestsService.confirmBookingRequest(id, userId);
	}

	@Patch(':id/cancel')
	@ApiOperation({ summary: 'Hủy booking request (Tenant only)' })
	@ApiParam({ name: 'id', description: 'Booking request ID' })
	@ApiResponse({
		status: 200,
		description: 'Booking request được hủy thành công',
		type: BookingRequestResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Booking request không tồn tại' })
	@ApiResponse({ status: 403, description: 'Chỉ tenant mới có thể hủy booking của mình' })
	@ApiResponse({ status: 400, description: 'Booking request đã bị hủy' })
	@HttpCode(HttpStatus.OK)
	async cancelBookingRequest(
		@Param('id') id: string,
		@Body() cancelBookingRequestDto: CancelBookingRequestDto,
		@CurrentUser('id') userId: string,
	) {
		return this.bookingRequestsService.cancelBookingRequest(id, userId, cancelBookingRequestDto);
	}
}
