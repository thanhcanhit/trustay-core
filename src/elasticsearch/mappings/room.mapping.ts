export const ROOM_INDEX = 'rooms';

export const roomIndexMapping = {
	mappings: {
		properties: {
			// Core fields
			id: { type: 'keyword' },
			slug: { type: 'keyword' },
			name: {
				type: 'text',
				fields: {
					keyword: { type: 'keyword' },
					suggest: { type: 'completion' },
				},
				analyzer: 'standard',
			},
			description: {
				type: 'text',
				analyzer: 'standard',
			},
			roomType: { type: 'keyword' },
			areaSqm: { type: 'float' },
			maxOccupancy: { type: 'integer' },
			totalRooms: { type: 'integer' },
			viewCount: { type: 'integer' },
			isActive: { type: 'boolean' },
			isVerified: { type: 'boolean' },

			// Overall rating
			overallRating: { type: 'float' },
			totalRatings: { type: 'integer' },

			// Pricing (nested object)
			pricing: {
				type: 'object',
				properties: {
					id: { type: 'keyword' },
					basePriceMonthly: { type: 'float' },
					depositAmount: { type: 'float' },
					depositMonths: { type: 'integer' },
					currency: { type: 'keyword' },
					utilityIncluded: { type: 'boolean' },
					utilityCostMonthly: { type: 'float' },
					priceNegotiable: { type: 'boolean' },
					minimumStayMonths: { type: 'integer' },
					maximumStayMonths: { type: 'integer' },
				},
			},

			// Building (nested object)
			building: {
				type: 'object',
				properties: {
					id: { type: 'keyword' },
					name: {
						type: 'text',
						fields: {
							keyword: { type: 'keyword' },
						},
					},
					addressLine1: { type: 'text' },
					addressLine2: { type: 'text' },
					isVerified: { type: 'boolean' },
					isActive: { type: 'boolean' },

					// Geo-point for location-based search
					location: { type: 'geo_point' },

					// Location IDs
					provinceId: { type: 'integer' },
					districtId: { type: 'integer' },
					wardId: { type: 'integer' },

					// Location names for display
					provinceName: { type: 'keyword' },
					districtName: { type: 'keyword' },
					wardName: { type: 'keyword' },

					// Owner info
					ownerId: { type: 'keyword' },
					ownerName: { type: 'text' },
					ownerRating: { type: 'float' },
					ownerTotalRatings: { type: 'integer' },
					ownerIsVerified: { type: 'boolean' },
				},
			},

			// Available room count (cached)
			availableRoomsCount: { type: 'integer' },

			// Amenities
			amenityIds: { type: 'keyword' },
			amenityNames: {
				type: 'text',
				fields: {
					keyword: { type: 'keyword' },
				},
			},

			// Images
			images: {
				type: 'nested',
				properties: {
					id: { type: 'keyword' },
					imageUrl: { type: 'keyword', index: false },
					altText: { type: 'text' },
					isPrimary: { type: 'boolean' },
					sortOrder: { type: 'integer' },
				},
			},

			// Primary image (for quick access)
			primaryImageUrl: { type: 'keyword', index: false },

			// Combined search text for full-text search
			searchText: {
				type: 'text',
				analyzer: 'standard',
			},

			// Dates
			createdAt: { type: 'date' },
			updatedAt: { type: 'date' },
		},
	},
	settings: {
		number_of_shards: 2, // Increased from 1 for better parallelization
		number_of_replicas: 1,
		refresh_interval: '30s', // Reduce refresh frequency for better indexing performance
		analysis: {
			analyzer: {
				standard: {
					type: 'standard',
				},
			},
		},
		index: {
			// Optimize for search performance
			search: {
				slowlog: {
					threshold: {
						query: {
							warn: '2s',
							info: '1s',
						},
						fetch: {
							warn: '1s',
							info: '500ms',
						},
					},
				},
			},
		},
	},
};
