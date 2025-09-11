import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { NotificationFactory } from './helpers/notification-factory';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
	imports: [PrismaModule, RealtimeModule],
	controllers: [NotificationsController],
	providers: [NotificationsService, NotificationFactory],
	exports: [NotificationsService, NotificationFactory],
})
export class NotificationsModule {}
