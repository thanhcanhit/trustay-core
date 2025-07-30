import { Injectable, type LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, type Logger, transports } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
	private logger: Logger;

	constructor() {
		this.logger = createLogger({
			level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
			format: format.combine(
				format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
				format.errors({ stack: true }),
				format.json(),
			),
			defaultMeta: { service: 'trustay-api' },
			transports: [
				// Console logging with better formatting
				new transports.Console({
					format: format.combine(
						format.colorize(),
						format.timestamp({ format: 'HH:mm:ss' }),
						format.printf(
							({
								timestamp,
								level,
								message,
								context,
								trace,
								...meta
							}: {
								timestamp: string;
								level: string;
								message: string;
								context: string;
								trace: string;
								[key: string]: any;
							}) => {
								const contextStr = context ? `[${context}]` : '[App]';
								const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
								const traceStr = trace ? `\n${trace}` : '';

								return `${timestamp} ${contextStr} ${level}: ${message}${metaStr}${traceStr}`;
							},
						),
					),
				}),
				// File logging for errors
				new transports.File({
					filename: 'logs/error.log',
					level: 'error',
					maxsize: 5242880, // 5MB
					maxFiles: 5,
				}),
				// File logging for all logs
				new transports.File({
					filename: 'logs/combined.log',
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

	// Enhanced methods for specific use cases
	logDbQuery(query: string, params?: unknown[], duration?: number) {
		this.logger.info('Database Query', {
			context: 'Database',
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
		this.logger.info('API Request', {
			context: 'HTTP',
			method,
			url,
			statusCode,
			duration: `${duration}ms`,
			userId,
		});
	}

	logError(error: Error, context?: string, additionalInfo?: Record<string, unknown>) {
		this.logger.error(error.message, {
			context: context || 'Error',
			stack: error.stack,
			...additionalInfo,
		});
	}

	// New methods for better logging
	logAuthEvent(event: string, userId?: string, details?: Record<string, unknown>) {
		this.logger.info(`Auth: ${event}`, {
			context: 'Auth',
			userId,
			...details,
		});
	}

	logBusinessEvent(event: string, context?: string, details?: Record<string, unknown>) {
		this.logger.info(`Business: ${event}`, {
			context: context || 'Business',
			...details,
		});
	}

	logPerformance(
		operation: string,
		duration: number,
		context?: string,
		details?: Record<string, unknown>,
	) {
		const level = duration > 1000 ? 'warn' : 'info';
		this.logger[level](`Performance: ${operation} took ${duration}ms`, {
			context: context || 'Performance',
			duration,
			...details,
		});
	}

	logSecurityEvent(event: string, details?: Record<string, unknown>) {
		this.logger.warn(`Security: ${event}`, {
			context: 'Security',
			...details,
		});
	}
}
