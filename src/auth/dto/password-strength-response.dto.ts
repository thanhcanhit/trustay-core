import { ApiProperty } from '@nestjs/swagger';

export class PasswordStrengthResponseDto {
	@ApiProperty({
		description: 'Whether the password meets requirements',
		example: true,
	})
	isValid: boolean;

	@ApiProperty({
		description: 'List of validation errors',
		example: ['Mật khẩu phải chứa ít nhất 1 chữ cái hoa'],
		type: [String],
	})
	errors: string[];

	@ApiProperty({
		description: 'Password strength score (0-100)',
		example: 85,
		minimum: 0,
		maximum: 100,
	})
	score: number;

	@ApiProperty({
		description: 'Password strength level',
		example: 'Strong',
		enum: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'],
	})
	level: string;
}
