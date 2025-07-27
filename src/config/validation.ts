import * as Joi from 'joi';

export const validationSchema = Joi.object({
	// Application
	NODE_ENV: Joi.string()
		.valid('development', 'production', 'test', 'staging')
		.default('development'),
	PORT: Joi.number().port().default(3000),
	LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),

	// Database
	DATABASE_URL: Joi.string().required(),

	// JWT
	JWT_SECRET: Joi.string().min(32).required(),
	JWT_EXPIRES_IN: Joi.string().default('7d'),
	JWT_REFRESH_SECRET: Joi.string().min(32).optional(),
	JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

	// Redis (optional)
	REDIS_HOST: Joi.string().default('localhost'),
	REDIS_PORT: Joi.number().port().default(6379),
	REDIS_PASSWORD: Joi.string().optional(),

	// Email (optional)
	EMAIL_FROM: Joi.string().email().optional(),
	EMAIL_API_KEY: Joi.string().optional(),

	// File Upload (optional)
	MAX_FILE_SIZE: Joi.number().positive().default(5242880), // 5MB
	ALLOWED_FILE_TYPES: Joi.string().optional(),

	// Resend
	RESEND_API_KEY: Joi.string().required(),
});
