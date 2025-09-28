import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { PaginatedResponseDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RoommatePostStatus } from '../../common/enums/roommate-post-status.enum';
import {
	CreateRoommateSeekingPostDto,
	RoommateSeekingDetailWithMetaResponseDto,
	RoommateSeekingPostResponseDto,
	UpdateRoommateSeekingPostDto,
} from './dto';
import { RoommateSeekingPostService } from './roommate-seeking-post.service';

@ApiTags('Roommate Seeking Posts')
@Controller('roommate-seeking-posts')
export class RoommateSeekingPostController {
	constructor(private readonly roommateSeekingPostService: RoommateSeekingPostService) {}

	@Post()
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tạo bài đăng tìm người ở ghép' })
	@ApiResponse({
		status: 201,
		description: 'Tạo bài đăng thành công',
		type: RoommateSeekingPostResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async create(
		@Body() createDto: CreateRoommateSeekingPostDto,
		@CurrentUser() user: User,
	): Promise<RoommateSeekingPostResponseDto> {
		return this.roommateSeekingPostService.create(createDto, user.id);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Lấy danh sách bài đăng tìm người ở ghép của tôi',
		description: 'Endpoint để lấy danh sách các bài đăng do user hiện tại tạo ra với phân trang',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách thành công',
		type: PaginatedResponseDto<RoommateSeekingPostResponseDto>,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async findMyPosts(
		@Query() query: PaginationQueryDto,
		@CurrentUser() user: User,
	): Promise<PaginatedResponseDto<RoommateSeekingPostResponseDto>> {
		return this.roommateSeekingPostService.findMyPosts(query, user.id);
	}

	@Get(':id')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({ summary: 'Lấy chi tiết bài đăng tìm người ở ghép' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết thành công',
		type: RoommateSeekingDetailWithMetaResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async findOne(
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<RoommateSeekingDetailWithMetaResponseDto> {
		const clientIp =
			req.ip || req.connection?.remoteAddress || (req.headers['x-forwarded-for'] as string);
		const currentUser = (req as any).user as User;
		const isAuthenticated = Boolean(currentUser);

		const result = await this.roommateSeekingPostService.findOne(id, clientIp, { isAuthenticated });

		// Set meta properties if authenticated
		if (currentUser) {
			result.isOwner = result.tenantId === currentUser.id;
			result.canEdit = result.isOwner;
			result.canApply = !result.isOwner && result.canApply;
		}

		return result;
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật bài đăng tìm người ở ghép' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({
		status: 200,
		description: 'Cập nhật thành công',
		type: RoommateSeekingPostResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async update(
		@Param('id') id: string,
		@Body() updateDto: UpdateRoommateSeekingPostDto,
		@CurrentUser() user: User,
	): Promise<RoommateSeekingPostResponseDto> {
		return this.roommateSeekingPostService.update(id, updateDto, user.id);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xóa bài đăng tìm người ở ghép' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({ status: 204, description: 'Xóa thành công' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền xóa' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	@HttpCode(HttpStatus.NO_CONTENT)
	async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
		return this.roommateSeekingPostService.remove(id, user.id);
	}

	@Patch(':id/status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật trạng thái bài đăng' })
	@ApiParam({ name: 'id', description: 'ID của bài đăng' })
	@ApiResponse({
		status: 200,
		description: 'Cập nhật trạng thái thành công',
		type: RoommateSeekingPostResponseDto,
	})
	@ApiResponse({ status: 400, description: 'Trạng thái không hợp lệ' })
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	@ApiResponse({ status: 403, description: 'Không có quyền thay đổi trạng thái' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
	async updateStatus(
		@Param('id') id: string,
		@Body('status') status: RoommatePostStatus,
		@CurrentUser() user: User,
	): Promise<RoommateSeekingPostResponseDto> {
		return this.roommateSeekingPostService.updateStatus(id, status, user.id);
	}
}
