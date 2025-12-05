import { Module } from '@nestjs/common';
import { AiModule } from '../../../ai/ai.module';
import { KnowledgeModule } from '../../../ai/knowledge/knowledge.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AdminAiController } from './admin-ai.controller';

@Module({
	imports: [PrismaModule, KnowledgeModule, AiModule],
	controllers: [AdminAiController],
})
export class AdminAiModule {}
