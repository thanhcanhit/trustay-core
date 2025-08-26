import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { PaginatedListingResponseDto } from './dto/paginated-listing-response.dto';
import { ListingService } from './listing.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingController {
	constructor(private readonly listingService: ListingService) {}

	@Get('/rooms')
	@ApiOperation({ summary: 'Search and filter rental rooms' })
	@ApiQuery({
		name: 'search',
		required: false,
		description: 'Search keyword for room/building name',
	})
	@ApiQuery({ name: 'provinceId', required: false, description: 'Filter by province ID' })
	@ApiQuery({ name: 'districtId', required: false, description: 'Filter by district ID' })
	@ApiQuery({ name: 'wardId', required: false, description: 'Filter by ward ID' })
	@ApiQuery({ name: 'roomType', required: false, description: 'Filter by room type' })
	@ApiQuery({ name: 'minPrice', required: false, description: 'Minimum monthly rent' })
	@ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum monthly rent' })
	@ApiQuery({ name: 'minArea', required: false, description: 'Minimum area in sqm' })
	@ApiQuery({ name: 'maxArea', required: false, description: 'Maximum area in sqm' })
	@ApiQuery({
		name: 'amenities',
		required: false,
		description: 'Required amenity IDs (comma-separated)',
	})
	@ApiQuery({ name: 'maxOccupancy', required: false, description: 'Maximum occupancy' })
	@ApiQuery({ name: 'isVerified', required: false, description: 'Filter verified rooms only' })
	@ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (price, area, createdAt)' })
	@ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc, desc)' })
	@ApiQuery({ name: 'page', required: false, description: 'Page number' })
	@ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
	@ApiResponse({
		status: 200,
		description: 'Listings retrieved successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid query parameters',
	})
	async getListings(@Query() query: ListingQueryDto): Promise<PaginatedListingResponseDto> {
		return this.listingService.findAllListings(query);
	}

	@Get('/room-seeking-posts')
	@ApiOperation({ summary: 'Tìm kiếm bài đăng tìm trọ' })
	@ApiQuery({ name: 'search', required: false, description: 'Từ khóa tìm kiếm' })
	@ApiQuery({ name: 'provinceId', required: false, description: 'Lọc theo ID tỉnh/thành phố' })
	@ApiQuery({ name: 'districtId', required: false, description: 'Lọc theo ID quận/huyện' })
	@ApiQuery({ name: 'wardId', required: false, description: 'Lọc theo ID phường/xã' })
	@ApiQuery({ name: 'minBudget', required: false, description: 'Ngân sách tối thiểu' })
	@ApiQuery({ name: 'maxBudget', required: false, description: 'Ngân sách tối đa' })
	@ApiQuery({ name: 'roomType', required: false, description: 'Loại phòng' })
	@ApiQuery({ name: 'occupancy', required: false, description: 'Số người ở' })
	@ApiQuery({
		name: 'amenities',
		required: false,
		description: 'Tiện ích mong muốn (comma-separated)',
	})
	@ApiQuery({ name: 'status', required: false, description: 'Trạng thái bài đăng' })
	@ApiQuery({ name: 'isPublic', required: false, description: 'Có công khai hay không' })
	@ApiQuery({ name: 'requesterId', required: false, description: 'ID người đăng' })
	@ApiQuery({ name: 'page', required: false, description: 'Số trang' })
	@ApiQuery({ name: 'limit', required: false, description: 'Số item mỗi trang' })
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách bài đăng tìm trọ thành công',
	})
	async getRoomSeekingPosts(@Query() query: RoomRequestSearchDto) {
		return this.listingService.findAllRoomRequests(query);
	}
}
