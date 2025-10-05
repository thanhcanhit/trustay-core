import {
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
} from '@nestjs/common';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class DailyBookingLimitGuard implements CanActivate {
	constructor(private readonly rateLimitService: RateLimitService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const userId = request.user?.sub || request.user?.id;

		if (!userId) {
			// If no user, let other guards handle auth
			return true;
		}

		const result = await this.rateLimitService.checkDailyBookingLimit(userId, 10);

		if (!result.allowed) {
			throw new HttpException(
				{
					statusCode: HttpStatus.TOO_MANY_REQUESTS,
					message: `Bạn đã vượt quá giới hạn ${result.limit} yêu cầu đặt phòng mỗi ngày. Vui lòng thử lại sau.`,
					error: 'Too Many Requests',
					limit: result.limit,
					current: result.current,
					resetAt: result.resetAt,
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		// Add rate limit info to request for logging/response headers
		request.rateLimit = {
			limit: result.limit,
			remaining: result.remaining,
			resetAt: result.resetAt,
		};

		return true;
	}
}
