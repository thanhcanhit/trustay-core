import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
	imports: [PrismaModule, KnowledgeModule],
	controllers: [AiController],
	providers: [AiService],
})
export class AiModule {}
