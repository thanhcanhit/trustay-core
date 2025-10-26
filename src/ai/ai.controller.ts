import { Body, Controller, Delete, Get, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AiService, ChatResponse } from './ai.service';
import { Text2SqlDto } from './dto/text2sql.dto';

@ApiTags('AI')
@Controller('ai')
@UseGuards(OptionalJwtAuthGuard) // Optional authentication - allows both authenticated and anonymous users
@ApiBearerAuth()
export class AiController {
	constructor(private readonly aiService: AiService) {}

	/**
	 * Main chat endpoint - Compatible with AI SDK Conversation component
	 * Supports both authenticated users (via JWT) and anonymous users (via IP)
	 */
	@Post('chat')
	@ApiOperation({ summary: 'Chat với AI - tương thích với AI SDK Conversation component' })
	@ApiQuery({
		name: 'query',
		description: 'Câu hỏi hoặc yêu cầu của người dùng',
		example: 'Tìm phòng trọ giá rẻ ở quận 1',
	})
	@ApiResponse({
		status: 200,
		description: 'Phản hồi từ AI thành công',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				data: {
					type: 'object',
					properties: {
						message: { type: 'string', example: 'Tôi đã tìm thấy 5 phòng trọ phù hợp...' },
						sql: { type: 'string', example: 'SELECT * FROM rooms WHERE...' },
						results: { type: 'array', items: { type: 'object' } },
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Lỗi xử lý chat',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: false },
				error: { type: 'string', example: 'Failed to process chat message' },
				message: { type: 'string', example: 'Invalid query format' },
				query: { type: 'string', example: 'Tìm phòng trọ' },
			},
		},
	})
	async chat(
		@Query('query') query: string,
		@CurrentUser('id') userId: string | undefined,
		@Ip() clientIp: string,
	): Promise<{
		success: boolean;
		data?: ChatResponse;
		error?: string;
		message?: string;
		query?: string;
	}> {
		try {
			const response = await this.aiService.chatWithAI(query, {
				userId,
				clientIp,
			});

			return {
				success: true,
				data: response,
			};
		} catch (error) {
			return {
				success: false,
				error: 'Failed to process chat message',
				message: error.message,
				query: query,
			};
		}
	}

	/**
	 * Get chat history for current session
	 * Compatible with AI SDK Conversation component
	 */
	@Get('chat/history')
	@ApiOperation({ summary: 'Lấy lịch sử chat cho session hiện tại' })
	@ApiResponse({
		status: 200,
		description: 'Lấy lịch sử chat thành công',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				data: { type: 'array', items: { type: 'object' } },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Lỗi lấy lịch sử chat',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: false },
				error: { type: 'string', example: 'Failed to get chat history' },
				message: { type: 'string', example: 'Session not found' },
			},
		},
	})
	async getChatHistory(@CurrentUser('id') userId: string | undefined, @Ip() clientIp: string) {
		try {
			const history = await this.aiService.getChatHistory({
				userId,
				clientIp,
			});

			return {
				success: true,
				data: history,
			};
		} catch (error) {
			return {
				success: false,
				error: 'Failed to get chat history',
				message: error.message,
			};
		}
	}

	/**
	 * Clear chat history for current session
	 */
	@Delete('chat/history')
	@ApiOperation({ summary: 'Xóa lịch sử chat cho session hiện tại' })
	@ApiResponse({
		status: 200,
		description: 'Xóa lịch sử chat thành công',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				data: { type: 'object' },
				message: { type: 'string', example: 'Chat history cleared successfully' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Lỗi xóa lịch sử chat',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: false },
				error: { type: 'string', example: 'Failed to clear chat history' },
				message: { type: 'string', example: 'Session not found' },
			},
		},
	})
	async clearChatHistory(@CurrentUser('id') userId: string | undefined, @Ip() clientIp: string) {
		try {
			const result = await this.aiService.clearChatHistory({
				userId,
				clientIp,
			});

			return {
				success: true,
				data: result,
				message: 'Chat history cleared successfully',
			};
		} catch (error) {
			return {
				success: false,
				error: 'Failed to clear chat history',
				message: error.message,
			};
		}
	}

	/**
	 * Legacy endpoint for backward compatibility
	 * Direct SQL generation without conversation context
	 */
	@Post('text2sql')
	@ApiOperation({ summary: 'Tạo SQL từ text - endpoint cũ để tương thích ngược' })
	@ApiResponse({
		status: 200,
		description: 'Tạo và thực thi SQL thành công',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				data: {
					type: 'object',
					properties: {
						sql: { type: 'string', example: 'SELECT * FROM rooms WHERE...' },
						results: { type: 'array', items: { type: 'object' } },
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Lỗi tạo hoặc thực thi SQL',
		schema: {
			type: 'object',
			properties: {
				error: { type: 'string', example: 'Failed to generate or execute SQL' },
				message: { type: 'string', example: 'Invalid query format' },
				query: { type: 'string', example: 'Tìm phòng trọ' },
			},
		},
	})
	async generateSql(@Body() dto: Text2SqlDto, @CurrentUser('id') userId: string | undefined) {
		try {
			return await this.aiService.generateAndExecuteSql(dto.query, userId);
		} catch (error) {
			return {
				error: 'Failed to generate or execute SQL',
				message: error.message,
				query: dto.query,
			};
		}
	}
}
