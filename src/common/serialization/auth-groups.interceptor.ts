import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class AuthSerializationGroupsInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const req = context.switchToHttp().getRequest();
		const groups: string[] = req?.user ? ['auth'] : [];
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
