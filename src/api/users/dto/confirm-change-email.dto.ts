import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmChangeEmailDto {
	@ApiProperty({
		description: 'New email address (must match the one from request)',
		example: 'newemail@example.com',
	})
	@IsEmail({}, { message: 'Invalid email format' })
	@IsNotEmpty({ message: 'New email is required' })
	newEmail: string;

	@ApiProperty({
		description: 'Verification code sent to new email',
		example: '123456',
		minLength: 6,
		maxLength: 6,
	})
	@IsString()
	@Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
	@IsNotEmpty({ message: 'Verification code is required' })
	verificationCode: string;
}
