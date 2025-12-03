import { Module } from '@nestjs/common';
import { BuildingModule } from '../api/buildings/building.module';
import { AddressModule } from '../api/provinces/address/address.module';
import { ReferenceModule } from '../api/reference/reference.module';
import { RoomsModule } from '../api/rooms/rooms.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AiProcessingLogService } from './services/ai-processing-log.service';
import { RoomPublishingService } from './services/room-publishing.service';

@Module({
	imports: [
		PrismaModule,
		KnowledgeModule,
		BuildingModule,
		RoomsModule,
		AddressModule,
		ReferenceModule,
	],
	controllers: [AiController],
	providers: [AiService, RoomPublishingService, AiProcessingLogService],
	exports: [AiProcessingLogService], // Export để có thể dùng ở module khác nếu cần
})
export class AiModule {}
