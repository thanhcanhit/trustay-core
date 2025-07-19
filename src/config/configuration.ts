export default () => ({
	// Application
	app: {
		port: parseInt(process.env.PORT ?? '3000', 10),
		environment: process.env.NODE_ENV ?? 'development',
		logLevel: process.env.LOG_LEVEL ?? 'info',
	},

	// Database
	database: {
		url: process.env.DATABASE_URL ?? '',
		host: process.env.DB_HOST ?? 'localhost',
		port: parseInt(process.env.DB_PORT ?? '5432', 10),
		username: process.env.DB_USERNAME ?? 'postgres',
		password: process.env.DB_PASSWORD ?? '',
		name: process.env.DB_NAME ?? 'nestjs_db',
	},

	// JWT
	jwt: {
		secret: process.env.JWT_SECRET ?? '',
		expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
		refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
	},

	// Redis (nếu có)
	redis: {
		host: process.env.REDIS_HOST ?? 'localhost',
		port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
		password: process.env.REDIS_PASSWORD ?? '',
	},

	// Email (nếu có)
	email: {
		from: process.env.EMAIL_FROM ?? '',
		apiKey: process.env.EMAIL_API_KEY ?? '',
	},

	// File Upload (nếu có)
	upload: {
		maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10), // 5MB
		allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') ?? ['image/jpeg', 'image/png'],
	},
});
