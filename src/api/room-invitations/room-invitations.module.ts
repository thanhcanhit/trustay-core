import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RoomInvitationsController } from './room-invitations.controller';
import { RoomInvitationsService } from './room-invitations.service';

@Module({
	imports: [PrismaModule, NotificationsModule],
	controllers: [RoomInvitationsController],
	providers: [RoomInvitationsService],
	exports: [RoomInvitationsService],
})
export class RoomInvitationsModule {}
