import { Injectable, Logger } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '../constants';
import { CacheService } from './cache.service';

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	current: number;
	remaining: number;
	resetAt: Date;
}

@Injectable()
export class RateLimitService {
	private readonly logger = new Logger(RateLimitService.name);

	constructor(private readonly cacheService: CacheService) {}

	/**
	 * Check and increment rate limit for login attempts
	 */
	async checkLoginAttempt(identifier: string, maxAttempts = 5): Promise<RateLimitResult> {
		const key = CACHE_KEYS.RATE_LIMIT_LOGIN(identifier);
		const ttl = CACHE_TTL.LOGIN_ATTEMPT_WINDOW;

		return this.checkAndIncrement(key, maxAttempts, ttl);
	}

	/**
	 * Check daily booking limit (10 requests per day)
	 */
	async checkDailyBookingLimit(userId: string, maxBookings = 10): Promise<RateLimitResult> {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const key = CACHE_KEYS.DAILY_BOOKING_COUNT(userId, today);
		const ttl = CACHE_TTL.DAILY_LIMIT_WINDOW;

		const result = await this.checkAndIncrement(key, maxBookings, ttl);

		if (!result.allowed) {
			this.logger.warn(`User ${userId} exceeded daily booking limit (${maxBookings})`);
		}

		return result;
	}

	/**
	 * Check API rate limit per user/endpoint
	 */
	async checkApiLimit(
		userId: string,
		endpoint: string,
		maxRequests = 100,
	): Promise<RateLimitResult> {
		const key = CACHE_KEYS.RATE_LIMIT_API(userId, endpoint);
		const ttl = CACHE_TTL.RATE_LIMIT_WINDOW;

		return this.checkAndIncrement(key, maxRequests, ttl);
	}

	/**
	 * Generic rate limit checker with increment
	 */
	private async checkAndIncrement(
		key: string,
		limit: number,
		ttl: number,
	): Promise<RateLimitResult> {
		const current = await this.cacheService.get<number>(key);
		const count = current ? current + 1 : 1;

		if (count === 1) {
			// First request, set with TTL
			await this.cacheService.set(key, count, ttl);
		} else {
			// Increment existing counter (keep original TTL)
			await this.cacheService.set(key, count, ttl);
		}

		const allowed = count <= limit;
		const remaining = Math.max(0, limit - count);
		const resetAt = new Date(Date.now() + ttl * 1000);

		this.logger.debug(
			`Rate limit check: ${key} - ${count}/${limit} (${allowed ? 'ALLOWED' : 'BLOCKED'})`,
		);

		return {
			allowed,
			limit,
			current: count,
			remaining,
			resetAt,
		};
	}

	/**
	 * Reset rate limit for a specific key
	 */
	async reset(key: string): Promise<void> {
		await this.cacheService.del(key);
		this.logger.debug(`Rate limit reset: ${key}`);
	}

	/**
	 * Reset login attempts for user
	 */
	async resetLoginAttempts(identifier: string): Promise<void> {
		const key = CACHE_KEYS.RATE_LIMIT_LOGIN(identifier);
		await this.reset(key);
	}

	/**
	 * Get current rate limit status without incrementing
	 */
	async getStatus(key: string, limit: number, ttl: number): Promise<RateLimitResult> {
		const current = (await this.cacheService.get<number>(key)) || 0;
		const allowed = current < limit;
		const remaining = Math.max(0, limit - current);
		const resetAt = new Date(Date.now() + ttl * 1000);

		return {
			allowed,
			limit,
			current,
			remaining,
			resetAt,
		};
	}
}
