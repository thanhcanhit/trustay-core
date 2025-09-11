import { ChatMessageType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
	@IsUUID()
	@IsOptional()
	public conversationId?: string;

	@IsUUID()
	@IsOptional()
	public recipientId?: string;

	@IsEnum(ChatMessageType)
	public type: ChatMessageType = ChatMessageType.text;

	@IsString()
	@IsOptional()
	@MaxLength(5000)
	public content?: string;

	@IsOptional()
	public attachmentUrls?: string[];
}
