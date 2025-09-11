import { IsUUID } from 'class-validator';

export class CreateConversationDto {
	@IsUUID()
	public userAId!: string;

	@IsUUID()
	public userBId!: string;
}
