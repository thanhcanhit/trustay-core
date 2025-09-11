import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
	public constructor(private readonly chatService: ChatService) {}

	@Post('messages')
	@ApiOperation({ summary: 'Send a new chat message (auto-creates conversation if needed)' })
	@ApiBody({ type: SendMessageDto })
	@ApiResponse({ status: 201, description: 'Message created and emitted via realtime' })
	public sendMessage(@CurrentUser('id') senderId: string, @Body() body: SendMessageDto) {
		return this.chatService.sendMessage(senderId, body);
	}

	@Get('conversations/:conversationId/messages')
	@ApiOperation({ summary: 'List messages in a conversation (desc by sentAt) with cursor' })
	@ApiParam({ name: 'conversationId', required: true })
	@ApiQuery({ name: 'cursor', required: false, description: 'Message id cursor' })
	@ApiQuery({ name: 'limit', required: false, description: 'Max items to return (default 20)' })
	public listMessages(
		@Param('conversationId') conversationId: string,
		@Query() query: ListMessagesQueryDto,
	) {
		return this.chatService.listMessages(conversationId, query);
	}

	@Post('conversations/:conversationId/read-all')
	@ApiOperation({ summary: 'Mark all messages in a conversation as read for current user' })
	@ApiParam({ name: 'conversationId', required: true })
	public markAllAsRead(
		@CurrentUser('id') userId: string,
		@Param('conversationId') conversationId: string,
	) {
		return this.chatService.markAllAsRead(userId, conversationId);
	}

	@Get('conversations')
	@ApiOperation({
		summary: 'List user conversations with counterpart info, last message, unread count',
	})
	public listConversations(@CurrentUser('id') userId: string) {
		return this.chatService.listConversations(userId);
	}
}
