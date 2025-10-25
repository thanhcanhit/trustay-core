import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsModule } from '../rentals/rentals.module';
import { RoomBookingsController } from './room-booking';
import { BookingRequestsService } from './room-booking.service';

@Module({
	imports: [PrismaModule, NotificationsModule, RentalsModule],
	controllers: [RoomBookingsController],
	providers: [BookingRequestsService],
	exports: [BookingRequestsService],
})
export class RoomBookingsModule {}
