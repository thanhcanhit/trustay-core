import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '@/logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	constructor(private readonly logger: LoggerService) {}

	intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const startTime = Date.now();

		// Extract useful request information
		const { method, originalUrl, ip, headers, body, query, params } = request;
		const userAgent = headers['user-agent'];
		const userId = (request as any).user?.id;

		// Log incoming request
		this.logger.log(`${method} ${originalUrl} - Incoming request from ${ip}`, 'HTTP');

		return next.handle().pipe(
			tap({
				next: (data) => {
					const duration = Date.now() - startTime;
					const { statusCode } = response;
					const contentLength = response.get('content-length') || 0;

					// Log successful response
					this.logger.log(
						`${method} ${originalUrl} - ${statusCode} - ${duration}ms - ${contentLength}b`,
						'HTTP',
					);

					// Log detailed request info for debugging
					if (process.env.NODE_ENV === 'development') {
						this.logger.debug(
							`Request details: ${JSON.stringify({
								method,
								url: originalUrl,
								ip,
								userAgent,
								userId,
								query: Object.keys(query).length > 0 ? query : undefined,
								params: Object.keys(params).length > 0 ? params : undefined,
								body: method !== 'GET' ? body : undefined,
							})}`,
							'HTTP',
						);
					}
				},
				error: (error) => {
					const duration = Date.now() - startTime;
					const { statusCode } = response;

					// Log error response
					this.logger.error(
						`${method} ${originalUrl} - ${statusCode} - ${duration}ms - Error: ${error.message}`,
						error.stack,
						'HTTP',
					);
				},
			}),
		);
	}
}
