import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RoomSeekingPostController } from './room-seeking-post.controller';
import { RoomSeekingPostService } from './room-seeking-post.service';

@Module({
	imports: [PrismaModule],
	controllers: [RoomSeekingPostController],
	providers: [RoomSeekingPostService],
	exports: [RoomSeekingPostService],
})
export class RoomSeekingPostModule {}
