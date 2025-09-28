import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Put,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
	CreateRoommatePreferencesDto,
	CreateRoomPreferencesDto,
	RoommatePreferencesResponseDto,
	RoomPreferencesResponseDto,
	UpdateRoommatePreferencesDto,
	UpdateRoomPreferencesDto,
} from './dto';
import { TenantPreferencesService } from './tenant-preferences.service';

@ApiTags('Tenant Preferences')
@Controller('tenant-preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantPreferencesController {
	constructor(private readonly preferencesService: TenantPreferencesService) {}

	// Room Preferences Endpoints
	@Post('room')
	@ApiOperation({
		summary: 'Tạo hoặc cập nhật preferences về phòng',
		description: 'Tạo mới hoặc cập nhật preferences về loại phòng mong muốn',
	})
	@ApiResponse({
		status: 201,
		description: 'Tạo/cập nhật thành công',
		type: RoomPreferencesResponseDto,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async createOrUpdateRoomPreferences(
		@Body() dto: CreateRoomPreferencesDto,
		@CurrentUser() user: User,
	): Promise<RoomPreferencesResponseDto> {
		return this.preferencesService.createOrUpdateRoomPreferences(user.id, dto);
	}

	@Get('room')
	@ApiOperation({
		summary: 'Lấy preferences về phòng',
		description: 'Lấy preferences về loại phòng mong muốn của tenant hiện tại',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy thành công',
		type: RoomPreferencesResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Chưa có preferences' })
	async getRoomPreferences(@CurrentUser() user: User): Promise<RoomPreferencesResponseDto | null> {
		return this.preferencesService.getRoomPreferences(user.id);
	}

	@Put('room')
	@ApiOperation({
		summary: 'Cập nhật preferences về phòng',
		description: 'Cập nhật preferences về loại phòng mong muốn (phải đã tồn tại)',
	})
	@ApiResponse({
		status: 200,
		description: 'Cập nhật thành công',
		type: RoomPreferencesResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Không tìm thấy preferences' })
	async updateRoomPreferences(
		@Body() dto: UpdateRoomPreferencesDto,
		@CurrentUser() user: User,
	): Promise<RoomPreferencesResponseDto> {
		return this.preferencesService.updateRoomPreferences(user.id, dto);
	}

	@Delete('room')
	@ApiOperation({
		summary: 'Xóa preferences về phòng',
		description: 'Xóa preferences về loại phòng mong muốn',
	})
	@ApiResponse({ status: 204, description: 'Xóa thành công' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy preferences' })
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteRoomPreferences(@CurrentUser() user: User): Promise<void> {
		return this.preferencesService.deleteRoomPreferences(user.id);
	}

	// Roommate Preferences Endpoints
	@Post('roommate')
	@ApiOperation({
		summary: 'Tạo hoặc cập nhật preferences về bạn cùng phòng',
		description: 'Tạo mới hoặc cập nhật preferences về bạn cùng phòng mong muốn',
	})
	@ApiResponse({
		status: 201,
		description: 'Tạo/cập nhật thành công',
		type: RoommatePreferencesResponseDto,
	})
	@ApiResponse({ status: 401, description: 'Chưa xác thực' })
	async createOrUpdateRoommatePreferences(
		@Body() dto: CreateRoommatePreferencesDto,
		@CurrentUser() user: User,
	): Promise<RoommatePreferencesResponseDto> {
		return this.preferencesService.createOrUpdateRoommatePreferences(user.id, dto);
	}

	@Get('roommate')
	@ApiOperation({
		summary: 'Lấy preferences về bạn cùng phòng',
		description: 'Lấy preferences về bạn cùng phòng mong muốn của tenant hiện tại',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy thành công',
		type: RoommatePreferencesResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Chưa có preferences' })
	async getRoommatePreferences(
		@CurrentUser() user: User,
	): Promise<RoommatePreferencesResponseDto | null> {
		return this.preferencesService.getRoommatePreferences(user.id);
	}

	@Put('roommate')
	@ApiOperation({
		summary: 'Cập nhật preferences về bạn cùng phòng',
		description: 'Cập nhật preferences về bạn cùng phòng mong muốn (phải đã tồn tại)',
	})
	@ApiResponse({
		status: 200,
		description: 'Cập nhật thành công',
		type: RoommatePreferencesResponseDto,
	})
	@ApiResponse({ status: 404, description: 'Không tìm thấy preferences' })
	async updateRoommatePreferences(
		@Body() dto: UpdateRoommatePreferencesDto,
		@CurrentUser() user: User,
	): Promise<RoommatePreferencesResponseDto> {
		return this.preferencesService.updateRoommatePreferences(user.id, dto);
	}

	@Delete('roommate')
	@ApiOperation({
		summary: 'Xóa preferences về bạn cùng phòng',
		description: 'Xóa preferences về bạn cùng phòng mong muốn',
	})
	@ApiResponse({ status: 204, description: 'Xóa thành công' })
	@ApiResponse({ status: 404, description: 'Không tìm thấy preferences' })
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteRoommatePreferences(@CurrentUser() user: User): Promise<void> {
		return this.preferencesService.deleteRoommatePreferences(user.id);
	}

	// Combined Endpoints
	@Get('all')
	@ApiOperation({
		summary: 'Lấy tất cả preferences',
		description: 'Lấy cả preferences về phòng và bạn cùng phòng',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy thành công',
		schema: {
			type: 'object',
			properties: {
				roomPreferences: { $ref: '#/components/schemas/RoomPreferencesResponseDto' },
				roommatePreferences: { $ref: '#/components/schemas/RoommatePreferencesResponseDto' },
			},
		},
	})
	async getAllPreferences(@CurrentUser() user: User): Promise<{
		roomPreferences: RoomPreferencesResponseDto | null;
		roommatePreferences: RoommatePreferencesResponseDto | null;
	}> {
		return this.preferencesService.getAllPreferences(user.id);
	}
}
