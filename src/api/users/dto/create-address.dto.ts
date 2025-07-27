import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAddressDto {
	@ApiProperty({ description: 'Address line 1', example: '123 Main Street' })
	@IsString()
	@MaxLength(255)
	addressLine1: string;

	@ApiProperty({ description: 'Address line 2', example: 'Apartment 4B', required: false })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	addressLine2?: string;

	@ApiProperty({ description: 'Ward ID', example: 1, required: false })
	@IsOptional()
	@IsInt()
	wardId?: number;

	@ApiProperty({ description: 'District ID', example: 1 })
	@IsInt()
	districtId: number;

	@ApiProperty({ description: 'Province ID', example: 1 })
	@IsInt()
	provinceId: number;

	@ApiProperty({ description: 'Country', example: 'Vietnam', default: 'Vietnam' })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	country?: string;

	@ApiProperty({ description: 'Postal code', example: '10000', required: false })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	postalCode?: string;

	@ApiProperty({ description: 'Is primary address', example: false, default: false })
	@IsOptional()
	@IsBoolean()
	isPrimary?: boolean;
}
