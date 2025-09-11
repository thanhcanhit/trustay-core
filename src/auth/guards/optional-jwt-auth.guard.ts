import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
	async canActivate(context: ExecutionContext) {
		try {
			// Attempt to authenticate to populate req.user when token is provided
			await super.canActivate(context);
		} catch {
			// Swallow errors to allow anonymous access
		}
		// Always allow the request to proceed (public route behavior)
		return true;
	}

	handleRequest<TUser = any>(
		_err: any,
		user: TUser,
		_info: any,
		_context: ExecutionContext,
		_status?: any,
	): TUser {
		// If authentication succeeded, user will be defined; otherwise return null to indicate anonymous
		return (user ?? (null as unknown as TUser)) as TUser;
	}
}
