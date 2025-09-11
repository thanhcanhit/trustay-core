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

	// Optional attachment URLs; in a real flow we'd upload first then pass ids
	@IsOptional()
	public attachmentUrls?: string[];
}

export class CreateConversationDto {
	@IsUUID()
	public userAId!: string;

	@IsUUID()
	public userBId!: string;
}

export class ListMessagesQueryDto {
	@IsOptional()
	@IsString()
	public cursor?: string;

	@IsOptional()
	public limit: number = 20;
}
