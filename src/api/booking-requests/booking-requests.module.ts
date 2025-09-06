import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingRequestsController } from './booking-requests.controller';
import { BookingRequestsService } from './booking-requests.service';

@Module({
	imports: [PrismaModule, NotificationsModule],
	controllers: [BookingRequestsController],
	providers: [BookingRequestsService],
	exports: [BookingRequestsService],
})
export class BookingRequestsModule {}
