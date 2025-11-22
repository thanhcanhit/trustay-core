import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

	@ApiPropertyOptional({
		description: 'Danh sách đường dẫn hình ảnh (cho room publishing)',
		example: ['/images/photo1.jpg', '/images/photo2.jpg'],
		type: [String],
	})
	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	images?: string[];
}
