import { ApiProperty } from '@nestjs/swagger';
import { Gender, UserRole } from '@prisma/client';

export class UserResponseDto {
	@ApiProperty({
		description: 'User unique identifier',
		example: 'clx123456789',
	})
	id: string;

	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	email: string;

	@ApiProperty({
		description: 'User phone number',
		example: '+84901234567',
		nullable: true,
	})
	phone: string | null;

	@ApiProperty({
		description: 'User first name',
		example: 'John',
	})
	firstName: string;

	@ApiProperty({
		description: 'User last name',
		example: 'Doe',
	})
	lastName: string;

	@ApiProperty({
		description: 'User avatar URL',
		example: 'https://example.com/avatar.jpg',
		nullable: true,
	})
	avatarUrl: string | null;

	@ApiProperty({
		description: 'User date of birth',
		example: '1990-01-01',
		nullable: true,
	})
	dateOfBirth: Date | null;

	@ApiProperty({
		description: 'User gender',
		enum: Gender,
		nullable: true,
	})
	gender: Gender | null;

	@ApiProperty({
		description: 'User role',
		enum: UserRole,
	})
	role: UserRole;

	@ApiProperty({
		description: 'User bio',
		example: 'Software developer passionate about clean code',
		nullable: true,
	})
	bio: string | null;

	@ApiProperty({
		description: 'User ID card number',
		example: '123456789012',
		nullable: true,
	})
	idCardNumber: string | null;

	@ApiProperty({
		description: 'User bank account number',
		example: '1234567890',
		nullable: true,
	})
	bankAccount: string | null;

	@ApiProperty({
		description: 'User bank name',
		example: 'Vietcombank',
		nullable: true,
	})
	bankName: string | null;

	@ApiProperty({
		description: 'Phone verification status',
		example: true,
	})
	isVerifiedPhone: boolean;

	@ApiProperty({
		description: 'Email verification status',
		example: true,
	})
	isVerifiedEmail: boolean;

	@ApiProperty({
		description: 'Identity verification status',
		example: false,
	})
	isVerifiedIdentity: boolean;

	@ApiProperty({
		description: 'Bank verification status',
		example: false,
	})
	isVerifiedBank: boolean;

	@ApiProperty({
		description: 'Overall rating',
		example: 4.5,
		nullable: true,
	})
	overallRating: number | null;

	@ApiProperty({
		description: 'Total number of ratings received',
		example: 25,
	})
	totalRatings: number;

	@ApiProperty({
		description: 'Last active timestamp',
		example: '2024-01-01T10:00:00Z',
		nullable: true,
	})
	lastActiveAt: Date | null;

	@ApiProperty({
		description: 'User creation timestamp',
		example: '2024-01-01T10:00:00Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'User last update timestamp',
		example: '2024-01-01T10:00:00Z',
	})
	updatedAt: Date;
}
