export const ROOMMATE_SEEKING_INDEX = 'roommate_seeking_posts';

export const roommateSeekingIndexMapping = {
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

			// Tenant info
			tenantId: { type: 'keyword' },
			tenantName: { type: 'text' },
			tenantAvatarUrl: { type: 'keyword', index: false },

			// Room info (if platform room)
			roomInstanceId: { type: 'keyword' },
			rentalId: { type: 'keyword' },

			// External location (if external room)
			externalAddress: { type: 'text' },
			externalProvinceId: { type: 'integer' },
			externalDistrictId: { type: 'integer' },
			externalWardId: { type: 'integer' },
			externalProvinceName: { type: 'keyword' },
			externalDistrictName: { type: 'keyword' },
			externalWardName: { type: 'keyword' },

			// Pricing
			monthlyRent: { type: 'float' },
			currency: { type: 'keyword' },
			depositAmount: { type: 'float' },
			utilityCostPerPerson: { type: 'float' },

			// Occupancy
			seekingCount: { type: 'integer' },
			approvedCount: { type: 'integer' },
			remainingSlots: { type: 'integer' },
			maxOccupancy: { type: 'integer' },
			currentOccupancy: { type: 'integer' },

			// Roommate preferences
			preferredGender: { type: 'keyword' },
			additionalRequirements: { type: 'text' },

			// Move-in date
			availableFromDate: { type: 'date' },
			minimumStayMonths: { type: 'integer' },
			maximumStayMonths: { type: 'integer' },

			// Status
			status: { type: 'keyword' },
			requiresLandlordApproval: { type: 'boolean' },
			isApprovedByLandlord: { type: 'boolean' },
			isActive: { type: 'boolean' },
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
