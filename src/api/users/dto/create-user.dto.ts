import { ApiProperty } from '@nestjs/swagger';
import { Gender, UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@ApiProperty({
		description: 'User password (minimum 6 characters)',
		example: 'password123',
		minLength: 6,
	})
	@IsString()
	@MinLength(6)
	password: string;

	@ApiProperty({
		description: 'User first name',
		example: 'John',
	})
	@IsString()
	@IsNotEmpty()
	firstName: string;

	@ApiProperty({
		description: 'User last name',
		example: 'Doe',
	})
	@IsString()
	@IsNotEmpty()
	lastName: string;

	@ApiProperty({
		description: 'User phone number',
		example: '+84901234567',
		required: false,
	})
	@IsString()
	@IsOptional()
	phone?: string;

	@ApiProperty({
		description: 'User gender',
		enum: Gender,
		required: false,
	})
	@IsEnum(Gender)
	@IsOptional()
	gender?: Gender;

	@ApiProperty({
		description: 'User role',
		enum: UserRole,
		default: UserRole.tenant,
	})
	@IsEnum(UserRole)
	@IsOptional()
	role?: UserRole;
}
