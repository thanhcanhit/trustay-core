import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	ParseIntPipe,
	Post,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
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
		summary: 'Dạy hệ thống AI với cặp câu hỏi và SQL',
		description: `API cho phép admin chủ động dạy hệ thống AI bằng cách nạp các cặp câu hỏi và SQL tương ứng.
		
**Cách sử dụng:**
1. Nhập câu hỏi bằng tiếng Việt mà người dùng có thể hỏi
2. Nhập câu lệnh SQL tương ứng (PostgreSQL syntax)
3. Hệ thống sẽ lưu vào vector store để học và sử dụng cho các truy vấn tương tự sau này

**Lưu ý:**
- SQL phải sử dụng đúng cú pháp PostgreSQL
- Câu hỏi nên rõ ràng, mô tả đúng ý định của SQL
- Hệ thống sẽ tự động phát hiện và bỏ qua các cặp Q&A trùng lặp`,
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Dạy thành công',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Knowledge taught successfully' },
				chunkId: { type: 'number', example: 12345, description: 'ID của chunk trong vector store' },
				sqlQAId: { type: 'number', example: 67890, description: 'ID của SQL QA entry' },
				question: { type: 'string', example: 'Tìm tất cả các phòng có giá dưới 5 triệu ở quận 1' },
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Dữ liệu đầu vào không hợp lệ',
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

	@Delete('knowledge/:type/:id')
	@ApiOperation({
		summary: 'Delete knowledge (chunk or SQL QA)',
		description: `Delete a knowledge entry (chunk or SQL QA) with relationship checks.
		
**Type:**
- \`chunk\`: Delete an AI chunk. If linked to SQL QA, only the chunk is deleted, SQL QA is kept.
- \`sql_qa\`: Delete a SQL QA entry. All linked chunks will also be deleted.

**Relationship checks:**
- When deleting a chunk linked to SQL QA, only the chunk is removed
- When deleting SQL QA, all linked chunks are automatically deleted first`,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Knowledge deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				deletedChunks: { type: 'number', example: 1 },
				deletedSqlQA: { type: 'number', example: 1 },
				message: { type: 'string', example: 'Deleted SQL QA 123 and 1 linked chunks.' },
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Knowledge entry not found',
	})
	async deleteKnowledge(
		@Param('type') type: 'chunk' | 'sql_qa',
		@Param('id', ParseIntPipe) id: number,
	) {
		return await this.knowledge.deleteKnowledge({ type, id });
	}

	@Post('re-embed-schema')
	@ApiOperation({
		summary: 'Re-embed database schema',
		description: `Re-embed the database schema into vector store. This will:
1. Clear existing schema chunks
2. Re-ingest schema as JSON-structured descriptions
3. Re-ingest reference lookup data (amenities, cost types, room rules)
4. Re-ingest denormalized documents (rooms, requests)

Use this when schema structure has changed or you want to refresh the schema embeddings.`,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Schema re-embedded successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				inserted: { type: 'number', example: 150 },
				jsonSchemaChunks: { type: 'number', example: 50 },
				referenceDataChunks: { type: 'number', example: 30 },
				roomDocsChunks: { type: 'number', example: 50 },
				requestDocsChunks: { type: 'number', example: 20 },
				tenantId: { type: 'string' },
				dbKey: { type: 'string' },
				schemaName: { type: 'string' },
			},
		},
	})
	async reEmbedSchema(
		@Body()
		body?: { tenantId?: string; dbKey?: string; schemaName?: string },
	) {
		// Re-use existing ingestSchemaFromDatabase logic
		return await this.ingestSchemaFromDatabase(body);
	}

	@Get('export-golden-data')
	@ApiOperation({
		summary: 'Export golden data (Q&A pairs with SQL)',
		description: `Export all golden data (cặp câu hỏi và SQL đã được lưu) từ hệ thống.
		
**Format options:**
- \`json\`: JSON format (default)
- \`csv\`: CSV format for spreadsheet

**Query parameters:**
- \`format\`: Export format (json, csv) - default: json
- \`search\`: Search term to filter by question
- \`limit\`: Maximum number of records (default: 1000, max: 10000)
- \`offset\`: Offset for pagination (default: 0)

**Response:**
- JSON format: Returns array of Q&A pairs
- CSV format: Downloads CSV file with headers: id, question, sql_canonical, sql_template, created_at`,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Golden data exported successfully',
	})
	async exportGoldenData(
		@Res() res: Response,
		@Query('format') format?: 'json' | 'csv',
		@Query('search') search?: string,
		@Query('limit') limit?: number,
		@Query('offset') offset?: number,
	) {
		// Default to JSON if format not specified
		const exportFormat = format || 'json';

		// Get all golden data (with reasonable limit)
		const maxLimit = Math.min(limit || 1000, 10000); // Max 10k records
		const result = await this.knowledge.getCanonicalList({
			search,
			limit: maxLimit,
			offset: offset || 0,
		});

		// Format data for export
		const goldenData = result.items.map((item) => ({
			id: item.id,
			question: item.question,
			sql: item.sqlCanonical,
			sqlTemplate: item.sqlTemplate || null,
			parameters: item.parameters || null,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
			lastUsedAt: item.lastUsedAt || null,
		}));

		if (exportFormat === 'csv') {
			// Export as CSV
			const csvHeaders = ['id', 'question', 'sql', 'parameters', 'created_at'];
			const csvRows = goldenData.map((item) => [
				item.id,
				`"${(item.question || '').replace(/"/g, '""')}"`, // Escape quotes
				`"${(item.sql || '').replace(/"/g, '""')}"`,
				`"${JSON.stringify(item.parameters || {}).replace(/"/g, '""')}"`,
				item.createdAt,
			]);

			const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n');

			// Add UTF-8 BOM for Excel compatibility
			const csvWithBom = `\ufeff${csvContent}`;

			res.setHeader('Content-Type', 'text/csv; charset=utf-8');
			res.setHeader(
				'Content-Disposition',
				`attachment; filename="golden-data-${new Date().toISOString().split('T')[0]}.csv"`,
			);
			res.send(csvWithBom);
			res.end();
			return;
		}

		// Export as JSON (default)
		res.json({
			success: true,
			total: result.total,
			exported: goldenData.length,
			format: 'json',
			data: goldenData,
		});
	}
}
