import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
	CreateRoomInvitationDto,
	PaginatedRoomInvitationResponseDto,
	QueryRoomInvitationDto,
	RoomInvitationResponseDto,
	UpdateRoomInvitationDto,
} from './dto';
import { RoomInvitationsService } from './room-invitations.service';

@ApiTags('Room Invitations')
@Controller('room-invitations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomInvitationsController {
	constructor(private readonly roomInvitationsService: RoomInvitationsService) {}

	@Post()
	@ApiOperation({
		summary: 'Tạo lời mời thuê phòng (Landlord)',
		description: 'Landlord mời tenant thuê một phòng cụ thể',
	})
	@ApiResponse({
		status: 201,
		description: 'Tạo lời mời thành công',
		type: RoomInvitationResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Dữ liệu không hợp lệ hoặc đã có lời mời tồn tại',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ landlord mới có thể tạo lời mời',
	})
	@ApiResponse({
		status: 404,
		description: 'Không tìm thấy phòng hoặc tenant',
	})
	async createRoomInvitation(
		@CurrentUser('id') landlordId: string,
		@Body() createRoomInvitationDto: CreateRoomInvitationDto,
	): Promise<RoomInvitationResponseDto> {
		return this.roomInvitationsService.createRoomInvitation(landlordId, createRoomInvitationDto);
	}

	@Get('sent')
	@ApiOperation({
		summary: 'Xem lời mời đã gửi (Landlord)',
		description: 'Landlord xem danh sách lời mời đã gửi cho tenant',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách lời mời đã gửi thành công',
		type: PaginatedRoomInvitationResponseDto,
	})
	async getSentInvitations(
		@CurrentUser('id') landlordId: string,
		@Query() query: QueryRoomInvitationDto,
	): Promise<PaginatedRoomInvitationResponseDto> {
		return this.roomInvitationsService.getSentInvitations(landlordId, query);
	}

	@Get('received')
	@ApiOperation({
		summary: 'Xem lời mời đã nhận (Tenant)',
		description: 'Tenant xem danh sách lời mời đã nhận từ landlord',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách lời mời đã nhận thành công',
		type: PaginatedRoomInvitationResponseDto,
	})
	async getReceivedInvitations(
		@CurrentUser('id') tenantId: string,
		@Query() query: QueryRoomInvitationDto,
	): Promise<PaginatedRoomInvitationResponseDto> {
		return this.roomInvitationsService.getReceivedInvitations(tenantId, query);
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Xem chi tiết lời mời',
		description: 'Xem chi tiết một lời mời (chỉ landlord và tenant liên quan)',
	})
	@ApiResponse({
		status: 200,
		description: 'Lấy chi tiết lời mời thành công',
		type: RoomInvitationResponseDto,
	})
	@ApiResponse({
		status: 403,
		description: 'Không có quyền truy cập',
	})
	@ApiResponse({
		status: 404,
		description: 'Không tìm thấy lời mời',
	})
	async getRoomInvitationById(
		@Param('id') invitationId: string,
		@CurrentUser('id') userId: string,
	): Promise<RoomInvitationResponseDto> {
		return this.roomInvitationsService.getRoomInvitationById(invitationId, userId);
	}

	@Patch(':id/respond')
	@ApiOperation({
		summary: 'Phản hồi lời mời (Tenant)',
		description: 'Tenant chấp nhận hoặc từ chối lời mời từ landlord',
	})
	@ApiResponse({
		status: 200,
		description: 'Phản hồi lời mời thành công',
		type: RoomInvitationResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Không thể phản hồi lời mời này (không phải pending hoặc phòng không còn)',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ có thể phản hồi lời mời của mình',
	})
	@ApiResponse({
		status: 404,
		description: 'Không tìm thấy lời mời',
	})
	async respondToInvitation(
		@Param('id') invitationId: string,
		@CurrentUser('id') tenantId: string,
		@Body() updateRoomInvitationDto: UpdateRoomInvitationDto,
	): Promise<RoomInvitationResponseDto> {
		return this.roomInvitationsService.updateRoomInvitation(
			invitationId,
			tenantId,
			updateRoomInvitationDto,
		);
	}

	@Patch(':id/withdraw')
	@ApiOperation({
		summary: 'Thu hồi lời mời (Landlord)',
		description: 'Landlord thu hồi lời mời đã gửi (chỉ với lời mời pending)',
	})
	@ApiResponse({
		status: 200,
		description: 'Thu hồi lời mời thành công',
		type: RoomInvitationResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Không thể thu hồi lời mời này (đã được chấp nhận hoặc đã thu hồi)',
	})
	@ApiResponse({
		status: 403,
		description: 'Chỉ có thể thu hồi lời mời của mình',
	})
	@ApiResponse({
		status: 404,
		description: 'Không tìm thấy lời mời',
	})
	async withdrawInvitation(
		@Param('id') invitationId: string,
		@CurrentUser('id') landlordId: string,
	): Promise<RoomInvitationResponseDto> {
		return this.roomInvitationsService.withdrawRoomInvitation(invitationId, landlordId);
	}
}
