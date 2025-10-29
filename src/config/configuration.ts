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
	rateLimit: {
		ttl: number;
		limit: number;
	};
	resend: {
		apiKey: string;
	};
	elasticsearch: {
		node: string;
		username: string;
		password: string;
		maxRetries: number;
		requestTimeout: number;
	};
	ai: {
		googleApiKey: string;
		temperature: number;
		maxTokens: number;
		limit: number;
		model: string;
	};
	supabase: {
		url: string;
		anonKey: string;
		serviceKey?: string;
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
	rateLimit: {
		ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60000', 10),
		limit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '100', 10),
	},
	resend: {
		apiKey: process.env.RESEND_API_KEY ?? '',
	},
	elasticsearch: {
		node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
		username: process.env.ELASTICSEARCH_USERNAME ?? '',
		password: process.env.ELASTICSEARCH_PASSWORD ?? '',
		maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES ?? '3', 10),
		requestTimeout: parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT ?? '30000', 10),
	},
	ai: {
		googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
		temperature: parseFloat(process.env.AI_TEMPERATURE ?? '0.1'),
		maxTokens: parseInt(process.env.AI_MAX_TOKENS ?? '500', 10),
		limit: parseInt(process.env.AI_LIMIT ?? '100', 10),
		model: process.env.AI_MODEL ?? 'gemini-1.5-flash-latest',
	},
	supabase: {
		url: process.env.SUPABASE_URL ?? '',
		anonKey: process.env.SUPABASE_ANON_KEY ?? '',
		serviceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
	},
});

export default getConfig;
