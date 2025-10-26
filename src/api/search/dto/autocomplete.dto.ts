import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AutocompleteQueryDto {
	@ApiProperty({
		description: 'Search keyword (minimum 2 characters)',
		example: 'phòng trọ',
		minLength: 2,
	})
	@IsString()
	@MinLength(2, { message: 'Keyword must be at least 2 characters long' })
	keyword: string;
}

export class AutocompleteSuggestionDto {
	@ApiProperty({ description: 'Suggestion text', example: 'Phòng trọ giá rẻ quận 1' })
	text: string;

	@ApiProperty({ description: 'Suggestion score', example: 0.95 })
	score: number;

	@ApiPropertyOptional({ description: 'Additional context data' })
	context?: any;
}

export class AutocompleteResponseDto {
	@ApiProperty({ description: 'Success status', example: true })
	success: boolean;

	@ApiPropertyOptional({ description: 'Error message if failed' })
	message?: string;

	@ApiProperty({
		description: 'Array of autocomplete suggestions',
		type: [AutocompleteSuggestionDto],
	})
	data: AutocompleteSuggestionDto[];

	@ApiProperty({ description: 'Original search keyword', example: 'phòng trọ' })
	keyword: string;
}
