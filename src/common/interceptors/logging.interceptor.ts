import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { LoggerService } from "../../logger/logger.service";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	constructor(private readonly logger: LoggerService) {}

	intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const startTime = Date.now();

		return next.handle().pipe(
			tap(() => {
				const duration = Date.now() - startTime;
				const { method, originalUrl } = request;
				const { statusCode } = response;

				// Log request
				this.logger.logApiRequest(
					method,
					originalUrl,
					statusCode,
					duration,
					// (request as any).user?.id // If you have auth
				);
			}),
		);
	}
}
