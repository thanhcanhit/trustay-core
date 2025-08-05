import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListingQueryDto } from './dto/listing-query.dto';
import { PaginatedListingResponseDto } from './dto/paginated-listing-response.dto';
import { ListingService } from './listing.service';

@ApiTags('Listings')
@Controller('api/listings')
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

	@Get('featured')
	@ApiOperation({ summary: 'Get featured rental rooms' })
	@ApiQuery({ name: 'limit', required: false, description: 'Number of featured rooms to return' })
	@ApiResponse({
		status: 200,
		description: 'Featured listings retrieved successfully',
	})
	async getFeaturedListings(@Query('limit') limit?: string) {
		const limitNum = limit ? parseInt(limit, 10) : 10;
		return this.listingService.getFeaturedListings(limitNum);
	}

	@Get('nearby')
	@ApiOperation({ summary: 'Get nearby rental rooms based on coordinates' })
	@ApiQuery({ name: 'latitude', required: true, description: 'Latitude coordinate' })
	@ApiQuery({ name: 'longitude', required: true, description: 'Longitude coordinate' })
	@ApiQuery({
		name: 'radius',
		required: false,
		description: 'Search radius in kilometers (default: 5)',
	})
	@ApiQuery({ name: 'limit', required: false, description: 'Number of rooms to return' })
	@ApiResponse({
		status: 200,
		description: 'Nearby listings retrieved successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid coordinates provided',
	})
	async getNearbyListings(
		@Query('latitude') latitude: string,
		@Query('longitude') longitude: string,
		@Query('radius') radius?: string,
		@Query('limit') limit?: string,
	) {
		const lat = parseFloat(latitude);
		const lng = parseFloat(longitude);
		const radiusKm = radius ? parseFloat(radius) : 5;
		const limitNum = limit ? parseInt(limit, 10) : 20;

		if (isNaN(lat) || isNaN(lng)) {
			throw new BadRequestException('Invalid coordinates provided');
		}

		return this.listingService.getNearbyListings(lat, lng, radiusKm, limitNum);
	}
}
