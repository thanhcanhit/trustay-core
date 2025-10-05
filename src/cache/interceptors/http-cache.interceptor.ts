import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from '../decorators/cache-key.decorator';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private reflector: Reflector,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const cacheKey = this.reflector.get<string>(CACHE_KEY_METADATA, context.getHandler());

		if (!cacheKey) {
			return next.handle();
		}

		const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler());

		const request = context.switchToHttp().getRequest();
		const key = this.buildCacheKey(cacheKey, request);

		const cachedResponse = await this.cacheManager.get(key);
		if (cachedResponse) {
			return of(cachedResponse);
		}

		return next.handle().pipe(
			tap(async (response) => {
				if (response) {
					await this.cacheManager.set(key, response, ttl ? ttl * 1000 : undefined);
				}
			}),
		);
	}

	private buildCacheKey(baseKey: string, request: any): string {
		const queryParams = request.query || {};
		const params = request.params || {};

		const queryString = Object.keys(queryParams).length ? `:${JSON.stringify(queryParams)}` : '';

		const paramsString = Object.keys(params).length ? `:${JSON.stringify(params)}` : '';

		return `${baseKey}${paramsString}${queryString}`;
	}
}
