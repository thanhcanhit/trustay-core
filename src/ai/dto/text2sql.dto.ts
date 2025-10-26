import { IsNotEmpty, IsString } from 'class-validator';

export class Text2SqlDto {
	@IsString()
	@IsNotEmpty()
	query: string;
}
