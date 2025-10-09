import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
	ListRoomsQueryDto,
	ListTenantsQueryDto,
	RoomWithOccupantsDto,
	TenantListItemDto,
} from './dto';
import { LandlordService } from './landlord.service';

@ApiTags('Landlord')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('landlord')
export class LandlordController {
	constructor(private readonly landlordService: LandlordService) {}

	@ApiOperation({ summary: 'List tenants for current landlord with room and occupancy info' })
	@ApiResponse({ status: 200, type: TenantListItemDto, isArray: true })
	@Roles(UserRole.landlord)
	@Get('tenants')
	async listTenants(
		@CurrentUser('id') landlordId: string,
		@Query() query: ListTenantsQueryDto,
	): Promise<{
		data: TenantListItemDto[];
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}> {
		return await this.landlordService.listTenants(landlordId, query);
	}

	@ApiOperation({ summary: 'List rooms of current landlord with occupancy and occupants' })
	@ApiResponse({ status: 200, type: RoomWithOccupantsDto, isArray: true })
	@Roles(UserRole.landlord)
	@Get('rooms')
	async listRooms(
		@CurrentUser('id') landlordId: string,
		@Query() query: ListRoomsQueryDto,
	): Promise<{
		data: RoomWithOccupantsDto[];
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}> {
		return await this.landlordService.listRooms(landlordId, query);
	}
}
