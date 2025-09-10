import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
	CreatePaymentDto,
	PaginatedPaymentResponseDto,
	PaymentResponseDto,
	QueryPaymentDto,
	UpdatePaymentDto,
} from './dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
	constructor(private readonly paymentsService: PaymentsService) {}

	@ApiOperation({
		summary: 'Tạo thanh toán mới',
		description: 'Tạo thanh toán cho rental (tenant hoặc landlord có thể tạo)',
	})
	@ApiResponse({
		status: 201,
		description: 'Tạo thanh toán thành công',
		type: PaymentResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu không hợp lệ',
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền tạo thanh toán cho rental này',
	})
	@ApiResponse({
		status: 404,
		description: 'Rental hoặc monthly bill không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Post()
	async createPayment(
		@CurrentUser('id') payerId: string,
		@Body() createPaymentDto: CreatePaymentDto,
	): Promise<PaymentResponseDto> {
		return await this.paymentsService.createPayment(payerId, createPaymentDto);
	}

	@ApiOperation({
		summary: 'Lấy danh sách thanh toán',
		description: 'Lấy tất cả thanh toán của user hiện tại với phân trang và lọc',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách thanh toán thành công',
		type: PaginatedPaymentResponseDto,
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Get()
	async getPayments(
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
		@Query() query: QueryPaymentDto,
	): Promise<PaginatedPaymentResponseDto> {
		return await this.paymentsService.getPayments(userId, userRole, query);
	}

	@ApiOperation({
		summary: 'Lấy lịch sử thanh toán',
		description: 'Alias endpoint cho việc lấy danh sách thanh toán (cho tenant)',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy lịch sử thanh toán thành công',
		type: PaginatedPaymentResponseDto,
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Get('history')
	async getPaymentHistory(
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
		@Query() query: QueryPaymentDto,
	): Promise<PaginatedPaymentResponseDto> {
		return await this.paymentsService.getPayments(userId, userRole, query);
	}

	@ApiOperation({
		summary: 'Lấy chi tiết thanh toán theo ID',
		description: 'Lấy thông tin chi tiết một thanh toán',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của thanh toán',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết thanh toán thành công',
		type: PaymentResponseDto,
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền xem thanh toán này',
	})
	@ApiResponse({
		status: 404,
		description: 'Thanh toán không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Get(':id')
	async getPaymentById(
		@Param('id', ParseUUIDPipe) paymentId: string,
		@CurrentUser('id') userId: string,
	): Promise<PaymentResponseDto> {
		return await this.paymentsService.getPaymentById(paymentId, userId);
	}

	@ApiOperation({
		summary: 'Cập nhật thanh toán',
		description: 'Cập nhật thông tin thanh toán như trạng thái, ngày thanh toán, etc.',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của thanh toán',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Cập nhật thanh toán thành công',
		type: PaymentResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu không hợp lệ',
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền cập nhật thanh toán này',
	})
	@ApiResponse({
		status: 404,
		description: 'Thanh toán không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Put(':id')
	async updatePayment(
		@Param('id', ParseUUIDPipe) paymentId: string,
		@CurrentUser('id') userId: string,
		@Body() updatePaymentDto: UpdatePaymentDto,
	): Promise<PaymentResponseDto> {
		return await this.paymentsService.updatePayment(paymentId, userId, updatePaymentDto);
	}

	@ApiOperation({
		summary: 'Xóa thanh toán',
		description: 'Xóa thanh toán (chỉ những thanh toán chưa hoàn thành)',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của thanh toán',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Xóa thanh toán thành công',
	})
	@ApiResponse({
		status: 400,
		description: 'Không thể xóa thanh toán đã hoàn thành',
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền xóa thanh toán này',
	})
	@ApiResponse({
		status: 404,
		description: 'Thanh toán không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Delete(':id')
	async deletePayment(
		@Param('id', ParseUUIDPipe) paymentId: string,
		@CurrentUser('id') userId: string,
	): Promise<void> {
		return await this.paymentsService.deletePayment(paymentId, userId);
	}
}
