import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListMessagesQueryDto, SendMessageDto } from './chat.dto';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
	public constructor(private readonly chatService: ChatService) {}

	@Post('messages')
	public sendMessage(@CurrentUser('id') senderId: string, @Body() body: SendMessageDto) {
		return this.chatService.sendMessage(senderId, body);
	}

	@Get('conversations/:conversationId/messages')
	public listMessages(
		@Param('conversationId') conversationId: string,
		@Query() query: ListMessagesQueryDto,
	) {
		return this.chatService.listMessages(conversationId, query);
	}

	@Post('conversations/:conversationId/read-all')
	public markAllAsRead(
		@CurrentUser('id') userId: string,
		@Param('conversationId') conversationId: string,
	) {
		return this.chatService.markAllAsRead(userId, conversationId);
	}

	@Get('conversations')
	public listConversations(@CurrentUser('id') userId: string) {
		return this.chatService.listConversations(userId);
	}
}
