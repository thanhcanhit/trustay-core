import { ApiProperty } from '@nestjs/swagger';
import { VerificationType } from '@prisma/client';
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsPhoneNumber,
	IsString,
	Length,
	ValidateIf,
} from 'class-validator';

export class VerifyCodeDto {
	@ApiProperty({
		description: 'Type of verification',
		enum: VerificationType,
		example: 'email',
	})
	@IsEnum(VerificationType, { message: 'Type must be email or phone' })
	type: VerificationType;

	@ApiProperty({
		description: 'Email address (required if type is email)',
		example: 'user@trustay.life',
		required: false,
	})
	@ValidateIf((o) => o.type === 'email')
	@IsEmail({}, { message: 'Email must be a valid email address' })
	email?: string;

	@ApiProperty({
		description: 'Phone number (required if type is phone)',
		example: '+84901234567',
		required: false,
	})
	@ValidateIf((o) => o.type === 'phone')
	@IsPhoneNumber('VN', { message: 'Phone number must be a valid Vietnamese phone number' })
	phone?: string;

	@ApiProperty({
		description: '6-digit verification code',
		example: '123456',
		minLength: 6,
		maxLength: 6,
	})
	@IsString({ message: 'Code must be a string' })
	@Length(6, 6, { message: 'Code must be exactly 6 digits' })
	@IsNotEmpty({ message: 'Code is required' })
	code: string;
}
