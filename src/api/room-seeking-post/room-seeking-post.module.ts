import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RoomRequestController } from './room-seeking-post.controller';
import { RoomRequestService } from './room-seeking-post.service';

@Module({
	imports: [PrismaModule],
	controllers: [RoomRequestController],
	providers: [RoomRequestService],
	exports: [RoomRequestService],
})
export class RoomRequestModule {}
