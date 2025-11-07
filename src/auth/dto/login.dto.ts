import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
	@ApiProperty({
		description: 'User identifier which can be an email address or phone number',
		examples: {
			email: {
				summary: 'Email address',
				value: 'user@example.com',
			},
			phone: {
				summary: 'Phone number',
				value: '+84901234567',
			},
		},
	})
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	identifier: string;

	@ApiProperty({
		description: 'User password',
		example: 'password123',
	})
	@IsString()
	@IsNotEmpty()
	password: string;
}
