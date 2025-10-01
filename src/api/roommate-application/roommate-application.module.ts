import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsModule } from '../rentals/rentals.module';
import { RoommateApplicationController } from './roommate-application.controller';
import { RoommateApplicationService } from './roommate-application.service';

@Module({
	imports: [PrismaModule, NotificationsModule, RentalsModule],
	controllers: [RoommateApplicationController],
	providers: [RoommateApplicationService],
	exports: [RoommateApplicationService],
})
export class RoommateApplicationModule {}
