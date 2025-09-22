import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RatingResponseTextDto {
	@ApiProperty({ description: 'Response text to the rating' })
	@IsString()
	@IsNotEmpty()
	responseText: string;
}
