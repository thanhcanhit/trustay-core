import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for admin to teach the AI system with question and SQL pairs
 */
export class TeachKnowledgeDto {
	@IsString()
	@IsNotEmpty()
	question: string;

	@IsString()
	@IsNotEmpty()
	sql: string;

	@IsString()
	@IsOptional()
	sessionId?: string;

	@IsString()
	@IsOptional()
	userId?: string;
}
