import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContractsModule } from '../contracts/contracts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsModule } from '../rentals/rentals.module';
import { RoomInvitationsController } from './room-invitations.controller';
import { RoomInvitationsService } from './room-invitations.service';

@Module({
	imports: [PrismaModule, NotificationsModule, ContractsModule, RentalsModule],
	controllers: [RoomInvitationsController],
	providers: [RoomInvitationsService],
	exports: [RoomInvitationsService],
})
export class RoomInvitationsModule {}
