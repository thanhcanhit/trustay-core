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
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
	ApplicationStatisticsDto,
	BulkRespondApplicationsDto,
	BulkResponseResultDto,
	CreateRoommateApplicationDto,
	QueryRoommateApplicationDto,
	RespondToApplicationDto,
	RoommateApplicationResponseDto,
	UpdateRoommateApplicationDto,
} from './dto';
import { RoommateApplicationService } from './roommate-application.service';

@ApiTags('Roommate Applications')
@Controller('roommate-applications')
export class RoommateApplicationController {
	constructor(private readonly roommateApplicationService: RoommateApplicationService) {}

	@Post()
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Ứng tuyển vào bài đăng tìm người ở ghép' })
	@ApiResponse({
		status: 201,
		description: 'Ứng tuyển thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc không thể ứng tuyển' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async create(
		@Body() createDto: CreateRoommateApplicationDto,
		@CurrentUser() user: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.create(createDto, user.id);
	}

	@Get('my-applications')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy danh sách đơn ứng tuyển của tôi',
		description: 'Lấy danh sách các đơn ứng tuyển do user hiện tại tạo ra',
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
		enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'],
		description: 'Lọc theo trạng thái',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách thành công',
		type: PaginatedResponseDto<RoommateApplicationResponseDto>,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async findMyApplications(
		@Query() query: QueryRoommateApplicationDto,
		@CurrentUser() user: User,
	): Promise<PaginatedResponseDto<RoommateApplicationResponseDto>> {
		return this.roommateApplicationService.findMyApplications(query, user.id);
	}

	@Get('for-my-posts')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy danh sách đơn ứng tuyển cho bài đăng của tôi',
		description: 'Lấy danh sách các đơn ứng tuyển vào các bài đăng do user hiện tại tạo ra',
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
		enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'],
		description: 'Lọc theo trạng thái',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách thành công',
		type: PaginatedResponseDto<RoommateApplicationResponseDto>,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async findApplicationsForMyPosts(
		@Query() query: QueryRoommateApplicationDto,
		@CurrentUser() user: User,
	): Promise<PaginatedResponseDto<RoommateApplicationResponseDto>> {
		return this.roommateApplicationService.findApplicationsForMyPosts(query, user.id);
	}

	@Get('landlord/pending')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Landlord xem các đơn ứng tuyển cần duyệt',
		description: 'Lấy danh sách các đơn ứng tuyển từ platform rooms thuộc landlord cần duyệt',
	})
	@ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (default: 1)' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Số items per page (default: 10, max: 100)',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'],
		description: 'Lọc theo trạng thái (default: accepted)',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách thành công',
		type: PaginatedResponseDto<RoommateApplicationResponseDto>,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async findApplicationsForLandlord(
		@Query() query: QueryRoommateApplicationDto,
		@CurrentUser() user: User,
	): Promise<PaginatedResponseDto<RoommateApplicationResponseDto>> {
		return this.roommateApplicationService.findApplicationsForLandlord(query, user.id);
	}

