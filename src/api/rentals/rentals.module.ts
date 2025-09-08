import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({
	imports: [PrismaModule, NotificationsModule],
	controllers: [RentalsController],
	providers: [RentalsService],
	exports: [RentalsService],
})
export class RentalsModule {}
