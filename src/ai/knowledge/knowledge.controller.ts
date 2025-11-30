import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { TeachKnowledgeDto } from './dto/teach-knowledge.dto';
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

	@Post('ingest-schema-from-db')
	@ApiOperation({
		summary:
			'Ingest full RAG schema context from DB (JSON schema + reference lookups + denormalized docs)',
		description:
			'Clears old schema chunks, ingests semantic JSON-structured schema chunks (table overview, column details, relationships), then ingests reference data (amenities/cost types/room rules) and denormalized documents (rooms, requests) for rich Vietnamese context',
	})
	async ingestSchemaFromDatabase(
		@Body()
		body?: { tenantId?: string; dbKey?: string; schemaName?: string },
	) {
		const payload = body || {};
		const tenantId = payload.tenantId || '00000000-0000-0000-0000-000000000000';
		const dbKey = payload.dbKey || 'default';
		const schemaName = payload.schemaName || 'public';
		// Build rich RAG context using semantic JSON schema chunks + reference lookup data + denormalized docs
		const [jsonIds, refIds, roomDocIds, requestDocIds] = await Promise.all([
			this.schemaIngestion.ingestSchemaJsonDescriptions(
				tenantId,
				dbKey,
				schemaName,
				'trustay_core',
			),
			this.schemaIngestion.ingestReferenceLookupData(tenantId, dbKey),
			this.schemaIngestion.ingestDenormalizedRoomDocs(tenantId, dbKey),
			this.schemaIngestion.ingestDenormalizedRequestDocs(tenantId, dbKey),
		]);
		return {
			success: true,
			inserted: jsonIds.length + refIds.length + roomDocIds.length + requestDocIds.length,
			jsonSchemaChunks: jsonIds.length,
			referenceDataChunks: refIds.length,
			roomDocsChunks: roomDocIds.length,
			requestDocsChunks: requestDocIds.length,
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

	@Post('teach')
	@ApiOperation({
		summary: 'Admin endpoint to teach the AI system with question and SQL pairs',
		description:
			'Allows admin to actively teach the system by providing question-SQL pairs. The system will learn from these examples and use them for future queries.',
	})
	async teachKnowledge(@Body() dto: TeachKnowledgeDto) {
		const result = await this.knowledge.saveQAInteraction({
			question: dto.question,
			sql: dto.sql,
			sessionId: dto.sessionId,
			userId: dto.userId,
		});
		return {
			success: true,
			message: 'Knowledge taught successfully',
			chunkId: result.chunkId,
			sqlQAId: result.sqlQAId,
			question: dto.question,
		};
	}
}
