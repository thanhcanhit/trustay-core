import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { registerVectorStoreModule } from '../vector-store/vector-store.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { SchemaIngestionService } from './schema-ingestion.service';

@Module({
	imports: [
		PrismaModule,
		registerVectorStoreModule({
			tenantId: '00000000-0000-0000-0000-000000000000',
			dbKey: 'default',
		}),
	],
	controllers: [KnowledgeController],
	providers: [KnowledgeService, SchemaIngestionService],
	exports: [KnowledgeService, SchemaIngestionService],
})
export class KnowledgeModule {}
