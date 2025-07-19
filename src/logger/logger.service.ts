import {
	Injectable,
	type LoggerService as NestLoggerService,
} from "@nestjs/common";
import { createLogger, format, type Logger, transports } from "winston";

@Injectable()
export class LoggerService implements NestLoggerService {
	private logger: Logger;

	constructor() {
		this.logger = createLogger({
			level: process.env.NODE_ENV === "production" ? "info" : "debug",
			format: format.combine(
				format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
				format.errors({ stack: true }),
				format.json(),
			),
			defaultMeta: { service: "nestjs-app" },
			transports: [
				// Console logging
				new transports.Console({
					format: format.combine(
						format.colorize(),
						format.simple(),
						format.printf(
							({
								timestamp,
								level,
								message,
								context,
								trace,
							}: {
								timestamp: string;
								level: string;
								message: string;
								context: string;
								trace: string;
							}) => {
								return `${timestamp} [${
									context || "Application"
								}] ${level}: ${message}${trace ? `\n${trace}` : ""}`;
							},
						),
					),
				}),
				// File logging for errors
				new transports.File({
					filename: "logs/error.log",
					level: "error",
					maxsize: 5242880, // 5MB
					maxFiles: 5,
				}),
				// File logging for all logs
				new transports.File({
					filename: "logs/combined.log",
					maxsize: 5242880, // 5MB
					maxFiles: 5,
				}),
			],
		});
	}

	log(message: string, context?: string) {
		this.logger.info(message, { context });
	}

	error(message: string, trace?: string, context?: string) {
		this.logger.error(message, { context, trace });
	}

	warn(message: string, context?: string) {
		this.logger.warn(message, { context });
	}

	debug(message: string, context?: string) {
		this.logger.debug(message, { context });
	}

	verbose(message: string, context?: string) {
		this.logger.verbose(message, { context });
	}

	// Custom methods for specific use cases
	logDbQuery(query: string, params?: any[], duration?: number) {
		this.logger.info("Database Query", {
			context: "Database",
			query,
			params,
			duration: duration ? `${duration}ms` : undefined,
		});
	}

	logApiRequest(
		method: string,
		url: string,
		statusCode: number,
		duration: number,
		userId?: string,
	) {
		this.logger.info("API Request", {
			context: "HTTP",
			method,
			url,
			statusCode,
			duration: `${duration}ms`,
			userId,
		});
	}

	logError(
		error: Error,
		context?: string,
		additionalInfo?: Record<string, any>,
	) {
		this.logger.error(error.message, {
			context: context || "Error",
			stack: error.stack,
			...additionalInfo,
		});
	}
}
