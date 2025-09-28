// Test data utilities based on Postman collection variables
export const TEST_DATA = {
	// User data from Postman collection
	users: {
		landlord: {
			id: 'landlord-1',
			email: 'budget.student@trustay.com',
			firstName: 'Minh',
			lastName: 'Nguyễn',
			phoneNumber: '+84901234567',
			password: 'trustay123',
			gender: 'male',
			role: 'landlord',
			dateOfBirth: new Date('1990-01-01'),
			isPhoneVerified: true,
			isEmailVerified: true,
		},
		tenant: {
			id: 'tenant-1',
			email: 'landlord.dev@trustay.life',
			firstName: 'John',
			lastName: 'Doe',
			phoneNumber: '+84987654321',
			password: 'trustay123',
			gender: 'male',
			role: 'tenant',
			dateOfBirth: new Date('1992-01-01'),
			isPhoneVerified: true,
			isEmailVerified: true,
		},
		tenant2: {
			id: 'tenant-2',
			email: 'jane.doe@trustay.com',
			firstName: 'Jane',
			lastName: 'Smith',
			phoneNumber: '+84912345678',
			password: 'trustay123',
			gender: 'female',
			role: 'tenant',
			dateOfBirth: new Date('1993-01-01'),
			isPhoneVerified: true,
			isEmailVerified: true,
		},
	},

	// Sample roommate seeking post data
	roommateSeekingPost: {
		basic: {
			title: 'Tìm người ở ghép phòng trọ',
			description: 'Phòng trọ đẹp, gần trường học',
			externalAddress: '123 Đường ABC, Quận 1, TP.HCM',
			monthlyRent: 2000000,
			depositAmount: 1000000,
			seekingCount: 2,
			maxOccupancy: 4,
			currentOccupancy: 1,
			availableFromDate: '2024-01-01',
			minimumStayMonths: 6,
			currency: 'VND',
		},
		premium: {
			title: 'Phòng cao cấp tìm bạn ở ghép',
			description: 'Căn hộ cao cấp, đầy đủ tiện nghi, view đẹp',
			externalAddress: '456 Đường XYZ, Quận 3, TP.HCM',
			monthlyRent: 5000000,
			depositAmount: 2500000,
			seekingCount: 1,
			maxOccupancy: 2,
			currentOccupancy: 1,
			availableFromDate: '2024-02-01',
			minimumStayMonths: 12,
			currency: 'VND',
		},
	},

	// Sample roommate application data
	roommateApplication: {
		basic: {
			message:
				'Xin chào, tôi quan tâm đến phòng của bạn. Tôi là sinh viên năm 3, sạch sẽ và có trách nhiệm.',
			contactInfo: {
				preferredContactMethod: 'phone',
				additionalNotes: 'Có thể liên hệ sau 6h chiều',
			},
		},
	},

	// Sample verification codes
	verification: {
		defaultCode: '123456',
	},
};

// Helper functions to create test users
export const createTestUser = (type: keyof typeof TEST_DATA.users) => {
	return { ...TEST_DATA.users[type] };
};

// Helper functions for common test scenarios
export const createUserData = (overrides: Partial<typeof TEST_DATA.users.tenant> = {}) => {
	return {
		...TEST_DATA.users.tenant,
		...overrides,
		id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		email: `test-${Date.now()}@trustay.com`,
	};
};

export const createRoommateSeekingPostData = (
	type: keyof typeof TEST_DATA.roommateSeekingPost = 'basic',
	overrides: Partial<typeof TEST_DATA.roommateSeekingPost.basic> = {},
) => {
	return {
		...TEST_DATA.roommateSeekingPost[type],
		...overrides,
	};
};

export const createRoommateApplicationData = (
	overrides: Partial<typeof TEST_DATA.roommateApplication.basic> = {},
) => {
	return {
		...TEST_DATA.roommateApplication.basic,
		...overrides,
	};
};
