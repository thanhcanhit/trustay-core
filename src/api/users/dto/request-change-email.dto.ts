import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestChangeEmailDto {
	@ApiProperty({
		description: 'New email address',
		example: 'newemail@example.com',
	})
	@IsEmail({}, { message: 'Invalid email format' })
	@IsNotEmpty({ message: 'New email is required' })
	newEmail: string;

	@ApiProperty({
		description: 'Current password for verification',
		example: 'SecurePassword123!',
	})
	@IsString()
	@IsNotEmpty({ message: 'Password is required' })
	password: string;
}
