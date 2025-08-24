import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RoomRequestController } from './room-request.controller';
import { RoomRequestService } from './room-request.service';

@Module({
	imports: [PrismaModule],
	controllers: [RoomRequestController],
	providers: [RoomRequestService],
	exports: [RoomRequestService],
})
export class RoomRequestModule {}
