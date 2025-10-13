import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ROOM_INDEX } from '../mappings/room.mapping';
import { ROOM_SEEKING_INDEX } from '../mappings/room-seeking.mapping';
import { ROOMMATE_SEEKING_INDEX } from '../mappings/roommate-seeking.mapping';

export interface SearchRoomsQuery {
	search?: string;
	provinceId?: number;
	districtId?: number;
	wardId?: number;
	roomType?: string;
	minPrice?: number;
	maxPrice?: number;
	minArea?: number;
	maxArea?: number;
	amenities?: string; // comma-separated IDs
	maxOccupancy?: number;
	isVerified?: boolean;
	latitude?: number;
	longitude?: number;
	radius?: number; // in km
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
	page?: number;
	limit?: number;
}

export interface SearchResult<T> {
	hits: T[];
	total: number;
	aggregations?: any;
}

@Injectable()
export class ElasticsearchSearchService {
	private readonly logger = new Logger(ElasticsearchSearchService.name);

	constructor(private readonly elasticsearchService: ElasticsearchService) {}

	/**
	 * Search rooms with comprehensive filtering and relevance scoring
	 */
	async searchRooms(query: SearchRoomsQuery): Promise<SearchResult<any>> {
		const {
			search,
			provinceId,
			districtId,
			wardId,
			roomType,
			minPrice,
			maxPrice,
			minArea,
			maxArea,
			amenities,
			maxOccupancy,
			isVerified,
			latitude,
			longitude,
			radius,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			page = 1,
			limit = 20,
		} = query;

		// Build must clauses
		const must: any[] = [{ term: { isActive: true } }, { term: { 'building.isActive': true } }];

		// Build filter clauses
		const filter: any[] = [];

		// Full-text search with multi-match and boosting
		if (search) {
			must.push({
				multi_match: {
					query: search,
					fields: ['name^3', 'building.name^2', 'description^1', 'searchText'],
					type: 'best_fields',
					fuzziness: 'AUTO',
					operator: 'or',
				},
			});
		}

		// Location filters
		if (provinceId) {
			filter.push({ term: { 'building.provinceId': provinceId } });
		}
		if (districtId) {
			filter.push({ term: { 'building.districtId': districtId } });
		}
		if (wardId) {
			filter.push({ term: { 'building.wardId': wardId } });
		}

		// Room type filter
		if (roomType) {
			filter.push({ term: { roomType } });
		}

		// Price range filter
		if (minPrice !== undefined || maxPrice !== undefined) {
			const priceRange: any = {};
			if (minPrice !== undefined) priceRange.gte = minPrice;
			if (maxPrice !== undefined) priceRange.lte = maxPrice;
			filter.push({ range: { 'pricing.basePriceMonthly': priceRange } });
		}

		// Area range filter
		if (minArea !== undefined || maxArea !== undefined) {
			const areaRange: any = {};
			if (minArea !== undefined) areaRange.gte = minArea;
			if (maxArea !== undefined) areaRange.lte = maxArea;
			filter.push({ range: { areaSqm: areaRange } });
		}

		// Max occupancy filter
		if (maxOccupancy !== undefined) {
			filter.push({ range: { maxOccupancy: { lte: maxOccupancy } } });
		}

		// Verified filter
		if (isVerified !== undefined) {
			filter.push({ term: { isVerified } });
		}

		// Amenities filter (all must match)
		if (amenities) {
			const amenityIds = amenities
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean);
			for (const amenityId of amenityIds) {
				filter.push({ term: { amenityIds: amenityId } });
			}
		}

		// Geo-distance filter
		if (latitude && longitude && radius) {
			filter.push({
				geo_distance: {
					distance: `${radius}km`,
					'building.location': {
						lat: latitude,
						lon: longitude,
					},
				},
			});
		}

		// Build function_score for relevance boosting
		const functionScore: any = {
			query: {
				bool: {
					must,
					filter,
				},
			},
			functions: [
				// Boost verified rooms
				{
					filter: { term: { isVerified: true } },
					weight: 1.5,
				},
				// Boost by owner rating
				{
					field_value_factor: {
						field: 'building.ownerRating',
						factor: 0.2,
						modifier: 'log1p',
						missing: 0,
					},
				},
				// Boost by view count (popularity)
				{
					field_value_factor: {
						field: 'viewCount',
						factor: 0.1,
						modifier: 'log1p',
						missing: 0,
					},
				},
			],
			score_mode: 'sum',
			boost_mode: 'multiply',
		};

		// Add geo decay if location provided
		if (latitude && longitude) {
			functionScore.functions.push({
				gauss: {
					'building.location': {
						origin: {
							lat: latitude,
							lon: longitude,
						},
						scale: '5km',
						decay: 0.5,
					},
				},
			});
		}

		// Build sort
		const sort: any[] = [];
		if (sortBy === 'distance' && latitude && longitude) {
			sort.push({
				_geo_distance: {
					'building.location': {
						lat: latitude,
						lon: longitude,
					},
					order: sortOrder,
					unit: 'km',
				},
			});
		} else if (sortBy === 'price') {
			sort.push({ 'pricing.basePriceMonthly': { order: sortOrder } });
		} else if (sortBy === 'area') {
			sort.push({ areaSqm: { order: sortOrder } });
		} else if (sortBy === 'relevance') {
			sort.push({ _score: { order: 'desc' } });
		} else {
			sort.push({ [sortBy]: { order: sortOrder } });
		}

		// Add secondary sort by score
		if (sortBy !== 'relevance') {
			sort.push({ _score: { order: 'desc' } });
		}

