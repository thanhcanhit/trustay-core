import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailService } from './services/email.service';
import { PasswordService } from './services/password.service';
import { SmsService } from './services/sms.service';
import { VerificationService } from './services/verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { VerificationController } from './verification.controller';

@Module({
	imports: [
		PrismaModule,
		PassportModule,
		LoggerModule,
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
	controllers: [AuthController, VerificationController],
	providers: [
		AuthService,
		PasswordService,
		VerificationService,
		EmailService,
		SmsService,
		JwtStrategy,
		JwtAuthGuard,
	],
	exports: [
		AuthService,
		PasswordService,
		VerificationService,
		EmailService,
		SmsService,
		JwtAuthGuard,
	],
})
export class AuthModule {}
