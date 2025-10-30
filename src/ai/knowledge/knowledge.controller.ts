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
		summary: 'Ingest full RAG schema context from DB (JSON schema + reference lookups)',
		description:
			'Clears old schema chunks, ingests JSON-structured schema with samples, then ingests amenities/cost types/room rules for rich Vietnamese context',
	})
	async ingestSchemaFromDatabase(
		@Body()
		body?: { tenantId?: string; dbKey?: string; schemaName?: string },
	) {
		const payload = body || {};
		const tenantId = payload.tenantId || '00000000-0000-0000-0000-000000000000';
		const dbKey = payload.dbKey || 'default';
		const schemaName = payload.schemaName || 'public';
		// Build rich RAG context using JSON schema + reference lookup data
		const jsonIds = await this.schemaIngestion.ingestSchemaJsonDescriptions(
			tenantId,
			dbKey,
			schemaName,
			'trustay_core',
		);
		const refIds = await this.schemaIngestion.ingestReferenceLookupData(tenantId, dbKey);
		return {
			success: true,
			inserted: jsonIds.length + refIds.length,
			jsonInserted: jsonIds.length,
			refInserted: refIds.length,
			tenantId,
			dbKey,
			schemaName,
		};
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
