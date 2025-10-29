import { Controller, Post } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('ai/knowledge')
export class KnowledgeController {
	constructor(private readonly knowledge: KnowledgeService) {}

	@Post('ingest-schema')
	async ingestSchema() {
		const ids = await this.knowledge.ingestDatabaseSchema();
		return { success: true, inserted: ids.length, ids };
	}
}
