import { registerAs } from '@nestjs/config';

/**
 * Parse Redis URL to extract connection details
 * @param redisUrl - Redis connection URL (e.g., redis://user:password@host:port/db)
 * @returns Parsed Redis configuration
 */
function parseRedisUrl(redisUrl: string) {
	try {
		const url = new URL(redisUrl);
		return {
			host: url.hostname,
			port: parseInt(url.port) || 6379,
			password: url.password || undefined,
			db: parseInt(url.pathname.slice(1)) || 0,
		};
	} catch {
		// Fallback to default values if URL parsing fails
		return {
			host: 'localhost',
			port: 6379,
			password: undefined,
			db: 0,
		};
	}
}

export default registerAs('redis', () => {
	const redisUrl = process.env.REDIS_URL;

	if (redisUrl) {
		const parsed = parseRedisUrl(redisUrl);
		return {
			host: parsed.host,
			port: parsed.port,
			password: parsed.password,
			db: parsed.db,
			ttl: parseInt(process.env.REDIS_TTL, 10) || 3600, // Default TTL: 1 hour
		};
	}

	// Fallback to individual environment variables
	return {
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT, 10) || 6379,
		password: process.env.REDIS_PASSWORD,
		db: parseInt(process.env.REDIS_DB, 10) || 0,
		ttl: parseInt(process.env.REDIS_TTL, 10) || 3600, // Default TTL: 1 hour
	};
});
