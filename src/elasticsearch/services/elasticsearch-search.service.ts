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

		// Amenities filter (all must match). Use terms query for set inclusion if multiple provided
		if (amenities) {
			const amenityIds = amenities
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean);
			if (amenityIds.length === 1) {
				filter.push({ term: { amenityIds: amenityIds[0] } });
			} else if (amenityIds.length > 1) {
				filter.push({ terms: { amenityIds } });
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
			// default to createdAt if unknown sort field to avoid ES errors
			const safeSortField = ['createdAt', 'updatedAt', 'viewCount', 'areaSqm'].includes(sortBy)
				? sortBy
				: 'createdAt';
			sort.push({ [safeSortField]: { order: sortOrder } });
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
	 * Autocomplete suggestions for different types
	 */
	async autocomplete(
		query: string,
		type: 'rooms' | 'room-seeking' | 'roommate-seeking' = 'rooms',
		limit = 10,
	): Promise<any[]> {
		try {
			// Determine index and field based on type
			let index: string;
			let field: string;

			switch (type) {
				case 'rooms':
					index = ROOM_INDEX;
					field = 'name.suggest';
					break;
				case 'room-seeking':
					index = ROOM_SEEKING_INDEX;
					field = 'title.suggest';
					break;
				case 'roommate-seeking':
					index = ROOMMATE_SEEKING_INDEX;
					field = 'title.suggest';
					break;
				default:
					index = ROOM_INDEX;
					field = 'name.suggest';
			}

			const response = await this.elasticsearchService.search({
				index,
				suggest: {
					autocomplete: {
						prefix: query,
						completion: {
							field,
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

	/**
	 * Enhanced autocomplete with multiple field suggestions
	 */
	async enhancedAutocomplete(
		query: string,
		type: 'rooms' | 'room-seeking' | 'roommate-seeking' = 'rooms',
		limit = 10,
	): Promise<any[]> {
		try {
			let index: string;
			let fields: string[];

			switch (type) {
				case 'rooms':
					index = ROOM_INDEX;
					fields = ['name.suggest', 'building.name.suggest'];
					break;
				case 'room-seeking':
					index = ROOM_SEEKING_INDEX;
					fields = ['title.suggest'];
					break;
				case 'roommate-seeking':
					index = ROOMMATE_SEEKING_INDEX;
					fields = ['title.suggest'];
					break;
				default:
					index = ROOM_INDEX;
					fields = ['name.suggest'];
			}

			// Use multi-suggest for better results
			const suggestQueries: any = {};
			fields.forEach((field, index) => {
				suggestQueries[`suggest_${index}`] = {
					prefix: query,
					completion: {
						field,
						size: Math.ceil(limit / fields.length),
						skip_duplicates: true,
					},
				};
			});

			const response = await this.elasticsearchService.search({
				index,
				suggest: suggestQueries,
			});

			// Combine results from all fields
			const allSuggestions: any[] = [];
			Object.values(response.suggest || {}).forEach((suggestResult: any) => {
				if (suggestResult?.[0]?.options) {
					allSuggestions.push(...suggestResult[0].options);
				}
			});

			// Remove duplicates and sort by score
			const uniqueSuggestions = allSuggestions
				.filter(
					(suggestion, index, self) => self.findIndex((s) => s.text === suggestion.text) === index,
				)
				.sort((a, b) => b.score - a.score)
				.slice(0, limit);

			return uniqueSuggestions;
		} catch (error) {
			this.logger.error('Failed to get enhanced autocomplete suggestions:', error);
			return [];
		}
	}

	/**
	 * Debug method to check if there's data in Elasticsearch
	 */
	async debugRoomData(): Promise<any> {
		try {
			const response = await this.elasticsearchService.search({
				index: ROOM_INDEX,
				body: {
					query: { match_all: {} },
					_source: ['name', 'description'],
					size: 5,
				},
			});

			return {
				total: response.hits?.total,
				sample: response.hits?.hits?.map((hit: any) => ({
					name: hit._source?.name,
					description: hit._source?.description,
				})),
			};
		} catch (error) {
			this.logger.error('Failed to debug room data:', error);
			return { error: error.message };
		}
	}

	/**
	 * Create Vietnamese analyzer for better text processing
	 */
	async createVietnameseAnalyzer(): Promise<void> {
		try {
			await this.elasticsearchService.indices.putSettings({
				index: ROOM_INDEX,
				body: {
					analysis: {
						analyzer: {
							vietnamese_analyzer: {
								type: 'custom',
								tokenizer: 'standard',
								filter: ['lowercase', 'vietnamese_stop', 'vietnamese_stemmer'],
							},
						},
						filter: {
							vietnamese_stop: {
								type: 'stop',
								stopwords: [
									'và',
									'của',
									'cho',
									'với',
									'tại',
									'trong',
									'có',
									'được',
									'là',
									'một',
									'các',
									'như',
									'để',
									'này',
									'đó',
									'khi',
									'nếu',
									'vì',
									'nên',
									'mà',
									'thì',
									'đã',
									'sẽ',
									'đang',
									'đã',
									'được',
									'có',
									'không',
									'chưa',
									'rất',
									'quá',
									'cũng',
									'nhưng',
									'hoặc',
									'và',
									'của',
									'cho',
									'với',
									'tại',
									'trong',
								],
							},
							vietnamese_stemmer: {
								type: 'stemmer',
								language: 'vietnamese',
							},
						},
					},
				},
			});
			this.logger.log('Vietnamese analyzer created successfully');
		} catch (error) {
			this.logger.error('Failed to create Vietnamese analyzer:', error);
		}
	}

	/**
	 * Vietnamese-friendly word completion using phrase suggestions
	 */
	async getSimpleWordCompletions(query: string, limit = 10): Promise<any[]> {
		try {
			// Use phrase prefix search for better Vietnamese support
			const response = await this.elasticsearchService.search({
				index: ROOM_INDEX,
				body: {
					query: {
						bool: {
							must: [
								{ term: { isActive: true } },
								{
									multi_match: {
										query: query,
										fields: ['name^3', 'description^1'],
										type: 'phrase_prefix',
										fuzziness: 'AUTO',
									},
								},
							],
						},
					},
					_source: ['name', 'description'],
					size: limit * 2, // Get more results to extract better completions
				},
			});

			const hits = response.hits?.hits || [];

			// Extract Vietnamese phrase completions
			const completions = new Map<string, number>();

			hits.forEach((hit: any) => {
				const name = hit._source?.name || '';
				const description = hit._source?.description || '';
				const score = hit._score || 0.5;

				// Process both name and description
				[name, description].forEach((text) => {
					if (!text) return;

					const textLower = text.toLowerCase();
					const queryLower = query.toLowerCase();

					// Find where query appears in text
					const index = textLower.indexOf(queryLower);
					if (index !== -1) {
						// Extract the rest of the phrase after the query
						const remaining = text.substring(index + query.length).trim();

						// Split by common Vietnamese separators and take first meaningful part
						const parts = remaining.split(/[,\-.\s]+/).filter((part) => part.length > 0);

						if (parts.length > 0) {
							// Take first 1-2 words for completion
							const completion = parts.slice(0, 2).join(' ');
							if (completion.length > 0 && completion.length < 20) {
								const currentScore = completions.get(completion) || 0;
								completions.set(completion, Math.max(currentScore, score));
							}
						}
					}
				});
			});

			// Convert to array, sort by score, and format
			return Array.from(completions.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, limit)
				.map(([text, score]) => ({
					text,
					score: Math.min(score / 10, 1), // Normalize score
					context: {
						query: query,
					},
				}));
		} catch (error) {
			this.logger.error('Failed to get simple word completions:', error);
			return [];
		}
	}

	/**
	 * Get autocomplete suggestions using both completion suggester and edge_ngram
	 * Following the standard Vietnamese autocomplete flow
	 */
	async getAutocompleteSuggestions(query: string, limit: number = 5): Promise<any[]> {
		try {
			if (!query || query.trim().length < 2) {
				return [];
			}

			const suggestions = [];

			// 1. Try Completion Suggester first (fastest)
			try {
				const completionResponse = await this.elasticsearchService.search({
					index: ROOM_INDEX,
					body: {
						suggest: {
							'room-suggest': {
								prefix: query,
								completion: {
									field: 'name_suggest',
									fuzzy: { fuzziness: 1 },
									size: limit,
								},
							},
						},
					},
				});

				const completionSuggestions =
					completionResponse.suggest?.['room-suggest']?.[0]?.options || [];

				if (Array.isArray(completionSuggestions)) {
					completionSuggestions.forEach((option: any) => {
						suggestions.push({
							text: option.text,
							score: option._score || 1,
							type: 'completion',
							context: {
								query: query,
								source: 'completion_suggester',
							},
						});
					});
				}
			} catch (error) {
				this.logger.warn('Completion suggester failed, falling back to edge_ngram:', error.message);
			}

			// 2. If not enough results, fallback to edge_ngram
			if (suggestions.length < limit) {
				try {
					const edgeResponse = await this.elasticsearchService.search({
						index: ROOM_INDEX,
						body: {
							query: {
								bool: {
									must: [
										{ term: { isActive: true } },
										{
											match: {
												'name.ac': {
													query: query,
													operator: 'and',
												},
											},
										},
									],
								},
							},
							_source: ['name', 'city'],
							size: limit - suggestions.length,
						},
					});

					const edgeHits = edgeResponse.hits?.hits || [];

					edgeHits.forEach((hit: any) => {
						const name = hit._source?.name || '';
						const city = hit._source?.city || '';
						const score = hit._score || 0.5;

						// Avoid duplicates
						const exists = suggestions.some((s) => s.text === name);
						if (!exists) {
							suggestions.push({
								text: name,
								score: score,
								type: 'edge_ngram',
								context: {
									query: query,
									source: 'edge_ngram',
									city: city,
								},
							});
						}
					});
				} catch (error) {
					this.logger.warn('Edge ngram search failed:', error.message);
				}
			}

			// 3. Sort by score and return top results
			return suggestions
				.sort((a, b) => b.score - a.score)
				.slice(0, limit)
				.map((suggestion) => ({
					text: suggestion.text,
					score: Math.min(suggestion.score / 10, 1), // Normalize score
					context: suggestion.context,
				}));
		} catch (error) {
			this.logger.error('Failed to get autocomplete suggestions:', error);
			return [];
		}
	}
}
