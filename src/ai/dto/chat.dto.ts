import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatDto {
	@ApiProperty({
		description: 'Câu hỏi hoặc yêu cầu của người dùng',
		example: 'Tìm phòng trọ giá rẻ ở quận 1',
	})
	@IsString()
	@IsNotEmpty()
	query: string;

	@ApiPropertyOptional({
		description: 'Pathname của trang hiện tại (từ frontend)',
		example: '/rooms/tuyenquan-go-vap-phong-ap1443',
	})
	@IsString()
	@IsOptional()
	currentPage?: string;
}
