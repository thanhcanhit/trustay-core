import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseIntPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from '../../../ai/knowledge/knowledge.service';
import { AiProcessingLogService } from '../../../ai/services/ai-processing-log.service';
import { OptionalJwtAuthGuard } from '../../../auth/guards/optional-jwt-auth.guard';
import { QueryCanonicalDto } from './dto/query-canonical.dto';
import { QueryChunksDto } from './dto/query-chunks.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { TeachBatchDto } from './dto/teach-batch.dto';
import { TeachOrUpdateDto } from './dto/teach-or-update.dto';

@ApiTags('Admin AI')
@Controller('admin/ai')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class AdminAiController {
	constructor(
		private readonly knowledge: KnowledgeService,
		private readonly aiLogService: AiProcessingLogService,
	) {}

	@Get('canonical')
	@ApiOperation({
		summary: 'Get list of canonical SQL QA entries',
		description: 'Get paginated list of canonical SQL QA entries with search and sorting',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of canonical SQL QA entries',
	})
	async getCanonical(@Query() query: QueryCanonicalDto) {
		return await this.knowledge.getCanonicalList({
			search: query.search,
			limit: query.limit,
			offset: query.offset,
		});
	}

	@Get('chunks')
	@ApiOperation({
		summary: 'Get list of AI chunks (embedding content)',
		description: 'Get paginated list of AI chunks with search, filter by collection, and sorting',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of AI chunks',
	})
	async getChunks(@Query() query: QueryChunksDto) {
		return await this.knowledge.getChunksList({
			search: query.search,
			collection: query.collection,
			limit: query.limit,
			offset: query.offset,
		});
	}

	@Get('logs')
	@ApiOperation({
		summary: 'Get list of AI processing logs',
		description:
			'Get paginated list of AI processing logs with search, filter by status, and sorting',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of AI processing logs',
	})
	async getLogs(@Query() query: QueryLogsDto) {
		return await this.aiLogService.findMany({
			search: query.search,
			status: query.status,
			limit: query.limit,
			offset: query.offset,
		});
	}

	@Get('logs/:id')
	@ApiOperation({
		summary: 'Get AI processing log by ID',
		description: 'Return full processing log (including steps, attempts, contexts) by log ID',
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Processing log detail' })
	async getLogById(@Param('id') id: string) {
		return await this.aiLogService.findById(id);
	}

	@Get('canonical/:id/chunk')
	@ApiOperation({
		summary: 'Get chunk linked to a canonical SQL QA entry',
		description: 'Return chunkId (ai_chunks.id) mapped from a SQL QA canonical entry',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Chunk ID linked to canonical',
	})
	async getChunkByCanonical(@Param('id', ParseIntPipe) id: number) {
		const chunkId = await this.knowledge.findChunkBySqlQAId(id);
		return { sqlQAId: id, chunkId };
	}

	@Get('chunk/:id/canonical')
	@ApiOperation({
		summary: 'Get canonical SQL QA entry linked to a chunk',
		description: 'Return sqlQAId mapped from ai_chunks',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Canonical SQL QA ID linked to chunk',
	})
	async getCanonicalByChunk(@Param('id', ParseIntPipe) id: number) {
		const sqlQAId = await this.knowledge.findSqlQAIdByChunkId(id);
		return { chunkId: id, sqlQAId };
	}

	@Post('teach-json')
	@ApiOperation({
		summary: 'Teach knowledge from JSON payload (bulk)',
		description: 'Nạp nhiều Q&A (question + sql) từ nội dung JSON, không cần upload file',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Bulk teach result',
	})
	async teachFromJson(@Body() dto: TeachBatchDto) {
		const results: Array<{
			question: string;
			sqlQAId?: number;
			chunkId?: number;
			isUpdate?: boolean;
			error?: string;
		}> = [];

		for (const item of dto.items || []) {
			try {
				const taught = await this.knowledge.teachOrUpdateKnowledge({
					id: item.id ? Number(item.id) : undefined,
					question: item.question,
					sql: item.sql,
					sessionId: item.sessionId,
					userId: item.userId,
				});
				results.push({
					question: item.question,
					sqlQAId: taught.sqlQAId,
					chunkId: taught.chunkId,
					isUpdate: taught.isUpdate,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				results.push({ question: item.question, error: message });
				if (dto.failFast) {
					return {
						success: false,
						message: 'Stopped due to error (failFast=true)',
						items: results,
					};
				}
			}
		}

		return {
			success: true,
			count: results.length,
			items: results,
		};
	}

	@Post('teach-or-update')
	@ApiOperation({
		summary: 'Teach new knowledge or update existing knowledge',
		description: `Add new Q&A pair or update existing SQL QA entry.
		
**Logic:**
- Nếu có \`id\` → Update existing SQL QA entry
- Nếu không có \`id\` → Add mới (giống như /teach)

**Sử dụng:**
- Dạy mới: Gửi question + sql (không có id)
- Sửa lỗi: Gửi id + question + sql (có id)`,
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Knowledge taught or updated successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Knowledge taught successfully' },
				chunkId: { type: 'number', example: 12345 },
				sqlQAId: { type: 'number', example: 67890 },
				isUpdate: { type: 'boolean', example: false },
			},
		},
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Dữ liệu đầu vào không hợp lệ',
	})
	async teachOrUpdate(@Body() dto: TeachOrUpdateDto) {
		const result = await this.knowledge.teachOrUpdateKnowledge({
			id: dto.id,
			question: dto.question,
			sql: dto.sql,
			sessionId: dto.sessionId,
			userId: dto.userId,
		});
		return {
			success: true,
			message: result.isUpdate ? 'Knowledge updated successfully' : 'Knowledge taught successfully',
			chunkId: result.chunkId,
			sqlQAId: result.sqlQAId,
			isUpdate: result.isUpdate,
		};
	}
}
