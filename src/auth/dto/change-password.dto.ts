import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
	@ApiProperty({
		description: 'Current password',
		example: 'oldpassword123',
	})
	@IsString()
	@IsNotEmpty()
	currentPassword: string;

	@ApiProperty({
		description: 'New password (minimum 6 characters)',
		example: 'NewSecurePassword123!',
		minLength: 6,
	})
	@IsString()
	@MinLength(6)
	newPassword: string;
}
