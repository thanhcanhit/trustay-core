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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
		summary: 'Phản hồi đơn ứng tuyển',
		description: 'Tenant hoặc landlord phản hồi (phê duyệt/từ chối) đơn ứng tuyển',
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

	@Patch(':id/confirm')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xác nhận đơn ứng tuyển',
		description:
			'Tenant hoặc landlord xác nhận đơn ứng tuyển. Sau khi cả 2 xác nhận, rental sẽ được tạo tự động.',
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
