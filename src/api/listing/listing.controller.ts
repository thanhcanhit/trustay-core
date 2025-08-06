import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListingQueryDto } from './dto/listing-query.dto';
import { PaginatedListingResponseDto } from './dto/paginated-listing-response.dto';
import { ListingService } from './listing.service';

@ApiTags('Room Listings')
@Controller('api/rooms')
export class ListingController {
	constructor(private readonly listingService: ListingService) {}

	@Get()
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
}
