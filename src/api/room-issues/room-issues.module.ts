import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RoomIssuesController } from './room-issues.controller';
import { RoomIssuesService } from './room-issues.service';

@Module({
	imports: [PrismaModule, NotificationsModule],
	controllers: [RoomIssuesController],
	providers: [RoomIssuesService],
	exports: [RoomIssuesService],
})
export class RoomIssuesModule {}
