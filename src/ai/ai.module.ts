import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { RoomPublishingService } from './services/room-publishing.service';

@Module({
	imports: [PrismaModule, KnowledgeModule],
	controllers: [AiController],
	providers: [AiService, RoomPublishingService],
})
export class AiModule {}
