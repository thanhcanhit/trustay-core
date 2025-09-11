import { IsOptional, IsString } from 'class-validator';

export class ListMessagesQueryDto {
	@IsOptional()
	@IsString()
	public cursor?: string;

	@IsOptional()
	public limit: number = 20;
}
