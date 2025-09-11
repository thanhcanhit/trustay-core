import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { ListingQueryDto, RoomRequestSearchDto } from './dto/listing-query.dto';
import { PaginatedListingResponseDto } from './dto/paginated-listing-response.dto';
import { PaginatedRoomSeekingResponseDto } from './dto/paginated-room-seeking-response.dto';
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
	})
	@ApiQuery({
		name: 'provinceId',
		required: false,
		description: 'Filter by province ID',
	})
	@ApiQuery({
		name: 'districtId',
		required: false,
		description: 'Filter by district ID',
	})
	@ApiQuery({ name: 'wardId', required: false, description: 'Filter by ward ID' })
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
	})
	@ApiQuery({
		name: 'maxPrice',
		required: false,
		description: 'Maximum monthly rent (VND)',
	})
	@ApiQuery({ name: 'minArea', required: false, description: 'Minimum area in sqm' })
	@ApiQuery({ name: 'maxArea', required: false, description: 'Maximum area in sqm' })
	@ApiQuery({
		name: 'amenities',
		required: false,
		description: 'Required amenity IDs (comma-separated)',
	})
	@ApiQuery({ name: 'maxOccupancy', required: false, description: 'Maximum occupancy' })
	@ApiQuery({
		name: 'isVerified',
		required: false,
		description: 'Filter verified rooms only',
	})
	@ApiQuery({
		name: 'latitude',
		required: false,
		description: 'Latitude for location-based search',
	})
	@ApiQuery({
		name: 'longitude',
		required: false,
		description: 'Longitude for location-based search',
	})
	@ApiQuery({ name: 'radius', required: false, description: 'Search radius in km' })
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
	@ApiQuery({ name: 'page', required: false, description: 'Page number' })
	@ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
	@ApiResponse({
		status: 200,
		description: 'Listings retrieved successfully',
		type: PaginatedListingResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid query parameters',
	})
	@UseGuards(OptionalJwtAuthGuard)
	async getListings(
		@Query() query: ListingQueryDto,
		@Req() req: any,
	): Promise<PaginatedListingResponseDto> {
		const isAuthenticated = Boolean(req.user);
		return this.listingService.findAllListings(query, { isAuthenticated });
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
	})
	@ApiQuery({
		name: 'provinceId',
		required: false,
		description: 'Filter by province ID',
	})
	@ApiQuery({
		name: 'districtId',
		required: false,
		description: 'Filter by district ID',
	})
	@ApiQuery({ name: 'wardId', required: false, description: 'Filter by ward ID' })
	@ApiQuery({
		name: 'minBudget',
		required: false,
		description: 'Minimum budget (VND)',
	})
	@ApiQuery({
		name: 'maxBudget',
		required: false,
		description: 'Maximum budget (VND)',
	})
	@ApiQuery({
		name: 'roomType',
		required: false,
		description: 'Preferred room type',
		enum: ['boarding_house', 'dormitory', 'sleepbox', 'apartment', 'whole_house'],
	})
	@ApiQuery({ name: 'occupancy', required: false, description: 'Number of occupants' })
	@ApiQuery({
		name: 'amenities',
		required: false,
		description: 'Required amenity IDs (comma-separated)',
	})
	@ApiQuery({
		name: 'moveInDate',
		required: false,
		description: 'Desired move-in date (YYYY-MM-DD)',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Post status',
		enum: ['active', 'paused', 'closed', 'expired'],
	})
	@ApiQuery({ name: 'isPublic', required: false, description: 'Public posts only' })
	@ApiQuery({
		name: 'requesterId',
		required: false,
		description: 'Filter by requester ID',
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
	@ApiQuery({ name: 'page', required: false, description: 'Page number' })
	@ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
	@ApiResponse({
		status: 200,
		description: 'Lấy danh sách bài đăng tìm trọ thành công',
		type: PaginatedRoomSeekingResponseDto,
	})
	@UseGuards(OptionalJwtAuthGuard)
	async getRoomSeekingPosts(
		@Query() query: RoomRequestSearchDto,
		@Req() req: any,
	): Promise<PaginatedRoomSeekingResponseDto> {
		const isAuthenticated = Boolean(req.user);
		return this.listingService.findAllRoomRequests(query, { isAuthenticated });
	}
}
