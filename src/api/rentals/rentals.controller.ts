import {
	Body,
	Controller,
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
	CreateRentalDto,
	PaginatedRentalResponseDto,
	QueryRentalDto,
	RentalResponseDto,
	TerminateRentalDto,
	UpdateRentalDto,
} from './dto';
import { RentalsService } from './rentals.service';

@ApiTags('Rentals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rentals')
export class RentalsController {
	constructor(private readonly rentalsService: RentalsService) {}

	@ApiOperation({
		summary: 'Tạo rental mới (chỉ landlord)',
		description: 'Tạo rental từ booking request hoặc invitation đã được chấp nhận',
	})
	@ApiResponse({
		status: 201,
		description: 'Tạo rental thành công',
		type: RentalResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu không hợp lệ hoặc room instance đã có rental active',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ landlord mới có thể tạo rental',
	})
	@ApiResponse({
		status: 404,
		description: 'Tenant, room instance, booking request hoặc invitation không tồn tại',
	})
	@Roles(UserRole.landlord)
	@Post()
	async createRental(
		@CurrentUser('id') ownerId: string,
		@Body() createRentalDto: CreateRentalDto,
	): Promise<RentalResponseDto> {
		return await this.rentalsService.createRental(ownerId, createRentalDto);
	}

	@ApiOperation({
		summary: 'Lấy danh sách rental của landlord',
		description: 'Lấy tất cả rental mà landlord sở hữu với phân trang và lọc',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách rental thành công',
		type: PaginatedRentalResponseDto,
	})
	@Roles(UserRole.landlord)
	@Get('owner')
	async getRentalsForOwner(
		@CurrentUser('id') ownerId: string,
		@Query() query: QueryRentalDto,
	): Promise<PaginatedRentalResponseDto> {
		return await this.rentalsService.getRentalsForOwner(ownerId, query);
	}

	@ApiOperation({
		summary: 'Lấy danh sách rental của tenant',
		description: 'Lấy tất cả rental mà tenant đang thuê với phân trang và lọc',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách rental thành công',
		type: PaginatedRentalResponseDto,
	})
	@Roles(UserRole.tenant)
	@Get('my-rentals')
	async getMyRentals(
		@CurrentUser('id') tenantId: string,
		@Query() query: QueryRentalDto,
	): Promise<PaginatedRentalResponseDto> {
		return await this.rentalsService.getMyRentals(tenantId, query);
	}

	@ApiOperation({
		summary: 'Lấy chi tiết rental theo ID',
		description: 'Lấy thông tin chi tiết một rental (chỉ owner hoặc tenant mới xem được)',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của rental',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết rental thành công',
		type: RentalResponseDto,
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền truy cập rental này',
	})
	@ApiResponse({
		status: 404,
		description: 'Rental không tồn tại',
	})
	@Get(':id')
	async getRentalById(
		@Param('id', ParseUUIDPipe) rentalId: string,
		@CurrentUser('id') userId: string,
	): Promise<RentalResponseDto> {
		return await this.rentalsService.getRentalById(rentalId, userId);
	}

	@ApiOperation({
		summary: 'Cập nhật rental (chỉ landlord)',
		description: 'Cập nhật thông tin rental như ngày kết thúc, trạng thái, document',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của rental',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Cập nhật rental thành công',
		type: RentalResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu không hợp lệ',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ owner mới có thể cập nhật rental',
	})
	@ApiResponse({
		status: 404,
		description: 'Rental không tồn tại',
	})
	@Roles(UserRole.landlord)
	@Put(':id')
	async updateRental(
		@Param('id', ParseUUIDPipe) rentalId: string,
		@CurrentUser('id') ownerId: string,
		@Body() updateRentalDto: UpdateRentalDto,
	): Promise<RentalResponseDto> {
		return await this.rentalsService.updateRental(rentalId, ownerId, updateRentalDto);
	}

	@ApiOperation({
		summary: 'Chấm dứt rental (chỉ landlord)',
		description: 'Chấm dứt rental và cập nhật trạng thái room instance',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của rental',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Chấm dứt rental thành công',
		type: RentalResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Rental đã bị chấm dứt hoặc dữ liệu không hợp lệ',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ owner mới có thể chấm dứt rental',
	})
	@ApiResponse({
		status: 404,
		description: 'Rental không tồn tại',
	})
	@Roles(UserRole.landlord)
	@Put(':id/terminate')
	async terminateRental(
		@Param('id', ParseUUIDPipe) rentalId: string,
		@CurrentUser('id') ownerId: string,
		@Body() terminateRentalDto: TerminateRentalDto,
	): Promise<RentalResponseDto> {
		return await this.rentalsService.terminateRental(rentalId, ownerId, terminateRentalDto);
	}

	@ApiOperation({
		summary: 'Gia hạn rental (chỉ tenant)',
		description: 'Tenant yêu cầu gia hạn rental với ngày kết thúc mới',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của rental',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Yêu cầu gia hạn rental thành công',
		type: RentalResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Ngày gia hạn không hợp lệ hoặc rental không thể gia hạn',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ tenant mới có thể yêu cầu gia hạn',
	})
	@ApiResponse({
		status: 404,
		description: 'Rental không tồn tại',
	})
	@Roles(UserRole.tenant)
	@Put(':id/renew')
	async renewRental(
		@Param('id', ParseUUIDPipe) rentalId: string,
		@CurrentUser('id') tenantId: string,
		@Body('newEndDate') newEndDate: string,
	): Promise<RentalResponseDto> {
		return await this.rentalsService.renewRental(rentalId, tenantId, newEndDate);
	}
}
