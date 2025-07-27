import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
	sub: string;
	email: string;
	role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly configService: ConfigService,
		private readonly prisma: PrismaService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
		});
	}

	async validate(payload: JwtPayload) {
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				isVerifiedEmail: true,
				isVerifiedPhone: true,
				isVerifiedIdentity: true,
				isVerifiedBank: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		return user;
	}
}
