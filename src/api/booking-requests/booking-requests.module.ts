import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsModule } from '../rentals/rentals.module';
import { BookingRequestsController } from './booking-requests.controller';
import { BookingRequestsService } from './booking-requests.service';

@Module({
	imports: [PrismaModule, NotificationsModule, RentalsModule],
	controllers: [BookingRequestsController],
	providers: [BookingRequestsService],
	exports: [BookingRequestsService],
})
export class BookingRequestsModule {}
