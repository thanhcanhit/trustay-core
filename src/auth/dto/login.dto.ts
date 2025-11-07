import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class LoginDto {
	@ApiProperty({
		description:
			'User identifier which can be an email address or phone number (takes priority over email)',
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
		required: false,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	identifier?: string;

	@ApiProperty({
		description: 'User email address (used if identifier is not provided)',
		example: 'user@example.com',
		required: false,
	})
	@ValidateIf((o) => !o.identifier)
	@IsNotEmpty({ message: 'Either identifier or email must be provided' })
	@IsEmail({}, { message: 'Email must be a valid email address' })
	@IsString()
	@MaxLength(255)
	email?: string;

	@ApiProperty({
		description: 'User password',
		example: 'password123',
	})
	@IsString()
	@IsNotEmpty()
	password: string;
}
