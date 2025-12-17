import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Ip,
	Logger,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AiService, ChatResponse } from './ai.service';
import { ConversationMessageDto, CreateConversationDto } from './dto/conversation.dto';

/**
 * Conversation Controller - New version with explicit conversation management
 * Supports persistent conversations with session management
 * Keeps backward compatibility with old /ai/chat endpoints
 */
@ApiTags('AI Conversation')
@Controller('ai/conversations')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class ConversationController {
	private readonly logger = new Logger(ConversationController.name);

	constructor(private readonly aiService: AiService) {}

	/**
	 * List all conversations for current user
	 * Returns conversations ordered by last message time
	 */
	@Get()
	@ApiOperation({
		summary: 'List all conversations for current user',
		description:
			'Get list of conversations with metadata (title, last message time, message count)',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of conversations',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				data: {
					type: 'object',
					properties: {
						items: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string', example: 'uuid' },
									title: { type: 'string', example: 'Tìm phòng Gò Vấp' },
									lastMessageAt: { type: 'string', example: '2024-01-01T00:00:00Z' },
									messageCount: { type: 'number', example: 5 },
									summary: { type: 'string', example: 'User đang tìm phòng...' },
								},
							},
						},
						total: { type: 'number', example: 10 },
					},
				},
			},
		},
	})
	async listConversations(
		@CurrentUser('id') userId: string | undefined,
		@Query('limit') limit?: number,
	) {
		try {
			if (!userId) {
				return {
					success: true,
					data: { items: [], total: 0 },
				};
			}
			const conversations = await this.aiService.listConversations(userId, limit || 50);
			return {
				success: true,
				data: {
					items: conversations,
					total: conversations.length,
				},
			};
		} catch (error) {
			this.logger.error(`Failed to list conversations: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to list conversations',
				message: error.message,
			};
		}
	}

	/**
	 * Create a new conversation
	 * Optionally with initial message or custom title
	 */
	@Post()
	@ApiOperation({
		summary: 'Create a new conversation',
		description: 'Create a new conversation, optionally with initial message or custom title',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Conversation created successfully',
	})
	async createConversation(
		@Body() dto: CreateConversationDto,
		@CurrentUser('id') userId: string | undefined,
		@Ip() clientIp: string,
	) {
		try {
			const conversation = await this.aiService.createConversation({
				userId,
				clientIp,
				title: dto.title,
				initialMessage: dto.initialMessage,
			});

			// If initial message provided, process it
			if (dto.initialMessage) {
				const response = await this.aiService.chatInConversation(
					conversation.id,
					dto.initialMessage,
					{
						userId,
						clientIp,
						currentPage: undefined,
					},
				);
				return {
					success: true,
					data: {
						conversation,
						response,
					},
				};
			}

			return {
				success: true,
				data: { conversation },
			};
		} catch (error) {
			this.logger.error(`Failed to create conversation: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to create conversation',
				message: error.message,
			};
		}
	}

	/**
	 * Get conversation details with messages
	 */
	@Get(':conversationId')
	@ApiOperation({
		summary: 'Get conversation details with messages',
		description: 'Get a specific conversation with all its messages',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Conversation with messages',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Conversation not found',
	})
	async getConversation(@Param('conversationId') conversationId: string) {
		try {
			const conversation = await this.aiService.getConversation(conversationId);
			if (!conversation) {
				return {
					success: false,
					error: 'Conversation not found',
				};
			}
			return {
				success: true,
				data: conversation,
			};
		} catch (error) {
			this.logger.error(`Failed to get conversation: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to get conversation',
				message: error.message,
			};
		}
	}

	/**
	 * Send a message in a conversation
	 * This is the main chat endpoint for conversations
	 */
	@Post(':conversationId/messages')
	@ApiOperation({
		summary: 'Send a message in a conversation',
		description: 'Send a message to a specific conversation and get AI response',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Message sent and AI responded successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				data: {
					type: 'object',
					properties: {
						message: { type: 'string', example: 'Tôi đã tìm thấy 5 phòng trọ...' },
						sql: { type: 'string', example: 'SELECT * FROM rooms WHERE...' },
						results: { type: 'array', items: { type: 'object' } },
					},
				},
			},
		},
	})
	async sendMessage(
		@Param('conversationId') conversationId: string,
		@Body() dto: ConversationMessageDto,
		@CurrentUser('id') userId: string | undefined,
		@Ip() clientIp: string,
	): Promise<{
		success: boolean;
		data?: ChatResponse;
		error?: string;
		message?: string;
	}> {
		try {
			const response = await this.aiService.chatInConversation(conversationId, dto.message, {
				userId,
				clientIp,
				currentPage: dto.currentPage,
			});

			return {
				success: true,
				data: response,
			};
		} catch (error) {
			this.logger.error(`Failed to send message: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to send message',
				message: error.message,
			};
		}
	}

	/**
	 * Get messages from a conversation
	 */
	@Get(':conversationId/messages')
	@ApiOperation({
		summary: 'Get messages from a conversation',
		description: 'Get all messages from a specific conversation',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Messages retrieved successfully',
	})
	async getMessages(
		@Param('conversationId') conversationId: string,
		@Query('limit') limit?: number,
	) {
		try {
			const messages = await this.aiService.getConversationMessages(conversationId, limit || 100);
			return {
				success: true,
				data: {
					items: messages,
					total: messages.length,
				},
			};
		} catch (error) {
			this.logger.error(`Failed to get messages: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to get messages',
				message: error.message,
			};
		}
	}

	/**
	 * Update conversation title
	 */
	@Patch(':conversationId/title')
	@ApiOperation({
		summary: 'Update conversation title',
		description: 'Update the title of a conversation',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Title updated successfully',
	})
	async updateTitle(@Param('conversationId') conversationId: string, @Body('title') title: string) {
		try {
			await this.aiService.updateConversationTitle(conversationId, title);
			return {
				success: true,
				data: { conversationId, title },
			};
		} catch (error) {
			this.logger.error(`Failed to update title: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to update title',
				message: error.message,
			};
		}
	}

	/**
	 * Delete a conversation
	 */
	@Delete(':conversationId')
	@ApiOperation({
		summary: 'Delete a conversation',
		description: 'Delete a conversation and all its messages',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Conversation deleted successfully',
	})
	async deleteConversation(@Param('conversationId') conversationId: string) {
		try {
			await this.aiService.deleteConversation(conversationId);
			return {
				success: true,
				data: { conversationId },
			};
		} catch (error) {
			this.logger.error(`Failed to delete conversation: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to delete conversation',
				message: error.message,
			};
		}
	}

	/**
	 * Clear messages from a conversation
	 */
	@Post(':conversationId/clear')
	@ApiOperation({
		summary: 'Clear messages from conversation',
		description: 'Clear all messages from a conversation but keep the conversation itself',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Messages cleared successfully',
	})
	async clearMessages(@Param('conversationId') conversationId: string) {
		try {
			await this.aiService.clearConversationMessages(conversationId);
			return {
				success: true,
				data: { conversationId },
			};
		} catch (error) {
			this.logger.error(`Failed to clear messages: ${error.message}`, error);
			return {
				success: false,
				error: 'Failed to clear messages',
				message: error.message,
			};
		}
	}
}
