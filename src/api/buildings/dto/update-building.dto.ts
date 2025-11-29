import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	IsBoolean,
	IsDecimal,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { convertDecimalToNumber } from '../../../common/utils';

export class UpdateBuildingDto {
	@ApiPropertyOptional({
		description: 'Tên tòa nhà',
		example: 'Nhà trọ Minh Phát 2',
		minLength: 1,
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	name?: string;

	@ApiPropertyOptional({
		description: 'Mô tả chi tiết về tòa nhà',
		example: 'Nhà trọ cao cấp gần trường Đại học Bách Khoa, được nâng cấp',
	})
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	description?: string;

	@ApiPropertyOptional({
		description: 'Địa chỉ dòng 1',
		example: '125 Đường Võ Văn Ngân',
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	addressLine1?: string;

	@ApiPropertyOptional({
		description: 'Địa chỉ dòng 2 (hẻm, ngõ)',
		example: 'Hẻm 458',
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

	@ApiPropertyOptional({
		description: 'ID quận/huyện',
		example: 123,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	districtId?: number;

	@ApiPropertyOptional({
		description: 'ID tỉnh/thành phố',
		example: 79,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	provinceId?: number;

	@ApiPropertyOptional({
		description: 'Tên quốc gia',
		example: 'Vietnam',
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	country?: string;

	@ApiPropertyOptional({
		description: 'Vĩ độ GPS',
		example: 10.7626,
	})
	@IsOptional()
	@Transform(({ value }) => (value ? convertDecimalToNumber(value) : undefined))
	@IsDecimal({ decimal_digits: '1,7' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Kinh độ GPS',
		example: 106.6834,
	})
	@IsOptional()
	@Transform(({ value }) => (value ? convertDecimalToNumber(value) : undefined))
	@IsDecimal({ decimal_digits: '1,7' })
	longitude?: number;

	@ApiPropertyOptional({
		description: 'Trạng thái hoạt động',
		example: true,
	})
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}
