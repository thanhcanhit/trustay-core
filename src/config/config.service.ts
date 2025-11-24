import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
	constructor(private configService: NestConfigService) {}

	// App configuration getters
	get port(): number {
		return this.configService.get<number>('app.port')!;
	}

	get environment(): string {
		return this.configService.get<string>('app.environment')!;
	}

	get isDevelopment(): boolean {
		return this.environment === 'development';
	}

	get isProduction(): boolean {
		return this.environment === 'production';
	}

	get logLevel(): string {
		return this.configService.get<string>('app.logLevel')!;
	}

	// Database configuration getters
	get databaseUrl(): string {
		return this.configService.get<string>('database.url')!;
	}

	get databaseConfig() {
		return {
			host: this.configService.get<string>('database.host')!,
			port: this.configService.get<number>('database.port')!,
			username: this.configService.get<string>('database.username')!,
			password: this.configService.get<string>('database.password')!,
			database: this.configService.get<string>('database.name')!,
		};
	}

	// JWT configuration getters
	get jwtSecret(): string {
		return this.configService.get<string>('jwt.secret')!;
	}

	get jwtExpiresIn(): string {
		return this.configService.get<string>('jwt.expiresIn')!;
	}

	get jwtRefreshSecret(): string {
		return this.configService.get<string>('jwt.refreshSecret')!;
	}

	get jwtRefreshExpiresIn(): string {
		return this.configService.get<string>('jwt.refreshExpiresIn')!;
	}

	// Redis configuration getters
	get redisConfig() {
		return {
			host: this.configService.get<string>('redis.host')!,
			port: this.configService.get<number>('redis.port')!,
			password: this.configService.get<string>('redis.password'),
		};
	}

	// Email configuration getters
	get emailConfig() {
		return {
			from: this.configService.get<string>('email.from'),
			apiKey: this.configService.get<string>('email.apiKey'),
		};
	}

	// Upload configuration getters
	get uploadConfig() {
		return {
			maxFileSize: this.configService.get<number>('upload.maxFileSize')!,
			allowedTypes: this.configService.get<string[]>('upload.allowedTypes')!,
		};
	}

	// Rate limiting configuration getters
	get rateLimitConfig() {
		return {
			ttl: this.configService.get<number>('rateLimit.ttl')!,
			limit: this.configService.get<number>('rateLimit.limit')!,
		};
	}

	// AI configuration getters
	get aiConfig() {
		return {
			googleApiKey: this.configService.get<string>('ai.googleApiKey')!,
			temperature: this.configService.get<number>('ai.temperature')!,
			maxTokens: this.configService.get<number>('ai.maxTokens')!,
			limit: this.configService.get<number>('ai.limit')!,
			model: this.configService.get<string>('ai.model')!,
		};
	}

	// Supabase configuration getters
	get supabaseConfig() {
		return {
			url: this.configService.get<string>('supabase.url')!,
			anonKey: this.configService.get<string>('supabase.anonKey')!,
			serviceKey: this.configService.get<string>('supabase.serviceKey'),
		};
	}

	get payosConfig() {
		return {
			clientId: this.configService.get<string>('payos.clientId') ?? '',
			apiKey: this.configService.get<string>('payos.apiKey') ?? '',
			checksumKey: this.configService.get<string>('payos.checksumKey') ?? '',
			returnUrl: this.configService.get<string>('payos.returnUrl') ?? '',
			cancelUrl: this.configService.get<string>('payos.cancelUrl') ?? '',
		};
	}
}
