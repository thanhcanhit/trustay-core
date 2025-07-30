import { ApiProperty } from '@nestjs/swagger';
import { VerificationType } from '@prisma/client';
import { IsEmail, IsEnum, IsPhoneNumber, ValidateIf } from 'class-validator';

export class SendVerificationDto {
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
}
