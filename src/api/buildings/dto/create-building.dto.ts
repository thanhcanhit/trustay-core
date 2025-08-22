import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsBoolean,
	IsDecimal,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export class CreateBuildingDto {
	@ApiProperty({
		description: 'Tên tòa nhà',
		example: 'Nhà trọ Minh Phát',
		minLength: 1,
		maxLength: 255,
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(1)
	@MaxLength(255)
	name: string;

	@ApiPropertyOptional({
		description: 'Mô tả chi tiết về tòa nhà',
		example: 'Nhà trọ cao cấp gần trường Đại học Bách Khoa',
	})
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	description?: string;

	@ApiProperty({
		description: 'Địa chỉ dòng 1',
		example: '123 Đường Võ Văn Ngân',
		maxLength: 255,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	addressLine1: string;

	@ApiPropertyOptional({
		description: 'Địa chỉ dòng 2 (hẻm, ngõ)',
		example: 'Hẻm 456',
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	addressLine2?: string;

	@ApiPropertyOptional({
		description: 'ID phường/xã',
		example: 12345,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	wardId?: number;

	@ApiProperty({
		description: 'ID quận/huyện',
		example: 123,
	})
	@IsInt()
	@Min(1)
	districtId: number;

	@ApiProperty({
		description: 'ID tỉnh/thành phố',
		example: 79,
	})
	@IsInt()
	@Min(1)
	provinceId: number;

	@ApiPropertyOptional({
		description: 'Tên quốc gia',
		example: 'Vietnam',
		default: 'Vietnam',
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	country?: string = 'Vietnam';

	@ApiPropertyOptional({
		description: 'Vĩ độ GPS',
		example: 10.7626,
	})
	@IsOptional()
	@Transform(({ value }) => (value ? parseFloat(value) : undefined))
	@IsDecimal({ decimal_digits: '1,7' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Kinh độ GPS',
		example: 106.6834,
	})
	@IsOptional()
	@Transform(({ value }) => (value ? parseFloat(value) : undefined))
	@IsDecimal({ decimal_digits: '1,7' })
	longitude?: number;

	@ApiPropertyOptional({
		description: 'Trạng thái hoạt động',
		example: true,
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	isActive?: boolean = true;
}
