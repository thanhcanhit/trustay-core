import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import type { RedisOptions } from 'ioredis';
import { HttpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { AuthCacheService } from './services/auth-cache.service';
import { CacheService } from './services/cache.service';
import { RateLimitService } from './services/rate-limit.service';
import { UserStatusService } from './services/user-status.service';

@Global()
@Module({
	imports: [
		NestCacheModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => {
				const redisConfig: RedisOptions = {
					host: configService.get<string>('redis.host'),
					port: configService.get<number>('redis.port'),
					password: configService.get<string>('redis.password'),
				};

				return {
					store: await redisStore(redisConfig),
					ttl: 3600 * 1000, // Default 1 hour
				};
			},
			isGlobal: true,
		}),
	],
	providers: [
		CacheService,
		AuthCacheService,
		RateLimitService,
		UserStatusService,
		HttpCacheInterceptor,
	],
	exports: [
		NestCacheModule,
		CacheService,
		AuthCacheService,
		RateLimitService,
		UserStatusService,
		HttpCacheInterceptor,
	],
})
export class CacheConfigModule {}
