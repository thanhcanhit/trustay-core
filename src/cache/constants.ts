// Cache key prefixes
export const CACHE_KEYS = {
	// System data
	SYSTEM_AMENITIES: 'system:amenities',
	SYSTEM_ROOM_RULES: 'system:room-rules',
	SYSTEM_COST_TYPES: 'system:cost-types',

	// Location data
	PROVINCES: 'location:provinces',
	DISTRICTS: 'location:districts',
	DISTRICT_BY_PROVINCE: (provinceCode: string) => `location:districts:province:${provinceCode}`,
	WARDS: 'location:wards',
	WARD_BY_DISTRICT: (districtCode: string) => `location:wards:district:${districtCode}`,

	// Listings
	LISTING_DETAIL: (id: string) => `listing:detail:${id}`,
	LISTING_SEARCH: (hash: string) => `listing:search:${hash}`,

	// Buildings
	BUILDING_DETAIL: (id: string) => `building:detail:${id}`,
	BUILDING_RATINGS: (id: string) => `building:ratings:${id}`,

	// Authentication & Session
	REFRESH_TOKEN: (userId: string, tokenId: string) => `auth:refresh:${userId}:${tokenId}`,
	JWT_BLACKLIST: (jti: string) => `auth:blacklist:${jti}`,
	VERIFICATION_CODE: (type: string, target: string) => `auth:verification:${type}:${target}`,

	// Rate Limiting
	RATE_LIMIT_LOGIN: (identifier: string) => `rate:login:${identifier}`, // email or IP
	RATE_LIMIT_API: (userId: string, endpoint: string) => `rate:api:${userId}:${endpoint}`,
	RATE_LIMIT_BOOKING: (userId: string) => `rate:booking:${userId}`,
	RATE_LIMIT_MESSAGE: (userId: string) => `rate:message:${userId}`,
	DAILY_BOOKING_COUNT: (userId: string, date: string) => `counter:booking:${userId}:${date}`,

	// User Status
	USER_ONLINE: (userId: string) => `user:online:${userId}`,
	USER_LAST_ACTIVE: (userId: string) => `user:last-active:${userId}`,
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
	SYSTEM_DATA: 86400, // 24 hours (rarely changes)
	LOCATION_DATA: 86400, // 24 hours (static data)
	LISTING_DETAIL: 300, // 5 minutes
	LISTING_SEARCH: 180, // 3 minutes
	BUILDING_DATA: 600, // 10 minutes
	SHORT: 60, // 1 minute
	MEDIUM: 300, // 5 minutes
	LONG: 3600, // 1 hour

	// Auth & Session
	REFRESH_TOKEN: 2592000, // 30 days (match JWT refresh token expiry)
	JWT_BLACKLIST: 604800, // 7 days (match JWT access token expiry)
	VERIFICATION_CODE: 600, // 10 minutes (OTP validity)

	// Rate Limiting
	RATE_LIMIT_WINDOW: 900, // 15 minutes window
	LOGIN_ATTEMPT_WINDOW: 1800, // 30 minutes for login attempts
	DAILY_LIMIT_WINDOW: 86400, // 24 hours for daily limits

	// User Status
	USER_ONLINE_TTL: 300, // 5 minutes (refresh every 5 min)
};
