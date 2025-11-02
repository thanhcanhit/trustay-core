import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsModule } from '../rentals/rentals.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
	imports: [PrismaModule, NotificationsModule, RentalsModule],
	controllers: [BillsController],
	providers: [BillsService],
	exports: [BillsService],
})
export class BillsModule {}
