import { ApiProperty } from '@nestjs/swagger';
import { Gender, UserRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UsersQueryDto {
	@ApiProperty({
		description: 'Page number (starts from 1)',
		example: 1,
		minimum: 1,
		default: 1,
		required: false,
	})
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@IsOptional()
	page?: number = 1;

	@ApiProperty({
		description: 'Number of items per page',
		example: 10,
		minimum: 1,
		maximum: 100,
		default: 10,
		required: false,
	})
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	@IsOptional()
	limit?: number = 10;

	@ApiProperty({
		description: 'Search by email, name, or phone',
		example: 'john@example.com',
		required: false,
	})
	@IsString()
	@IsOptional()
	search?: string;

	@ApiProperty({
		description: 'Filter by user role',
		enum: UserRole,
		required: false,
	})
	@IsEnum(UserRole)
	@IsOptional()
	role?: UserRole;

	@ApiProperty({
		description: 'Filter by gender',
		enum: Gender,
		required: false,
	})
	@IsEnum(Gender)
	@IsOptional()
	gender?: Gender;

	@ApiProperty({
		description: 'Filter by email verification status',
		example: true,
		required: false,
	})
	@Transform(({ value }) => {
		if (value === 'true') {
			return true;
		}
		if (value === 'false') {
			return false;
		}
		return value;
	})
	@IsOptional()
	isVerifiedEmail?: boolean;

	@ApiProperty({
		description: 'Filter by phone verification status',
		example: true,
		required: false,
	})
	@Transform(({ value }) => {
		if (value === 'true') {
			return true;
		}
		if (value === 'false') {
			return false;
		}
		return value;
	})
	@IsOptional()
	isVerifiedPhone?: boolean;

	@ApiProperty({
		description: 'Filter by identity verification status',
		example: false,
		required: false,
	})
	@Transform(({ value }) => {
		if (value === 'true') {
			return true;
		}
		if (value === 'false') {
			return false;
		}
		return value;
	})
	@IsOptional()
	isVerifiedIdentity?: boolean;

	@ApiProperty({
		description: 'Sort field',
		example: 'createdAt',
		enum: ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email'],
		default: 'createdAt',
		required: false,
	})
	@IsString()
	@IsOptional()
	sortBy?: string = 'createdAt';

	@ApiProperty({
		description: 'Sort order',
		example: 'desc',
		enum: ['asc', 'desc'],
		default: 'desc',
		required: false,
	})
	@IsString()
	@IsOptional()
	sortOrder?: 'asc' | 'desc' = 'desc';
}
