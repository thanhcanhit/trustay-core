import { Body, Controller, Delete, Get, Ip, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AiService, ChatResponse } from './ai.service';
import { Text2SqlDto } from './dto/text2sql.dto';

/**
 * DTO for chat request
 */
class ChatDto {
	query: string;
}

@Controller('ai')
export class AiController {
	constructor(private readonly aiService: AiService) {}

	/**
	 * Main chat endpoint - Compatible with AI SDK Conversation component
	 * Supports both authenticated users (via JWT) and anonymous users (via IP)
	 */
	@Post('chat')
	async chat(
		@Body() dto: ChatDto,
		@Req() req: Request,
		@Ip() clientIp: string,
	): Promise<{
		success: boolean;
		data?: ChatResponse;
		error?: string;
		message?: string;
		query?: string;
	}> {
		try {
			// Extract user ID from JWT token if authenticated (similar to rooms.service.ts pattern)
			const userId = (req as any).user?.id;

			const response = await this.aiService.chatWithAI(dto.query, {
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
				query: dto.query,
			};
		}
	}

	/**
	 * Get chat history for current session
	 * Compatible with AI SDK Conversation component
	 */
	@Get('chat/history')
	async getChatHistory(@Req() req: Request, @Ip() clientIp: string) {
		try {
			const userId = (req as any).user?.id;

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
	async clearChatHistory(@Req() req: Request, @Ip() clientIp: string) {
		try {
			const userId = (req as any).user?.id;

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
	async generateSql(@Body() dto: Text2SqlDto) {
		try {
			return await this.aiService.generateAndExecuteSql(dto.query);
		} catch (error) {
			return {
				error: 'Failed to generate or execute SQL',
				message: error.message,
				query: dto.query,
			};
		}
	}
}
