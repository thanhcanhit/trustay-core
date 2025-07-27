import { ApiProperty } from '@nestjs/swagger';
import { Gender, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
	@ApiProperty({ description: 'First name', example: 'John' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	firstName?: string;

	@ApiProperty({ description: 'Last name', example: 'Doe' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	lastName?: string;

	@ApiProperty({
		description: 'Avatar URL',
		example: 'https://example.com/avatar.jpg',
		required: false,
	})
	@IsOptional()
	@IsUrl()
	avatarUrl?: string;

	@ApiProperty({ description: 'Date of birth', example: '1990-01-01', required: false })
	@IsOptional()
	@IsDateString()
	dateOfBirth?: string;

	@ApiProperty({ enum: Gender, description: 'Gender', required: false })
	@IsOptional()
	@IsEnum(Gender)
	gender?: Gender;

	@ApiProperty({ enum: UserRole, description: 'User role', required: false })
	@IsOptional()
	@IsEnum(UserRole)
	role?: UserRole;

	@ApiProperty({
		description: 'Bio',
		example: 'Software developer passionate about technology',
		required: false,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	bio?: string;

	@ApiProperty({ description: 'ID card number', example: '012345678901', required: false })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	idCardNumber?: string;

	@ApiProperty({ description: 'Bank account number', example: '1234567890', required: false })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	bankAccount?: string;

	@ApiProperty({ description: 'Bank name', example: 'Vietcombank', required: false })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	bankName?: string;
}
