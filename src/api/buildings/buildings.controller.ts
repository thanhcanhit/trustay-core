import { Body, Controller, Get, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../../common/dto';
import { BuildingsService } from './buildings.service';
import { BuildingResponseDto, CreateBuildingDto } from './dto';

@ApiTags('Buildings')
@Controller('buildings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BuildingsController {
	constructor(private readonly buildingsService: BuildingsService) {}

	@Post()
	@ApiOperation({
		summary: 'Tạo tòa nhà mới',
		description:
			'Chỉ landlord mới có thể tạo tòa nhà. Slug sẽ được tự động generate từ tên và quận.',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Tòa nhà được tạo thành công',
		type: ApiResponseDto<BuildingResponseDto>,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Dữ liệu đầu vào không hợp lệ',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ landlord mới có thể tạo tòa nhà',
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Chưa đăng nhập',
	})
	async create(
		@CurrentUser('id') userId: string,
		@Body() createBuildingDto: CreateBuildingDto,
	): Promise<ApiResponseDto<BuildingResponseDto>> {
		const building = await this.buildingsService.create(userId, createBuildingDto);

		return ApiResponseDto.success(building, 'Building created successfully');
	}

	@Get(':buildingId')
	@ApiOperation({
		summary: 'Lấy thông tin chi tiết tòa nhà',
		description: 'Lấy thông tin chi tiết của một tòa nhà theo ID',
	})
	@ApiParam({
		name: 'buildingId',
		description: 'ID của tòa nhà (slug)',
		example: 'nha-tro-minh-phat-quan-1',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy thông tin tòa nhà thành công',
		type: ApiResponseDto<BuildingResponseDto>,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Không tìm thấy tòa nhà',
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Chưa đăng nhập',
	})
	async findOne(
		@Param('buildingId') buildingId: string,
	): Promise<ApiResponseDto<BuildingResponseDto>> {
		const building = await this.buildingsService.findOne(buildingId);

		return ApiResponseDto.success(building, 'Building retrieved successfully');
	}
}
