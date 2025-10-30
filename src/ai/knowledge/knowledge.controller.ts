import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';
import { SchemaIngestionService } from './schema-ingestion.service';

@ApiTags('AI Knowledge')
@Controller('ai/knowledge')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
	constructor(
		private readonly knowledge: KnowledgeService,
		private readonly schemaIngestion: SchemaIngestionService,
	) {}

	@Post('ingest-schema')
	@ApiOperation({ summary: 'Ingest database schema from static provider into vector store' })
	async ingestSchema() {
		const ids = await this.knowledge.ingestDatabaseSchema();
		return { success: true, inserted: ids.length, ids };
	}

	@Post('ingest-schema-from-db')
	@ApiOperation({
		summary: 'Ingest database schema from information_schema into vector store',
		description:
			'Queries information_schema to extract actual table/column metadata and creates vector embeddings',
	})
	async ingestSchemaFromDatabase(
		@Body()
		body: { tenantId?: string; dbKey?: string; schemaName?: string },
	) {
		const tenantId = body.tenantId || '00000000-0000-0000-0000-000000000000';
		const dbKey = body.dbKey || 'default';
		const schemaName = body.schemaName || 'public';
		const ids = await this.schemaIngestion.ingestSchemaFromDatabase(tenantId, dbKey, schemaName);
		return { success: true, inserted: ids.length, ids, tenantId, dbKey, schemaName };
	}

	@Post('confirm-golden-qa')
	@ApiOperation({ summary: 'Confirm a Q&A as golden (verified correct)' })
	async confirmGoldenQA(
		@Body()
		body: { question: string; sql: string; sessionId?: string; userId?: string },
	) {
		// Save as golden QA - stores in sql_qa and ai_chunks(qa)
		const result = await this.knowledge.saveQAInteraction({
			question: body.question,
			sql: body.sql,
			sessionId: body.sessionId,
			userId: body.userId,
		});
		return {
			success: true,
			message: 'Golden QA saved successfully',
			chunkId: result.chunkId,
			sqlQAId: result.sqlQAId,
		};
	}
}
