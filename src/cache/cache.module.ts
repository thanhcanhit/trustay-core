import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import type { RedisOptions } from 'ioredis';
import redisConfig from '../config/redis.config';
import { HttpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { AuthCacheService } from './services/auth-cache.service';
import { CacheService } from './services/cache.service';
import { RateLimitService } from './services/rate-limit.service';
import { UserStatusService } from './services/user-status.service';

@Global()
@Module({
	imports: [
		NestCacheModule.registerAsync({
			imports: [ConfigModule.forFeature(redisConfig)],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => {
				const redisOptions: RedisOptions = {
					host: configService.get<string>('redis.host'),
					port: configService.get<number>('redis.port'),
					password: configService.get<string>('redis.password'),
					db: configService.get<number>('redis.db'),
				};

				return {
					store: await redisStore(redisOptions),
					ttl: configService.get<number>('redis.ttl') * 1000, // Convert to milliseconds
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
