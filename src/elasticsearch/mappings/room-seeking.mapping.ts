export const ROOM_SEEKING_INDEX = 'room_seeking_posts';

export const roomSeekingIndexMapping = {
	mappings: {
		properties: {
			// Core fields
			id: { type: 'keyword' },
			slug: { type: 'keyword' },
			title: {
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

			// Requester info
			requesterId: { type: 'keyword' },
			requesterName: { type: 'text' },
			requesterAvatarUrl: { type: 'keyword', index: false },

			// Preferred location
			preferredProvinceId: { type: 'integer' },
			preferredDistrictId: { type: 'integer' },
			preferredWardId: { type: 'integer' },
			preferredProvinceName: { type: 'keyword' },
			preferredDistrictName: { type: 'keyword' },
			preferredWardName: { type: 'keyword' },

			// Budget
			minBudget: { type: 'float' },
			maxBudget: { type: 'float' },
			currency: { type: 'keyword' },

			// Room preferences
			preferredRoomType: { type: 'keyword' },
			occupancy: { type: 'integer' },

			// Amenities
			amenityIds: { type: 'keyword' },
			amenityNames: {
				type: 'text',
				fields: {
					keyword: { type: 'keyword' },
				},
			},

			// Move-in date
			moveInDate: { type: 'date' },

			// Status
			status: { type: 'keyword' },
			isPublic: { type: 'boolean' },
			expiresAt: { type: 'date' },

			// Stats
			viewCount: { type: 'integer' },
			contactCount: { type: 'integer' },

			// Combined search text
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
		number_of_shards: 1,
		number_of_replicas: 1,
		analysis: {
			analyzer: {
				standard: {
					type: 'standard',
				},
			},
		},
	},
};
