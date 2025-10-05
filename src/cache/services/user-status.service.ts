import { Injectable, Logger } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '../constants';
import { CacheService } from './cache.service';

export interface UserStatus {
	userId: string;
	isOnline: boolean;
	lastActiveAt: Date;
}

@Injectable()
export class UserStatusService {
	private readonly logger = new Logger(UserStatusService.name);

	constructor(private readonly cacheService: CacheService) {}

	/**
	 * Set user as online
	 */
	async setUserOnline(userId: string): Promise<void> {
		const key = CACHE_KEYS.USER_ONLINE(userId);
		const lastActiveKey = CACHE_KEYS.USER_LAST_ACTIVE(userId);
		const now = new Date();

		await Promise.all([
			this.cacheService.set(key, true, CACHE_TTL.USER_ONLINE_TTL),
			this.cacheService.set(lastActiveKey, now.toISOString(), CACHE_TTL.USER_ONLINE_TTL * 2),
		]);

		this.logger.debug(`User ${userId} set as online`);
	}

	/**
	 * Set user as offline
	 */
	async setUserOffline(userId: string): Promise<void> {
		const key = CACHE_KEYS.USER_ONLINE(userId);
		const lastActiveKey = CACHE_KEYS.USER_LAST_ACTIVE(userId);
		const now = new Date();

		await Promise.all([
			this.cacheService.del(key),
			this.cacheService.set(lastActiveKey, now.toISOString(), 86400), // Keep for 24h
		]);

		this.logger.debug(`User ${userId} set as offline`);
	}

	/**
	 * Check if user is online
	 */
	async isUserOnline(userId: string): Promise<boolean> {
		const key = CACHE_KEYS.USER_ONLINE(userId);
		const online = await this.cacheService.get<boolean>(key);
		return online === true;
	}

	/**
	 * Get user status
	 */
	async getUserStatus(userId: string): Promise<UserStatus> {
		const [isOnline, lastActiveStr] = await Promise.all([
			this.isUserOnline(userId),
			this.cacheService.get<string>(CACHE_KEYS.USER_LAST_ACTIVE(userId)),
		]);

		const lastActiveAt = lastActiveStr ? new Date(lastActiveStr) : new Date();

		return {
			userId,
			isOnline,
			lastActiveAt,
		};
	}

	/**
	 * Get multiple users status
	 */
	async getBulkUserStatus(userIds: string[]): Promise<Map<string, UserStatus>> {
		const statusMap = new Map<string, UserStatus>();

		await Promise.all(
			userIds.map(async (userId) => {
				const status = await this.getUserStatus(userId);
				statusMap.set(userId, status);
			}),
		);

		return statusMap;
	}

	/**
	 * Update last active timestamp (called on each API request)
	 */
	async updateLastActive(userId: string): Promise<void> {
		const key = CACHE_KEYS.USER_LAST_ACTIVE(userId);
		const now = new Date();

		await this.cacheService.set(key, now.toISOString(), CACHE_TTL.USER_ONLINE_TTL * 2);
		// Don't log to avoid spam
	}

	/**
	 * Heartbeat - keep user online and update last active
	 */
	async heartbeat(userId: string): Promise<void> {
		await this.setUserOnline(userId);
	}
}
