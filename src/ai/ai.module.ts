import { Module } from '@nestjs/common';
import { BuildingModule } from '../api/buildings/building.module';
import { AddressModule } from '../api/provinces/address/address.module';
import { ReferenceModule } from '../api/reference/reference.module';
import { RoomsModule } from '../api/rooms/rooms.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChatSessionController } from './chat-session.controller';
import { ConversationController } from './conversation.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AiProcessingLogService } from './services/ai-processing-log.service';
import { ChatSessionService } from './services/chat-session.service';
import { PendingKnowledgeService } from './services/pending-knowledge.service';
import { RoomPublishingService } from './services/room-publishing.service';

@Module({
	imports: [
		PrismaModule,
		QueueModule, // Import QueueModule để có thể inject ChatSessionQueueService
		KnowledgeModule,
		BuildingModule,
		RoomsModule,
		AddressModule,
		ReferenceModule,
	],
	controllers: [AiController, ChatSessionController, ConversationController],
	providers: [
		AiService,
		RoomPublishingService,
		AiProcessingLogService,
		PendingKnowledgeService,
		ChatSessionService,
	],
	exports: [
		AiProcessingLogService,
		PendingKnowledgeService,
		ChatSessionService, // Export để QueueModule có thể sử dụng
	],
})
export class AiModule {}
