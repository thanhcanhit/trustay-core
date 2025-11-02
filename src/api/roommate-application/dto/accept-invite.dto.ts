import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AcceptInviteDto {
	@ApiProperty({ description: 'Token từ invite link' })
	@IsString()
	token: string;

	@ApiPropertyOptional({ description: 'Ngày dự định chuyển vào (mặc định: hôm nay)' })
	@IsOptional()
	@IsDateString()
	moveInDate?: string;

	@ApiPropertyOptional({ description: 'Số tháng dự định ở' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	intendedStayMonths?: number;
}
