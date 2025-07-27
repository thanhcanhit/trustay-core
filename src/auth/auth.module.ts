import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './services/password.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
	imports: [
		PrismaModule,
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
				signOptions: {
					expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1h',
				},
			}),
			inject: [ConfigService],
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, PasswordService, JwtStrategy, JwtAuthGuard],
	exports: [AuthService, PasswordService, JwtAuthGuard],
})
export class AuthModule {}
