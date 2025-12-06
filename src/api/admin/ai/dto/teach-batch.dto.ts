import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';

class TeachItemDto {
	@ApiProperty({ example: 'Liệt kê phòng diện tích > 30m2' })
	@IsString()
	@IsNotEmpty()
	question!: string;

	@ApiProperty({ example: 'SELECT * FROM rooms WHERE area_sqm > 30;' })
	@IsString()
	@IsNotEmpty()
	sql!: string;

	@ApiProperty({ required: false, description: 'ID để update nếu có' })
	@IsOptional()
	@IsString()
	id?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	sessionId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	userId?: string;
}

export class TeachBatchDto {
	@ApiProperty({
		type: [TeachItemDto],
		description: 'Danh sách Q&A để nạp (từ nội dung JSON)',
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TeachItemDto)
	items!: TeachItemDto[];

	@ApiProperty({
		required: false,
		default: false,
		description: 'Dừng ngay khi có lỗi (mặc định false: bỏ qua lỗi lẻ)',
	})
	@IsOptional()
	@IsBoolean()
	@Type(() => Boolean)
	failFast?: boolean = false;
}
