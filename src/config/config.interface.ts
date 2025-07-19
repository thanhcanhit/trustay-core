export interface AppConfig {
	port: number;
	environment: string;
	logLevel: string;
}

export interface DatabaseConfig {
	url: string;
	host: string;
	port: number;
	username: string;
	password: string;
	name: string;
}

export interface JwtConfig {
	secret: string;
	expiresIn: string;
	refreshSecret?: string;
	refreshExpiresIn: string;
}

export interface RedisConfig {
	host: string;
	port: number;
	password?: string;
}

export interface EmailConfig {
	from?: string;
	apiKey?: string;
}

export interface UploadConfig {
	maxFileSize: number;
	allowedTypes: string[];
}

export interface Config {
	app: AppConfig;
	database: DatabaseConfig;
	jwt: JwtConfig;
	redis: RedisConfig;
	email: EmailConfig;
	upload: UploadConfig;
}
