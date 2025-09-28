import { Injectable, type LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, type Logger, transports } from 'winston';

interface ErrorLogData {
	message: string;
	stack?: string;
	level?: string;
	context?: string;
	method?: string;
	url?: string;
	statusCode?: number;
	userId?: string;
	userAgent?: string;
	ipAddress?: string;
	requestId?: string;
	metadata?: Record<string, unknown>;
}

@Injectable()
export class LoggerService implements NestLoggerService {
	private logger: Logger;
	private prismaService?: any; // We'll inject this lazily to avoid circular dependency

	private safeStringify(value: unknown): string {
		try {
			const seen = new WeakSet<object>();
			return JSON.stringify(value, (_key: string, val: unknown) => {
				if (typeof val === 'object' && val !== null) {
					if (seen.has(val as object)) {
						return '[Circular]';
					}
					seen.add(val as object);
				}
				return val as unknown as Record<string, unknown>;
			});
		} catch {
			return String(value);
		}
	}

	private formatMessage(input: unknown): string {
		if (typeof input === 'string') {
			return input;
		}
		if (input instanceof Error) {
			return input.message;
		}
		if (
			input &&
			typeof input === 'object' &&
			'message' in (input as Record<string, unknown>) &&
			typeof (input as Record<string, unknown>).message === 'string'
		) {
			return (input as Record<string, unknown>).message as string;
		}
		return this.safeStringify(input);
	}

	private extractStack(input: unknown, fallback?: string): string | undefined {
		if (typeof fallback === 'string' && fallback.length > 0) {
			return fallback;
		}
		if (input instanceof Error) {
			return input.stack;
		}
		if (
			input &&
			typeof input === 'object' &&
			'stack' in (input as Record<string, unknown>) &&
			typeof (input as Record<string, unknown>).stack === 'string'
		) {
			return (input as Record<string, unknown>).stack as string;
		}
		return undefined;
	}

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

	// Method to inject PrismaService lazily to avoid circular dependency
	setPrismaService(prismaService: any) {
		this.prismaService = prismaService;
	}

	// Save error to database
	private async saveErrorToDatabase(errorData: ErrorLogData): Promise<void> {
		if (!this.prismaService) {
			return; // Prisma service not available, skip database logging
		}

		try {
			await this.prismaService.errorLog.create({
				data: {
					message: errorData.message,
					stack: errorData.stack,
					level: errorData.level || 'error',
					context: errorData.context,
					method: errorData.method,
					url: errorData.url,
					statusCode: errorData.statusCode,
					userId: errorData.userId,
					userAgent: errorData.userAgent,
					ipAddress: errorData.ipAddress,
					requestId: errorData.requestId,
					metadata: errorData.metadata,
				},
			});
		} catch (dbError) {
			// If database logging fails, just log to winston without recursion
			this.logger.error('Failed to save error to database', {
				context: 'ErrorLogger',
				originalError: errorData.message,
				dbError: dbError instanceof Error ? dbError.message : String(dbError),
			});
		}
	}

	log(message: unknown, context?: string) {
		const messageStr: string = this.formatMessage(message);
		this.logger.info(messageStr, { context });
	}

	error(message: unknown, trace?: string, context?: string) {
		const messageStr: string = this.formatMessage(message);
		const stackStr: string | undefined = this.extractStack(message, trace);
		this.logger.error(messageStr, { context, trace: stackStr });

		this.saveErrorToDatabase({
			message: messageStr,
			stack: stackStr,
			level: 'error',
			context,
		});
	}

	warn(message: unknown, context?: string) {
		const messageStr: string = this.formatMessage(message);
		this.logger.warn(messageStr, { context });

		this.saveErrorToDatabase({
			message: messageStr,
			level: 'warn',
			context,
		});
	}

	debug(message: unknown, context?: string) {
		const messageStr: string = this.formatMessage(message);
		this.logger.debug(messageStr, { context });
	}

	verbose(message: unknown, context?: string) {
		const messageStr: string = this.formatMessage(message);
		this.logger.verbose(messageStr, { context });
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

		// Save to database with additional info
		this.saveErrorToDatabase({
			message: error.message,
			stack: error.stack,
			level: 'error',
			context: context || 'Error',
			metadata: additionalInfo,
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

	// Enhanced method for HTTP request errors
	logHttpError(
		error: Error,
		method?: string,
		url?: string,
		statusCode?: number,
		userId?: string,
		userAgent?: string,
		ipAddress?: string,
		requestId?: string,
		additionalInfo?: Record<string, unknown>,
	) {
		this.logger.error(`HTTP Error: ${error.message}`, {
			context: 'HTTP',
			method,
			url,
			statusCode,
			userId,
			userAgent,
			ipAddress,
			requestId,
			stack: error.stack,
			...additionalInfo,
		});

		// Save to database with full HTTP context
		this.saveErrorToDatabase({
			message: error.message,
			stack: error.stack,
			level: 'error',
			context: 'HTTP',
			method,
			url,
			statusCode,
			userId,
			userAgent,
			ipAddress,
			requestId,
			metadata: additionalInfo,
		});
	}

	// Method to log server errors specifically
	logServerError(
		message: string,
		stack?: string,
		method?: string,
		url?: string,
		statusCode?: number,
		userId?: string,
		userAgent?: string,
		ipAddress?: string,
		requestId?: string,
		additionalInfo?: Record<string, unknown>,
	) {
		this.logger.error(`Server Error: ${message}`, {
			context: 'Server',
			method,
			url,
			statusCode,
			userId,
			userAgent,
			ipAddress,
			requestId,
			stack,
			...additionalInfo,
		});

		// Save to database
		this.saveErrorToDatabase({
			message,
			stack,
			level: 'error',
			context: 'Server',
			method,
			url,
			statusCode,
			userId,
			userAgent,
			ipAddress,
			requestId,
			metadata: additionalInfo,
		});
	}
}
