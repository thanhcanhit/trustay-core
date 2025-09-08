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
import { ContractsService } from './contracts.service';
import {
	ContractResponseDto,
	CreateContractAmendmentDto,
	PaginatedContractResponseDto,
	QueryContractDto,
	UpdateContractDto,
} from './dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
	constructor(private readonly contractsService: ContractsService) {}

	@ApiOperation({
		summary: 'Tạo hợp đồng tự động từ rental',
		description: 'Hệ thống tự động tạo hợp đồng dựa trên thông tin rental (chỉ landlord)',
	})
	@ApiParam({
		name: 'rentalId',
		description: 'ID của rental cần tạo hợp đồng',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 201,
		description: 'Tạo hợp đồng tự động thành công',
		type: ContractResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Rental không tồn tại hoặc đã có hợp đồng',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ landlord mới có thể tạo hợp đồng',
	})
	@Roles(UserRole.landlord)
	@Post('auto-generate/:rentalId')
	async autoGenerateContract(
		@Param('rentalId', ParseUUIDPipe) rentalId: string,
	): Promise<ContractResponseDto> {
		return await this.contractsService.autoCreateContractFromRental(rentalId);
	}

	@ApiOperation({
		summary: 'Lấy danh sách hợp đồng',
		description: 'Lấy tất cả hợp đồng của user hiện tại với phân trang và lọc',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách hợp đồng thành công',
		type: PaginatedContractResponseDto,
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Get()
	async getContracts(
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
		@Query() query: QueryContractDto,
	): Promise<PaginatedContractResponseDto> {
		return await this.contractsService.getContracts(userId, userRole, query);
	}

	@ApiOperation({
		summary: 'Lấy danh sách hợp đồng của landlord',
		description: 'Alias endpoint cho landlord xem hợp đồng của mình',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách hợp đồng landlord thành công',
		type: PaginatedContractResponseDto,
	})
	@Roles(UserRole.landlord)
	@Get('my-contracts')
	async getMyContracts(
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
		@Query() query: QueryContractDto,
	): Promise<PaginatedContractResponseDto> {
		return await this.contractsService.getContracts(userId, userRole, query);
	}

	@ApiOperation({
		summary: 'Lấy danh sách hợp đồng của tenant',
		description: 'Alias endpoint cho tenant xem hợp đồng của mình',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách hợp đồng tenant thành công',
		type: PaginatedContractResponseDto,
	})
	@Roles(UserRole.tenant)
	@Get('as-tenant')
	async getContractsAsTenant(
		@CurrentUser('id') userId: string,
		@CurrentUser('role') userRole: UserRole,
		@Query() query: QueryContractDto,
	): Promise<PaginatedContractResponseDto> {
		return await this.contractsService.getContracts(userId, userRole, query);
	}

	@ApiOperation({
		summary: 'Lấy chi tiết hợp đồng theo ID',
		description: 'Lấy thông tin chi tiết một hợp đồng (chỉ landlord và tenant liên quan)',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của hợp đồng',
		type: 'string',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết hợp đồng thành công',
		type: ContractResponseDto,
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền truy cập hợp đồng này',
	})
	@ApiResponse({
		status: 404,
		description: 'Hợp đồng không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Get(':id')
	async getContractById(
		@Param('id') contractId: string,
		@CurrentUser('id') userId: string,
	): Promise<ContractResponseDto> {
		return await this.contractsService.getContractById(contractId, userId);
	}

	@ApiOperation({
		summary: 'Cập nhật hợp đồng',
		description: 'Cập nhật thông tin hợp đồng (chủ yếu là landlord)',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của hợp đồng',
		type: 'string',
	})
	@ApiResponse({
		status: 200,
		description: 'Cập nhật hợp đồng thành công',
		type: ContractResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu không hợp lệ',
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền cập nhật hợp đồng này',
	})
	@ApiResponse({
		status: 404,
		description: 'Hợp đồng không tồn tại',
	})
	@Roles(UserRole.landlord)
	@Put(':id')
	async updateContract(
		@Param('id') contractId: string,
		@CurrentUser('id') userId: string,
		@Body() updateContractDto: UpdateContractDto,
	): Promise<ContractResponseDto> {
		return await this.contractsService.updateContract(contractId, userId, updateContractDto);
	}

	@ApiOperation({
		summary: 'Tạo sửa đổi hợp đồng',
		description: 'Tạo một amendment (sửa đổi) cho hợp đồng hiện tại',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của hợp đồng',
		type: 'string',
	})
	@ApiResponse({
		status: 200,
		description: 'Tạo sửa đổi hợp đồng thành công',
		type: ContractResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu sửa đổi không hợp lệ',
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền sửa đổi hợp đồng này',
	})
	@ApiResponse({
		status: 404,
		description: 'Hợp đồng không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Post(':id/amendments')
	async createAmendment(
		@Param('id') contractId: string,
		@CurrentUser('id') userId: string,
		@Body() createAmendmentDto: CreateContractAmendmentDto,
	): Promise<ContractResponseDto> {
		return await this.contractsService.createAmendment(contractId, userId, createAmendmentDto);
	}

	@ApiOperation({
		summary: 'Download hợp đồng PDF',
		description: 'Tải xuống file PDF của hợp đồng',
	})
	@ApiParam({
		name: 'id',
		description: 'ID của hợp đồng',
		type: 'string',
	})
	@ApiResponse({
		status: 200,
		description: 'File PDF hợp đồng',
		headers: {
			'Content-Type': { description: 'application/pdf' },
			'Content-Disposition': { description: 'attachment; filename="contract.pdf"' },
		},
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền tải hợp đồng này',
	})
	@ApiResponse({
		status: 404,
		description: 'Hợp đồng không tồn tại',
	})
	@Roles(UserRole.tenant, UserRole.landlord)
	@Get(':id/download')
	async downloadContract(
		@Param('id') contractId: string,
		@CurrentUser('id') userId: string,
	): Promise<{ url: string }> {
		// Get contract to verify permissions
		const contract = await this.contractsService.getContractById(contractId, userId);

		// Return download URL (in real implementation, would generate PDF)
		return {
			url: contract.documentUrl || `/contracts/${contractId}/document.pdf`,
		};
	}
}
