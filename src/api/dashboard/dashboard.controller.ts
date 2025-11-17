import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { DashboardFilterQueryDto } from './dto/dashboard-filter-query.dto';
import { DashboardFinanceResponseDto } from './dto/dashboard-finance-response.dto';
import { DashboardOperationsResponseDto } from './dto/dashboard-operations-response.dto';
import { DashboardOverviewResponseDto } from './dto/dashboard-overview-response.dto';

/**
 * Controller phục vụ các endpoint dashboard landlord.
 */
@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
	constructor(private readonly dashboardService: DashboardService) {}

	/**
	 * Lấy dữ liệu tổng quan của dashboard.
	 */
	@ApiOperation({ summary: 'Dashboard overview for current landlord' })
	@ApiResponse({ status: 200, type: DashboardOverviewResponseDto })
	@Roles(UserRole.landlord)
	@Get('overview')
	async getOverview(
		@CurrentUser('id') landlordId: string,
		@Query() query: DashboardFilterQueryDto,
	): Promise<DashboardOverviewResponseDto> {
		return await this.dashboardService.getOverview(landlordId, query);
	}

	/**
	 * Lấy hàng đợi vận hành của dashboard.
	 */
	@ApiOperation({ summary: 'Operational queues and pending actions' })
	@ApiResponse({ status: 200, type: DashboardOperationsResponseDto })
	@Roles(UserRole.landlord)
	@Get('operations')
	async getOperations(
		@CurrentUser('id') landlordId: string,
		@Query() query: DashboardFilterQueryDto,
	): Promise<DashboardOperationsResponseDto> {
		return await this.dashboardService.getOperations(landlordId, query);
	}

	/**
	 * Lấy dữ liệu tài chính theo kỳ tham chiếu.
	 */
	@ApiOperation({ summary: 'Financial snapshot for landlord dashboard' })
	@ApiResponse({ status: 200, type: DashboardFinanceResponseDto })
	@Roles(UserRole.landlord)
	@Get('finance')
	async getFinance(
		@CurrentUser('id') landlordId: string,
		@Query() query: DashboardFilterQueryDto,
	): Promise<DashboardFinanceResponseDto> {
		return await this.dashboardService.getFinance(landlordId, query);
	}
}
