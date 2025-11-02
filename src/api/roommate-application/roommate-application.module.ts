import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsModule } from '../rentals/rentals.module';
import { RoommateApplicationController } from './roommate-application.controller';
import { RoommateApplicationService } from './roommate-application.service';

@Module({
	imports: [
		PrismaModule,
		NotificationsModule,
		RentalsModule,
		ConfigModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
				signOptions: { expiresIn: '30d' },
			}),
			inject: [ConfigService],
		}),
	],
	controllers: [RoommateApplicationController],
	providers: [RoommateApplicationService],
	exports: [RoommateApplicationService],
})
export class RoommateApplicationModule {}
