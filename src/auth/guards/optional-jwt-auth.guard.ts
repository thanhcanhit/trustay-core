import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();

		try {
			// Attempt to authenticate to populate req.user when token is provided
			const result = await super.canActivate(context);
			// If authentication succeeds, req.user will be populated by handleRequest
			return result as boolean;
		} catch (error) {
			// If authentication fails (invalid token, expired, etc.), set user to null
			request.user = null;
			return true; // Allow anonymous access
		}
	}

	handleRequest<TUser = any>(
		err: any,
		user: TUser,
		info: any,
		context: ExecutionContext,
		status?: any,
	): TUser {
		// If there's an error or no user, return null for anonymous access
		if (err || !user) {
			return null as unknown as TUser;
		}
		// If authentication succeeded, return the authenticated user
		return user;
	}
}
