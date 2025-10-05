import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CacheService {
	private readonly logger = new Logger(CacheService.name);

	constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

	async get<T>(key: string): Promise<T | undefined> {
		const value = await this.cacheManager.get<T>(key);
		if (value) {
			this.logger.debug(`Cache HIT: ${key}`);
		} else {
			this.logger.debug(`Cache MISS: ${key}`);
		}
		return value;
	}

	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		await this.cacheManager.set(key, value, ttl ? ttl * 1000 : undefined);
		this.logger.debug(`Cache SET: ${key} (TTL: ${ttl ? `${ttl}s` : 'default'})`);
	}

	async del(key: string): Promise<void> {
		await this.cacheManager.del(key);
	}

	async delPattern(pattern: string): Promise<void> {
		// Cache manager v7 uses Keyv, need to access store differently
		const stores = (this.cacheManager as any).stores;
		if (stores && stores[0]) {
			const store = stores[0];
			if (store.opts && store.opts.store && typeof store.opts.store.keys === 'function') {
				const keys = await store.opts.store.keys(pattern);
				if (keys && keys.length > 0) {
					await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
				}
			}
		}
	}

	async reset(): Promise<void> {
		// Cache manager v7 uses clear() instead of reset()
		const stores = (this.cacheManager as any).stores;
		if (stores && stores.length > 0) {
			await Promise.all(stores.map((store: any) => store.clear()));
		}
	}

	async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached) {
			return cached;
		}

		this.logger.debug(`Cache WRAP executing function for: ${key}`);
		const result = await fn();
		await this.set(key, result, ttl);
		return result;
	}
}
