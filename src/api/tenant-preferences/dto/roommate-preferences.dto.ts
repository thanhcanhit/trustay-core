import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsIn,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
} from 'class-validator';

export class CreateRoommatePreferencesDto {
	@ApiPropertyOptional({ description: 'Giới tính ưu tiên', enum: Gender })
	@IsOptional()
	@IsEnum(Gender)
	preferredGender?: Gender;

	@ApiPropertyOptional({ description: 'Tuổi tối thiểu', example: 18 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(18)
	@Max(100)
	preferredAgeMin?: number;

	@ApiPropertyOptional({ description: 'Tuổi tối đa', example: 35 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(18)
	@Max(100)
	preferredAgeMax?: number;

	@ApiPropertyOptional({ description: 'Cho phép hút thuốc', default: false })
	@IsOptional()
	@IsBoolean()
	allowsSmoking?: boolean;

	@ApiPropertyOptional({ description: 'Cho phép nuôi thú cưng', default: false })
	@IsOptional()
	@IsBoolean()
	allowsPets?: boolean;

	@ApiPropertyOptional({ description: 'Cho phép đưa khách về', default: true })
	@IsOptional()
	@IsBoolean()
	allowsGuests?: boolean;

	@ApiPropertyOptional({
		description: 'Mức độ sạch sẽ mong muốn (1-5)',
		example: 4,
		minimum: 1,
		maximum: 5,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	@Max(5)
	cleanlinessLevel?: number;

	@ApiPropertyOptional({
		description: 'Mức độ tương tác xã hội (1-5)',
		example: 3,
		minimum: 1,
		maximum: 5,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	@Max(5)
	socialInteractionLevel?: number;

	@ApiPropertyOptional({
		description: 'Những điều không thể chấp nhận',
		type: [String],
		example: ['smoking', 'pets', 'loud_music'],
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	dealBreakers?: string[];

	@ApiPropertyOptional({ description: 'Kích hoạt preferences', default: true })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class UpdateRoommatePreferencesDto extends CreateRoommatePreferencesDto {}

export class RoommatePreferencesResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	tenantId: string;

	@ApiPropertyOptional({ enum: Gender })
	preferredGender?: Gender;

	@ApiPropertyOptional()
	preferredAgeMin?: number;

	@ApiPropertyOptional()
	preferredAgeMax?: number;

	@ApiProperty()
	allowsSmoking: boolean;

	@ApiProperty()
	allowsPets: boolean;

	@ApiProperty()
	allowsGuests: boolean;

	@ApiPropertyOptional()
	cleanlinessLevel?: number;

	@ApiPropertyOptional()
	socialInteractionLevel?: number;

	@ApiPropertyOptional({ type: [String] })
	dealBreakers?: string[];

	@ApiProperty()
	isActive: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}
