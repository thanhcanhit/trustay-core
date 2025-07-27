import { ApiProperty } from '@nestjs/swagger';
import { Gender, UserRole } from '@prisma/client';
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsPhoneNumber,
	IsString,
	MinLength,
} from 'class-validator';

export class PreRegisterDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@trustay.life',
	})
	@IsEmail({}, { message: 'Email must be a valid email address' })
	@IsNotEmpty({ message: 'Email is required' })
	email: string;

	@ApiProperty({
		description: 'User password (min 6 characters)',
		example: 'SecurePassword123!',
		minLength: 6,
	})
	@IsString({ message: 'Password must be a string' })
	@MinLength(6, { message: 'Password must be at least 6 characters long' })
	@IsNotEmpty({ message: 'Password is required' })
	password: string;

	@ApiProperty({
		description: 'User first name',
		example: 'Minh',
	})
	@IsString({ message: 'First name must be a string' })
	@IsNotEmpty({ message: 'First name is required' })
	firstName: string;

	@ApiProperty({
		description: 'User last name',
		example: 'Nguyễn',
	})
	@IsString({ message: 'Last name must be a string' })
	@IsNotEmpty({ message: 'Last name is required' })
	lastName: string;

	@ApiProperty({
		description: 'User phone number (optional)',
		example: '+84901234567',
		required: false,
	})
	@IsOptional()
	@IsPhoneNumber('VN', { message: 'Phone number must be a valid Vietnamese phone number' })
	phone?: string;

	@ApiProperty({
		description: 'User gender',
		enum: Gender,
		example: 'male',
		required: false,
	})
	@IsOptional()
	@IsEnum(Gender, { message: 'Gender must be one of: male, female, other' })
	gender?: Gender;

	@ApiProperty({
		description: 'User role (required)',
		enum: UserRole,
		example: 'tenant',
	})
	@IsNotEmpty({ message: 'Role is required' })
	@IsEnum(UserRole, { message: 'Role must be one of: tenant, landlord' })
	role: UserRole;
}
