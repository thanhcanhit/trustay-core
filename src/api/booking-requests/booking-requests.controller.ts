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
import { BookingRequestsService } from './booking-requests.service';
import {
	BookingRequestResponseDto,
	CancelBookingRequestDto,
	CreateBookingRequestDto,
	PaginatedBookingRequestResponseDto,
	QueryBookingRequestsDto,
	UpdateBookingRequestDto,
} from './dto';

@ApiTags('booking-requests')
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
	@ApiResponse({ status: 404, description: 'Room instance không tồn tại' })
	async createBookingRequest(
		@Body() createBookingRequestDto: CreateBookingRequestDto,
		@Request() req,
	) {
		return this.bookingRequestsService.createBookingRequest(
			req.user.userId,
			createBookingRequestDto,
		);
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
	async getReceivedBookingRequests(@Query() query: QueryBookingRequestsDto, @Request() req) {
		return this.bookingRequestsService.getBookingRequestsForLandlord(req.user.userId, query);
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
	async getMyBookingRequests(@Query() query: QueryBookingRequestsDto, @Request() req) {
		return this.bookingRequestsService.getMyBookingRequests(req.user.userId, query);
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
	async getBookingRequestById(@Param('id') id: string, @Request() req) {
		return this.bookingRequestsService.getBookingRequestById(id, req.user.userId);
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
		@Request() req,
	) {
		return this.bookingRequestsService.updateBookingRequest(
			id,
			req.user.userId,
			updateBookingRequestDto,
		);
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
		@Request() req,
	) {
		return this.bookingRequestsService.cancelBookingRequest(
			id,
			req.user.userId,
			cancelBookingRequestDto,
		);
	}
}