	@Get(':id')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({ summary: 'Lấy chi tiết đơn ứng tuyển' })
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({ status: 403, description: 'Không có quyền xem' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	async findOne(
		@Param('id') id: string,
		@CurrentUser() user?: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.findOne(id, user?.id);
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật đơn ứng tuyển' })
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({
		status: 200,
		description: 'Cập nhật thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	async update(
		@Param('id') id: string,
		@Body() updateDto: UpdateRoommateApplicationDto,
		@CurrentUser() user: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.update(id, updateDto, user.id);
	}

	@Patch(':id/respond')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Tenant phản hồi đơn ứng tuyển',
		description:
			'Tenant phản hồi (phê duyệt/từ chối) đơn ứng tuyển. Platform room: sau khi tenant approve, landlord sẽ nhận thông báo. External room: sau khi tenant approve, applicant có thể confirm.',
	})
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({
		status: 200,
		description: 'Phản hồi thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Trạng thái không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền phản hồi' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	async respondToApplication(
		@Param('id') id: string,
		@Body() respondDto: RespondToApplicationDto,
		@CurrentUser() user: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.respondToApplication(id, respondDto, user.id);
	}

	@Post(':id/landlord-approve')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Landlord phê duyệt đơn ứng tuyển',
		description:
			'Landlord phê duyệt đơn ứng tuyển đã được tenant phê duyệt. Chỉ áp dụng cho platform rooms.',
	})
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({
		status: 200,
		description: 'Phê duyệt thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Trạng thái không hợp lệ hoặc không phải platform room',
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền phê duyệt' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	async landlordApproveApplication(
		@Param('id') id: string,
		@Body() respondDto: RespondToApplicationDto,
		@CurrentUser() user: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.landlordApproveApplication(id, respondDto, user.id);
	}

	@Post(':id/landlord-reject')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Landlord từ chối đơn ứng tuyển',
		description:
			'Landlord từ chối đơn ứng tuyển đã được tenant phê duyệt. Chỉ áp dụng cho platform rooms.',
	})
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({
		status: 200,
		description: 'Từ chối thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Trạng thái không hợp lệ hoặc không phải platform room',
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền từ chối' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	async landlordRejectApplication(
		@Param('id') id: string,
		@Body() respondDto: RespondToApplicationDto,
		@CurrentUser() user: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.landlordRejectApplication(id, respondDto, user.id);
	}

	@Patch(':id/confirm')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Applicant xác nhận đơn ứng tuyển',
		description:
			'Applicant xác nhận đơn ứng tuyển cuối cùng. Sau khi xác nhận, rental sẽ được tạo tự động. Platform room: sau khi tenant và landlord đã approve. External room: sau khi tenant đã approve.',
	})
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({
		status: 200,
		description: 'Xác nhận thành công',
		type: RoommateApplicationResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Không thể xác nhận đơn ứng tuyển' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền xác nhận' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	async confirmApplication(
		@Param('id') id: string,
		@CurrentUser() user: User,
	): Promise<RoommateApplicationResponseDto> {
		return this.roommateApplicationService.confirmApplication(id, user.id);
	}

	@Patch(':id/cancel')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Hủy đơn ứng tuyển' })
	@ApiParam({ name: 'id', description: 'ID của đơn ứng tuyển' })
	@ApiResponse({ status: 204, description: 'Hủy thành công' })
	@ApiResponse({ status: 400, description: 'Không thể hủy đơn ứng tuyển' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền hủy' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy đơn ứng tuyển' })
	@HttpCode(HttpStatus.NO_CONTENT)
	async cancel(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
		return this.roommateApplicationService.cancel(id, user.id);
	}

	@Post('bulk-respond')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xử lý hàng loạt đơn ứng tuyển',
		description: 'Phê duyệt hoặc từ chối nhiều đơn ứng tuyển cùng lúc',
	})
	@ApiResponse({
		status: 200,
		description: 'Xử lý thành công',
		type: BulkResponseResultDto,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền xử lý' })
	async bulkRespondToApplications(
		@Body() bulkDto: BulkRespondApplicationsDto,
		@CurrentUser() user: User,
	): Promise<BulkResponseResultDto> {
		return this.roommateApplicationService.bulkRespondToApplications(bulkDto, user.id);
	}

	@Get('statistics/my-applications')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Thống kê đơn ứng tuyển của tôi',
		description: 'Lấy thống kê các đơn ứng tuyển do user hiện tại tạo ra',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy thống kê thành công',
		type: ApplicationStatisticsDto,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async getMyApplicationStatistics(@CurrentUser() user: User): Promise<ApplicationStatisticsDto> {
		return this.roommateApplicationService.getApplicationStatistics(user.id, false);
	}

	@Get('statistics/for-my-posts')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Thống kê đơn ứng tuyển cho bài đăng của tôi',
		description: 'Lấy thống kê các đơn ứng tuyển vào bài đăng do user hiện tại tạo ra',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy thống kê thành công',
		type: ApplicationStatisticsDto,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async getApplicationStatisticsForMyPosts(
		@CurrentUser() user: User,
	): Promise<ApplicationStatisticsDto> {
		return this.roommateApplicationService.getApplicationStatistics(user.id, true);
	}
}
