import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDateString,
	IsEmail,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf,
} from 'class-validator';

export class AddRoommateDirectlyDto {
	@ApiPropertyOptional({
		description: 'ID của user cần thêm vào phòng (nếu biết userId)',
	})
	@IsOptional()
	@IsUUID()
	@ValidateIf((o) => !o.email && !o.phone)
	userId?: string;

	@ApiPropertyOptional({
		description: 'Email của user cần thêm vào phòng (nếu biết email)',
	})
	@IsOptional()
	@IsEmail()
	@ValidateIf((o) => !o.userId && !o.phone)
	email?: string;

	@ApiPropertyOptional({
		description: 'Số điện thoại của user cần thêm vào phòng (nếu biết số điện thoại)',
	})
	@IsOptional()
	@IsString()
	@ValidateIf((o) => !o.userId && !o.email)
	phone?: string;

	@ApiProperty({ description: 'Ngày dự định chuyển vào' })
	@IsDateString()
	moveInDate: string;

	@ApiPropertyOptional({ description: 'Số tháng dự định ở' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	intendedStayMonths?: number;
}
