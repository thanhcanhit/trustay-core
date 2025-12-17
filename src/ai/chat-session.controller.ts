import {
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ChatSessionService } from './services/chat-session.service';

@ApiTags('AI Chat Session')
@Controller('ai/chat-sessions')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class ChatSessionController {
	constructor(private readonly chatSessionService: ChatSessionService) {}

	@Get()
	@ApiOperation({
		summary: 'List chat sessions for current user',
		description:
			'Get list of chat sessions for the authenticated user, ordered by last message time',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of chat sessions',
	})
	async listSessions(@Query('userId') userId?: string) {
		if (!userId) {
			return { items: [], total: 0 };
		}
		const sessions = await this.chatSessionService.getUserSessions(userId, 50);
		return {
			items: sessions,
			total: sessions.length,
		};
	}

	@Get(':sessionId')
	@ApiOperation({
		summary: 'Get chat session details with messages',
		description: 'Get a specific chat session with all its messages',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Chat session with messages',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Session not found',
	})
	async getSession(@Param('sessionId') sessionId: string) {
		const session = await this.chatSessionService.getSession(sessionId);
		if (!session) {
			return { error: 'Session not found' };
		}
		return session;
	}

	@Patch(':sessionId/title')
	@ApiOperation({
		summary: 'Update session title manually',
		description: 'Update the title of a chat session',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Title updated successfully',
	})
	async updateTitle(@Param('sessionId') sessionId: string, @Query('title') title: string) {
		await this.chatSessionService.updateSessionTitle(sessionId, title);
		return { success: true, sessionId, title };
	}

	@Delete(':sessionId')
	@ApiOperation({
		summary: 'Delete chat session',
		description: 'Delete a chat session and all its messages',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Session deleted successfully',
	})
	async deleteSession(@Param('sessionId') sessionId: string) {
		await this.chatSessionService.deleteSession(sessionId);
		return { success: true, sessionId };
	}

	@Post(':sessionId/clear')
	@ApiOperation({
		summary: 'Clear messages from session',
		description: 'Clear all messages from a session but keep the session itself',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Messages cleared successfully',
	})
	async clearMessages(@Param('sessionId') sessionId: string) {
		await this.chatSessionService.clearMessages(sessionId);
		return { success: true, sessionId };
	}
}
