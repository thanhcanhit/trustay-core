import { Body, Controller, Get, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from '../../../ai/knowledge/knowledge.service';
import { AiProcessingLogService } from '../../../ai/services/ai-processing-log.service';
import { OptionalJwtAuthGuard } from '../../../auth/guards/optional-jwt-auth.guard';
import { QueryCanonicalDto } from './dto/query-canonical.dto';
import { QueryChunksDto } from './dto/query-chunks.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { TeachOrUpdateDto } from './dto/teach-or-update.dto';

@ApiTags('Admin AI')
@Controller('api/admin/ai')
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
