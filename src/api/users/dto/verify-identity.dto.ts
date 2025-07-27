import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUrl } from 'class-validator';

export class VerifyIdentityDto {
	@ApiProperty({ description: 'ID card number', example: '012345678901' })
	@IsString()
	idCardNumber: string;

	@ApiProperty({
		description: 'ID card images URLs',
		example: ['https://example.com/front.jpg', 'https://example.com/back.jpg'],
		type: [String],
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(5)
	@IsUrl({}, { each: true })
	idCardImages: string[];
}
