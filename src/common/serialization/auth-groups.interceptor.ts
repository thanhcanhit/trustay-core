import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class AuthSerializationGroupsInterceptor implements NestInterceptor {
	private decodeJwtPayload(token: string): unknown | null {
		try {
			const parts = token.split('.');
			if (parts.length !== 3) {
				return null;
			}
			const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
			const json = Buffer.from(base64, 'base64').toString('utf8');
			return JSON.parse(json);
		} catch {
			return null;
		}
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const req = context.switchToHttp().getRequest();
		let groups: string[] = req?.user ? ['auth'] : [];

		// Fallback: if no req.user, attempt to decode Bearer token to enable auth group
		if (groups.length === 0) {
			const authHeader: string | undefined =
				req?.headers?.authorization || req?.headers?.Authorization;
			const token =
				typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
					? authHeader.slice(7)
					: undefined;
			if (token) {
				const payload = this.decodeJwtPayload(token);
				if (payload) {
					req.user = payload;
					groups = ['auth'];
				}
			}
		}
		return next.handle().pipe(
			map((data: unknown) => {
				if (data === null || data === undefined) {
					return data;
				}
				return instanceToPlain(data as object, {
					groups,
					exposeDefaultValues: true,
					enableCircularCheck: true,
					strategy: 'exposeAll',
				});
			}),
		);
	}
}
