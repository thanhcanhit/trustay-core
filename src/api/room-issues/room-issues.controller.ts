import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../../common/dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
	CreateRoomIssueDto,
	LandlordRoomIssueQueryDto,
	RoomIssueQueryDto,
	RoomIssueResponseDto,
} from './dto';
import { RoomIssuesService } from './room-issues.service';

@ApiTags('Room Issues')
@Controller('room-issues')
export class RoomIssuesController {
	constructor(private readonly roomIssuesService: RoomIssuesService) {}

	@Post()
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tenant báo cáo sự cố phòng đang thuê' })
	@ApiResponse({
		status: 201,
		description: 'Tạo báo cáo sự cố thành công',
		type: ApiResponseDto<RoomIssueResponseDto>,
	})
	async createIssue(
		@CurrentUser('id') userId: string,
		@Body() dto: CreateRoomIssueDto,
	): Promise<ApiResponseDto<RoomIssueResponseDto>> {
		const issue = await this.roomIssuesService.createIssue(userId, dto);
		return ApiResponseDto.success(issue, 'Room issue reported successfully');
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tenant xem danh sách sự cố đã báo' })
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách sự cố thành công',
		type: ApiResponseDto<PaginatedResponseDto<RoomIssueResponseDto>>,
	})
	async getMyIssues(
		@CurrentUser('id') userId: string,
		@Query() query: RoomIssueQueryDto,
	): Promise<ApiResponseDto<PaginatedResponseDto<RoomIssueResponseDto>>> {
		const result = await this.roomIssuesService.getMyIssues(userId, query);
		return ApiResponseDto.success(result, 'Room issues retrieved successfully');
	}

	@Get('landlord')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Landlord xem sự cố trong tài sản của mình' })
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách sự cố thành công',
		type: ApiResponseDto<PaginatedResponseDto<RoomIssueResponseDto>>,
	})
	async getLandlordIssues(
		@CurrentUser('id') userId: string,
		@Query() query: LandlordRoomIssueQueryDto,
	): Promise<ApiResponseDto<PaginatedResponseDto<RoomIssueResponseDto>>> {
		const result = await this.roomIssuesService.getLandlordIssues(userId, query);
		return ApiResponseDto.success(result, 'Room issues retrieved successfully');
	}

	@Get(':issueId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xem chi tiết sự cố' })
	@ApiParam({ name: 'issueId', description: 'Room issue identifier' })
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết sự cố thành công',
		type: ApiResponseDto<RoomIssueResponseDto>,
	})
	async getIssueDetail(
		@Param('issueId') issueId: string,
		@CurrentUser('id') userId: string,
	): Promise<ApiResponseDto<RoomIssueResponseDto>> {
		const issue = await this.roomIssuesService.getIssueDetail(issueId, userId);
		return ApiResponseDto.success(issue, 'Room issue retrieved successfully');
	}
}
