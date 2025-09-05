import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoggerService } from '@/logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	constructor(private readonly logger: LoggerService) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const status =
			exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

		const message =
			exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

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

		response.status(status).json(errorResponse);
	}
}
