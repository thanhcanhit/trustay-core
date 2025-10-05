import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoggerService } from '@/logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	constructor(private readonly logger: LoggerService) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		let status: number;
		let message: string | object;

		// Handle ThrottlerException with cleaner message
		if (exception instanceof ThrottlerException) {
			status = HttpStatus.TOO_MANY_REQUESTS;
			message = {
				message: 'Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
				error: 'Too Many Requests',
				statusCode: 429,
			};
		} else if (exception instanceof HttpException) {
			status = exception.getStatus();
			message = exception.getResponse();
		} else {
			status = HttpStatus.INTERNAL_SERVER_ERROR;
			message = 'Internal server error';
		}

		const errorResponse = {
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			method: request.method,
			message,
		};

		// Log the error with HTTP context
		const error = exception instanceof Error ? exception : new Error(String(exception));

		// Extract userId from request if available (assuming JWT is used)
		const userId = (request as any).user?.id || (request as any).user?.userId;

		// Generate or extract request ID
		const requestId =
			request.get('X-Request-ID') || request.get('x-correlation-id') || `req_${Date.now()}`;

		// For throttler exceptions, use a simpler log message
		if (exception instanceof ThrottlerException) {
			this.logger.warn(
				`Rate limit exceeded for ${request.ip} on ${request.method} ${request.url} - User: ${userId || 'anonymous'}`,
				'ThrottlerGuard',
			);
		} else if (exception instanceof HttpException && status === HttpStatus.NOT_FOUND) {
			// For 404 errors, use a simpler log message
			this.logger.warn(
				`Resource not found: ${request.method} ${request.url} - User: ${userId || 'anonymous'}`,
				'NotFound',
			);
		} else {
			this.logger.logHttpError(
				error,
				request.method,
				request.url,
				status,
				userId,
				request.get('User-Agent'),
				request.ip,
				requestId,
				{
					body: request.method !== 'GET' ? request.body : undefined,
					query: request.query,
					params: request.params,
				},
			);
		}

		response.status(status).json(errorResponse);
	}
}
