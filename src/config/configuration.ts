/**
 * Returns the application configuration loaded from environment variables.
 * @returns {AppConfig} The application configuration object.
 */
export interface AppConfig {
	app: {
		port: number;
		environment: string;
		logLevel: string;
	};
	database: {
		url: string;
	};
	jwt: {
		secret: string;
		expiresIn: string;
		refreshSecret: string;
		refreshExpiresIn: string;
	};
	redis: {
		host: string;
		port: number;
		password: string;
	};
	email: {
		from: string;
		apiKey: string;
	};
	upload: {
		maxFileSize: number;
		allowedTypes: string[];
	};
}

/**
 * Loads and returns the application configuration from environment variables.
 * @returns {AppConfig} The application configuration object.
 */
const getConfig = (): AppConfig => ({
	app: {
		port: parseInt(process.env.PORT ?? '3000', 10),
		environment: process.env.NODE_ENV ?? 'development',
		logLevel: process.env.LOG_LEVEL ?? 'info',
	},
	database: {
		url: process.env.DATABASE_URL ?? '',
	},
	jwt: {
		secret: process.env.JWT_SECRET ?? '',
		expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
		refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
	},
	redis: {
		host: process.env.REDIS_HOST ?? 'localhost',
		port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
		password: process.env.REDIS_PASSWORD ?? '',
	},
	email: {
		from: process.env.EMAIL_FROM ?? '',
		apiKey: process.env.EMAIL_API_KEY ?? '',
	},
	upload: {
		maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10),
		allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') ?? ['image/jpeg', 'image/png'],
	},
});

export default getConfig;
