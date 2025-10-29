import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BillsService } from './bills.service';
import {
	BillResponseDto,
	BuildingBillPreviewDto,
	CreateBillDto,
	CreateBillForRoomDto,
	MeterDataDto,
	PaginatedBillResponseDto,
	PreviewBuildingBillDto,
	QueryBillDto,
	UpdateBillDto,
	UpdateBillWithMeterDataDto,
} from './dto';

@ApiTags('Bills')

// preview => list table => building , list meter coset =>  [dien, nuoc, ]

@Controller('bills')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillsController {
	constructor(private readonly billsService: BillsService) {}

	@Post()
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Tạo hóa đơn mới' })
	@ApiResponse({
		status: 201,
		description: 'Hóa đơn được tạo thành công',
		type: BillResponseDto,
	})
	async createBill(
		@CurrentUser('id') userId: string,
		@Body() createBillDto: CreateBillDto,
	): Promise<BillResponseDto> {
		return this.billsService.createBill(userId, createBillDto);
	}

	@Post('create-for-room')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Tạo hóa đơn cho phòng với tính toán tự động' })
	@ApiResponse({
		status: 201,
		description: 'Hóa đơn được tạo thành công',
		type: BillResponseDto,
	})
	async createBillForRoom(
		@CurrentUser('id') userId: string,
		@Body() createBillDto: CreateBillForRoomDto,
	): Promise<BillResponseDto> {
		return this.billsService.createBillForRoom(userId, createBillDto);
	}

	@Post('preview-for-building')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Preview hóa đơn cho toàn bộ building' })
	@ApiResponse({
		status: 200,
		description: 'Preview hóa đơn và danh sách costs cần nhập',
		type: BuildingBillPreviewDto,
	})
	async previewBillForBuilding(
		@CurrentUser('id') userId: string,
		@Body() previewDto: PreviewBuildingBillDto,
	): Promise<BuildingBillPreviewDto> {
		return this.billsService.previewBillForBuilding(userId, previewDto);
	}

	@Post('update-with-meter-data')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Cập nhật bill với meter data và occupancy' })
	@ApiResponse({
		status: 200,
		description: 'Bill được cập nhật thành công',
		type: BillResponseDto,
	})
	async updateBillWithMeterData(
		@CurrentUser('id') userId: string,
		@Body() updateDto: UpdateBillWithMeterDataDto,
	): Promise<BillResponseDto> {
		return this.billsService.updateBillWithMeterData(userId, updateDto);
	}

	@Get()
	@ApiOperation({ summary: 'Lấy danh sách hóa đơn' })
	@ApiResponse({
		status: 200,
		description: 'Danh sách hóa đơn',
		type: PaginatedBillResponseDto,
	})
	async getBills(
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
		@Query() query: QueryBillDto,
	): Promise<PaginatedBillResponseDto> {
		return this.billsService.getBills(userId, userRole, query);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Lấy chi tiết hóa đơn' })
	@ApiParam({ name: 'id', description: 'ID của hóa đơn' })
	@ApiResponse({
		status: 200,
		description: 'Chi tiết hóa đơn',
		type: BillResponseDto,
	})
	async getBillById(
		@Param('id') billId: string,
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
	): Promise<BillResponseDto> {
		return this.billsService.getBillById(billId, userId, userRole);
	}

	@Patch(':id')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Cập nhật hóa đơn' })
	@ApiParam({ name: 'id', description: 'ID của hóa đơn' })
	@ApiResponse({
		status: 200,
		description: 'Hóa đơn được cập nhật thành công',
		type: BillResponseDto,
	})
	async updateBill(
		@Param('id') billId: string,
		@CurrentUser('id') userId: string,
		@Body() updateBillDto: UpdateBillDto,
	): Promise<BillResponseDto> {
		return this.billsService.updateBill(billId, userId, updateBillDto);
	}

	@Delete(':id')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Xóa hóa đơn' })
	@ApiParam({ name: 'id', description: 'ID của hóa đơn' })
	@ApiResponse({
		status: 200,
		description: 'Hóa đơn được xóa thành công',
	})
	async deleteBill(@Param('id') billId: string, @CurrentUser('id') userId: string): Promise<void> {
		return this.billsService.deleteBill(billId, userId);
	}

	@Post(':id/mark-paid')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Đánh dấu hóa đơn đã thanh toán' })
	@ApiParam({ name: 'id', description: 'ID của hóa đơn' })
	@ApiResponse({
		status: 200,
		description: 'Hóa đơn được đánh dấu đã thanh toán',
		type: BillResponseDto,
	})
	async markBillAsPaid(
		@Param('id') billId: string,
		@CurrentUser('id') userId: string,
	): Promise<BillResponseDto> {
		return this.billsService.markBillAsPaid(billId, userId);
	}

	@Post(':id/meter-data')
	@Roles(UserRole.landlord)
	@ApiOperation({ summary: 'Cập nhật dữ liệu đồng hồ cho hóa đơn' })
	@ApiParam({ name: 'id', description: 'ID của hóa đơn' })
	@ApiResponse({
		status: 200,
		description: 'Dữ liệu đồng hồ được cập nhật thành công',
		type: BillResponseDto,
	})
	async updateMeterData(
		@Param('id') billId: string,
		@CurrentUser('id') userId: string,
		@Body() meterData: MeterDataDto[],
	): Promise<BillResponseDto> {
		return this.billsService.updateMeterData(billId, userId, meterData);
	}
}
