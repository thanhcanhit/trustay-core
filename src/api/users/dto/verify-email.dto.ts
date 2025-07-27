import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
	@ApiProperty({ description: 'Email address', example: 'user@example.com' })
	@IsEmail()
	email: string;

	@ApiProperty({ description: 'Verification code', example: '123456' })
	@IsString()
	@Length(4, 8)
	verificationCode: string;
}
