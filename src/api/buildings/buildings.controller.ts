import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../../common/dto';
import { BuildingsService } from './buildings.service';
import { BuildingResponseDto, CreateBuildingDto, UpdateBuildingDto } from './dto';

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

	@Put(':buildingId')
	@ApiOperation({
		summary: 'Cập nhật thông tin tòa nhà',
		description:
			'Chỉ owner có thể cập nhật building. Nếu thay đổi tên hoặc district, slug sẽ được tự động update.',
	})
	@ApiParam({
		name: 'buildingId',
		description: 'ID của tòa nhà (slug)',
		example: 'nha-tro-minh-phat-quan-1',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Cập nhật tòa nhà thành công',
		type: ApiResponseDto<BuildingResponseDto>,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Dữ liệu đầu vào không hợp lệ hoặc location không hợp lệ',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner của building mới có thể cập nhật',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Không tìm thấy tòa nhà',
	})
	async update(
		@CurrentUser('id') userId: string,
		@Param('buildingId') buildingId: string,
		@Body() updateBuildingDto: UpdateBuildingDto,
	): Promise<ApiResponseDto<BuildingResponseDto>> {
		const building = await this.buildingsService.update(userId, buildingId, updateBuildingDto);

		return ApiResponseDto.success(building, 'Building updated successfully');
	}

	@Delete(':buildingId')
	@ApiOperation({
		summary: 'Xóa tòa nhà',
		description: 'Chỉ owner có thể xóa building. Không thể xóa nếu còn rental đang active.',
	})
	@ApiParam({
		name: 'buildingId',
		description: 'ID của tòa nhà (slug)',
		example: 'nha-tro-minh-phat-quan-1',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Xóa tòa nhà thành công',
		schema: {
			example: {
				success: true,
				message: 'Building deleted successfully',
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Không thể xóa building có rental đang active',
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Chỉ owner của building mới có thể xóa',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Không tìm thấy tòa nhà',
	})
	async remove(
		@CurrentUser('id') userId: string,
		@Param('buildingId') buildingId: string,
	): Promise<ApiResponseDto<null>> {
		await this.buildingsService.remove(userId, buildingId);

		return ApiResponseDto.success(null, 'Building deleted successfully');
	}

	@Get('me')
	@ApiOperation({
		summary: 'Lấy danh sách buildings của tôi',
		description: 'Lấy danh sách tất cả buildings thuộc sở hữu của user hiện tại với phân trang.',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		description: 'Số trang (bắt đầu từ 1)',
		example: 1,
		type: Number,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Số lượng items per page',
		example: 10,
		type: Number,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy danh sách buildings thành công',
		schema: {
			example: {
				success: true,
				message: 'My buildings retrieved successfully',
				data: {
					buildings: [
						{
							id: 'nha-tro-minh-phat-quan-1',
							name: 'Nhà trọ Minh Phát',
							addressLine1: '123 Võ Văn Ngân',
							roomCount: 3,
							availableRoomCount: 12,
							isActive: true,
							createdAt: '2025-01-01T00:00:00.000Z',
						},
					],
					total: 5,
					page: 1,
					limit: 10,
					totalPages: 1,
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	async findMyBuildings(
		@CurrentUser('id') userId: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	): Promise<
		ApiResponseDto<{
			buildings: BuildingResponseDto[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		}>
	> {
		const pageNum = page ? parseInt(page, 10) : 1;
		const limitNum = limit ? parseInt(limit, 10) : 10;

		const result = await this.buildingsService.findManyByOwner(userId, pageNum, limitNum);

		return ApiResponseDto.success(result, 'My buildings retrieved successfully');
	}

	@Get()
	@ApiOperation({
		summary: 'Lấy danh sách buildings của owner',
		description: 'Lấy danh sách tất cả buildings thuộc sở hữu của user hiện tại với phân trang.',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		description: 'Số trang (bắt đầu từ 1)',
		example: 1,
		type: Number,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Số lượng items per page',
		example: 10,
		type: Number,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Lấy danh sách buildings thành công',
		schema: {
			example: {
				success: true,
				message: 'Buildings retrieved successfully',
				data: {
					buildings: [
						{
							id: 'nha-tro-minh-phat-quan-1',
							name: 'Nhà trọ Minh Phát',
							addressLine1: '123 Võ Văn Ngân',
							roomCount: 3,
							availableRoomCount: 12,
							isActive: true,
							createdAt: '2025-01-01T00:00:00.000Z',
						},
					],
					total: 5,
					page: 1,
					limit: 10,
					totalPages: 1,
				},
				timestamp: '2025-01-01T00:00:00.000Z',
			},
		},
	})
	async findManyByOwner(
		@CurrentUser('id') userId: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	): Promise<
		ApiResponseDto<{
			buildings: BuildingResponseDto[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		}>
	> {
		const pageNum = page ? parseInt(page, 10) : 1;
		const limitNum = limit ? parseInt(limit, 10) : 10;

		const result = await this.buildingsService.findManyByOwner(userId, pageNum, limitNum);

		return ApiResponseDto.success(result, 'Buildings retrieved successfully');
	}
}
