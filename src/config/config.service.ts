import { Injectable } from "@nestjs/common";
import type { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export class AppConfigService {
	constructor(private configService: NestConfigService) {}

	// App configuration getters
	get port(): number {
		return this.configService.get<number>("app.port")!;
	}

	get environment(): string {
		return this.configService.get<string>("app.environment")!;
	}

	get isDevelopment(): boolean {
		return this.environment === "development";
	}

	get isProduction(): boolean {
		return this.environment === "production";
	}

	get logLevel(): string {
		return this.configService.get<string>("app.logLevel")!;
	}

	// Database configuration getters
	get databaseUrl(): string {
		return this.configService.get<string>("database.url")!;
	}

	get databaseConfig() {
		return {
			host: this.configService.get<string>("database.host")!,
			port: this.configService.get<number>("database.port")!,
			username: this.configService.get<string>("database.username")!,
			password: this.configService.get<string>("database.password")!,
			database: this.configService.get<string>("database.name")!,
		};
	}

	// JWT configuration getters
	get jwtSecret(): string {
		return this.configService.get<string>("jwt.secret")!;
	}

	get jwtExpiresIn(): string {
		return this.configService.get<string>("jwt.expiresIn")!;
	}

	get jwtRefreshSecret(): string {
		return this.configService.get<string>("jwt.refreshSecret")!;
	}

	get jwtRefreshExpiresIn(): string {
		return this.configService.get<string>("jwt.refreshExpiresIn")!;
	}

	// Redis configuration getters
	get redisConfig() {
		return {
			host: this.configService.get<string>("redis.host")!,
			port: this.configService.get<number>("redis.port")!,
			password: this.configService.get<string>("redis.password"),
		};
	}

	// Email configuration getters
	get emailConfig() {
		return {
			from: this.configService.get<string>("email.from"),
			apiKey: this.configService.get<string>("email.apiKey"),
		};
	}

	// Upload configuration getters
	get uploadConfig() {
		return {
			maxFileSize: this.configService.get<number>("upload.maxFileSize")!,
			allowedTypes: this.configService.get<string[]>("upload.allowedTypes")!,
		};
	}
}