		try {
			const response = await this.elasticsearchService.search({
				index: ROOM_INDEX,
				query: {
					function_score: functionScore,
				},
				sort,
				from: (page - 1) * limit,
				size: limit,
				track_total_hits: true,
			});

			const hits = response.hits.hits.map((hit: any) => ({
				...hit._source,
				_score: hit._score,
				_sort: hit.sort,
			}));

			const total =
				typeof response.hits.total === 'number' ? response.hits.total : response.hits.total.value;

			return {
				hits,
				total,
				aggregations: response.aggregations,
			};
		} catch (error) {
			this.logger.error('Failed to search rooms:', error);
			throw error;
		}
	}

	/**
	 * Search room seeking posts
	 */
	async searchRoomSeekingPosts(query: any): Promise<SearchResult<any>> {
		const {
			search,
			provinceId,
			districtId,
			wardId,
			minBudget,
			maxBudget,
			roomType,
			amenities,
			status,
			moveInDate,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			page = 1,
			limit = 20,
		} = query;

		const must: any[] = [];
		const filter: any[] = [];

		// Full-text search
		if (search) {
			must.push({
				multi_match: {
					query: search,
					fields: ['title^3', 'description^2', 'searchText'],
					type: 'best_fields',
					fuzziness: 'AUTO',
				},
			});
		}

		// Location filters
		if (provinceId) filter.push({ term: { preferredProvinceId: provinceId } });
		if (districtId) filter.push({ term: { preferredDistrictId: districtId } });
		if (wardId) filter.push({ term: { preferredWardId: wardId } });

		// Budget range
		if (minBudget !== undefined) {
			filter.push({ range: { maxBudget: { gte: minBudget } } });
		}
		if (maxBudget !== undefined) {
			filter.push({ range: { minBudget: { lte: maxBudget } } });
		}

		// Room type
		if (roomType) filter.push({ term: { preferredRoomType: roomType } });

		// Amenities
		if (amenities) {
			const amenityIds = amenities
				.split(',')
				.map((id: string) => id.trim())
				.filter(Boolean);
			for (const amenityId of amenityIds) {
				filter.push({ term: { amenityIds: amenityId } });
			}
		}

		// Status
		if (status) filter.push({ term: { status } });

		// Move-in date
		if (moveInDate) {
			filter.push({ range: { moveInDate: { lte: moveInDate } } });
		}

		try {
			const response = await this.elasticsearchService.search({
				index: ROOM_SEEKING_INDEX,
				query: {
					bool: { must, filter },
				},
				sort: [{ [sortBy]: { order: sortOrder } }],
				from: (page - 1) * limit,
				size: limit,
				track_total_hits: true,
			});

			const hits = response.hits.hits.map((hit: any) => hit._source);
			const total =
				typeof response.hits.total === 'number' ? response.hits.total : response.hits.total.value;

			return { hits, total };
		} catch (error) {
			this.logger.error('Failed to search room seeking posts:', error);
			throw error;
		}
	}

	/**
	 * Search roommate seeking posts
	 */
	async searchRoommateSeekingPosts(query: any): Promise<SearchResult<any>> {
		const {
			search,
			provinceId,
			districtId,
			wardId,
			minPrice,
			maxPrice,
			status,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			page = 1,
			limit = 20,
		} = query;

		const must: any[] = [{ term: { isActive: true } }];
		const filter: any[] = [];

		// Full-text search
		if (search) {
			must.push({
				multi_match: {
					query: search,
					fields: ['title^3', 'description^2', 'searchText'],
					type: 'best_fields',
					fuzziness: 'AUTO',
				},
			});
		}

		// Location filters
		if (provinceId) filter.push({ term: { externalProvinceId: provinceId } });
		if (districtId) filter.push({ term: { externalDistrictId: districtId } });
		if (wardId) filter.push({ term: { externalWardId: wardId } });

		// Price range
		if (minPrice !== undefined || maxPrice !== undefined) {
			const priceRange: any = {};
			if (minPrice !== undefined) priceRange.gte = minPrice;
			if (maxPrice !== undefined) priceRange.lte = maxPrice;
			filter.push({ range: { monthlyRent: priceRange } });
		}

		// Status
		if (status) filter.push({ term: { status } });

		try {
			const response = await this.elasticsearchService.search({
				index: ROOMMATE_SEEKING_INDEX,
				query: {
					bool: { must, filter },
				},
				sort: [{ [sortBy]: { order: sortOrder } }],
				from: (page - 1) * limit,
				size: limit,
				track_total_hits: true,
			});

			const hits = response.hits.hits.map((hit: any) => hit._source);
			const total =
				typeof response.hits.total === 'number' ? response.hits.total : response.hits.total.value;

			return { hits, total };
		} catch (error) {
			this.logger.error('Failed to search roommate seeking posts:', error);
			throw error;
		}
	}

	/**
	 * Autocomplete suggestions
	 */
	async autocomplete(query: string, index: string = ROOM_INDEX, limit = 10): Promise<any[]> {
		try {
			const response = await this.elasticsearchService.search({
				index,
				suggest: {
					autocomplete: {
						prefix: query,
						completion: {
							field: 'name.suggest',
							size: limit,
							skip_duplicates: true,
						},
					},
				},
			});

			const options = response.suggest?.autocomplete?.[0]?.options;
			return Array.isArray(options) ? options : [];
		} catch (error) {
			this.logger.error('Failed to get autocomplete suggestions:', error);
			return [];
		}
	}
}
