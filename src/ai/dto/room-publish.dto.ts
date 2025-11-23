import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class RoomPublishDto {
	@ApiPropertyOptional({
		description:
			'Tin nhắn của người dùng về thông tin phòng cần đăng. Nếu để trống và status = READY_TO_CREATE, sẽ tạo phòng luôn',
		example: '1 phòng 2 triệu, cọc 1 triệu, toà nhà Kahn, gò vấp hồ chí minh. Điện 3k nước 5k',
	})
	@IsString()
	@IsOptional()
	message?: string;

	@ApiPropertyOptional({
		description:
			'ID hoặc slug của building (nếu đã biết). Nếu có, sẽ bỏ qua bước tìm/select building',
		example: '02a927ba-c5e4-40e3-a64c-0187c9b35e33 hoặc nha-tro-sinh-vien-nguyen-van-bao-go-vap',
	})
	@IsString()
	@IsOptional()
	buildingId?: string;

	@ApiPropertyOptional({
		description: 'Danh sách đường dẫn hình ảnh phòng',
		type: [String],
		example: ['/images/photo1.jpg', '/images/photo2.jpg'],
	})
	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	images?: string[];
}
