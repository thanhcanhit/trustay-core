import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyPhoneDto {
	@ApiProperty({ description: 'Phone number', example: '+84901234567' })
	@IsString()
	@Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
	phone: string;

	@ApiProperty({ description: 'Verification code', example: '123456' })
	@IsString()
	@Length(4, 8)
	verificationCode: string;
}
