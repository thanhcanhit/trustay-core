import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
} from 'class-validator';

export class CreateRoommateApplicationDto {
	@ApiProperty({ description: 'ID bài đăng tìm người ở ghép' })
	@IsUUID()
	roommateSeekingPostId: string;

	@ApiProperty({ description: 'Họ và tên đầy đủ' })
	@IsString()
	fullName: string;

	@ApiPropertyOptional({ description: 'Nghề nghiệp' })
	@IsOptional()
	@IsString()
	occupation?: string;

	@ApiProperty({ description: 'Số điện thoại' })
	@IsString()
	phoneNumber: string;

	@ApiProperty({ description: 'Ngày dự định chuyển vào' })
	@IsDateString()
	moveInDate: string;

	@ApiPropertyOptional({ description: 'Số tháng dự định ở' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	intendedStayMonths?: number;

	@ApiPropertyOptional({ description: 'Lời nhắn ứng tuyển' })
	@IsOptional()
	@IsString()
	applicationMessage?: string;

	@ApiPropertyOptional({ description: 'Đánh dấu ứng tuyển khẩn cấp', default: false })
	@IsOptional()
	@IsBoolean()
	isUrgent?: boolean;
}
