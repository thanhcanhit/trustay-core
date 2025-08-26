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
	@ApiOperation({
		summary: 'Search and filter rental rooms',
		description:
			'Find available rooms for rent with comprehensive filtering options including location-based search',
	})
	@ApiQuery({
		name: 'search',
		required: false,
		description: 'Search keyword for room/building name',
		example: 'phòng VIP',
	})
	@ApiQuery({
		name: 'provinceId',
		required: false,
		description: 'Filter by province ID',
		example: 1,
	})
	@ApiQuery({
		name: 'districtId',
		required: false,
		description: 'Filter by district ID',
		example: 5,
	})
	@ApiQuery({ name: 'wardId', required: false, description: 'Filter by ward ID', example: 25 })
	@ApiQuery({
		name: 'roomType',
		required: false,
		description: 'Filter by room type',
		enum: ['boarding_house', 'dormitory', 'sleepbox', 'apartment', 'whole_house'],
	})
	@ApiQuery({
		name: 'minPrice',
		required: false,
		description: 'Minimum monthly rent (VND)',
		example: 2000000,
	})
	@ApiQuery({
		name: 'maxPrice',
		required: false,
		description: 'Maximum monthly rent (VND)',
		example: 8000000,
	})
	@ApiQuery({ name: 'minArea', required: false, description: 'Minimum area in sqm', example: 15 })
	@ApiQuery({ name: 'maxArea', required: false, description: 'Maximum area in sqm', example: 50 })
	@ApiQuery({
		name: 'amenities',
		required: false,
		description: 'Required amenity IDs (comma-separated)',
		example: 'uuid1,uuid2,uuid3',
	})
	@ApiQuery({ name: 'maxOccupancy', required: false, description: 'Maximum occupancy', example: 2 })
	@ApiQuery({
		name: 'isVerified',
		required: false,
		description: 'Filter verified rooms only',
		example: true,
	})
	@ApiQuery({
		name: 'latitude',
		required: false,
		description: 'Latitude for location-based search',
		example: 10.7769,
	})
	@ApiQuery({
		name: 'longitude',
		required: false,
		description: 'Longitude for location-based search',
		example: 106.7009,
	})
	@ApiQuery({ name: 'radius', required: false, description: 'Search radius in km', example: 5 })
	@ApiQuery({
		name: 'sortBy',
		required: false,
		description: 'Sort field',
		enum: ['createdAt', 'price', 'area', 'distance'],
	})
	@ApiQuery({
		name: 'sortOrder',
		required: false,
		description: 'Sort order',
		enum: ['asc', 'desc'],
	})
	@ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
	@ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
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
	@ApiOperation({
		summary: 'Search room seeking posts',
		description:
			'Find posts from people looking for rooms to rent with filtering by budget, location, and preferences',
	})
	@ApiQuery({
		name: 'search',
		required: false,
		description: 'Search keyword in title/description',
		example: 'cần tìm phòng gần trường',
	})
	@ApiQuery({
		name: 'provinceId',
		required: false,
		description: 'Filter by province ID',
		example: 1,
	})
	@ApiQuery({
		name: 'districtId',
		required: false,
		description: 'Filter by district ID',
		example: 5,
	})
	@ApiQuery({ name: 'wardId', required: false, description: 'Filter by ward ID', example: 25 })
	@ApiQuery({
		name: 'minBudget',
		required: false,
		description: 'Minimum budget (VND)',
		example: 2000000,
	})
	@ApiQuery({
		name: 'maxBudget',
		required: false,
		description: 'Maximum budget (VND)',
		example: 8000000,
	})
	@ApiQuery({
		name: 'roomType',
		required: false,
		description: 'Preferred room type',
		enum: ['boarding_house', 'dormitory', 'sleepbox', 'apartment', 'whole_house'],
	})
	@ApiQuery({ name: 'occupancy', required: false, description: 'Number of occupants', example: 2 })
	@ApiQuery({
		name: 'amenities',
		required: false,
		description: 'Required amenity IDs (comma-separated)',
		example: 'uuid1,uuid2,uuid3',
	})
	@ApiQuery({
		name: 'moveInDate',
		required: false,
		description: 'Desired move-in date (YYYY-MM-DD)',
		example: '2025-03-01',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Post status',
		enum: ['active', 'paused', 'closed', 'expired'],
	})
	@ApiQuery({ name: 'isPublic', required: false, description: 'Public posts only', example: true })
	@ApiQuery({
		name: 'requesterId',
		required: false,
		description: 'Filter by requester ID',
		example: 'uuid',
	})
	@ApiQuery({
		name: 'sortBy',
		required: false,
		description: 'Sort field',
		enum: ['createdAt', 'maxBudget', 'moveInDate', 'viewCount'],
	})
	@ApiQuery({
		name: 'sortOrder',
		required: false,
		description: 'Sort order',
		enum: ['asc', 'desc'],
	})
	@ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
	@ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách bài đăng tìm trọ thành công',
	})
	async getRoomSeekingPosts(@Query() query: RoomRequestSearchDto) {
		return this.listingService.findAllRoomRequests(query);
	}
}
