import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmenityCategory, RoomType, SearchPostStatus } from '@prisma/client';
import { PersonPublicView } from '../../../common/serialization/person.view';

export class RoomRoomSeekingPostDto {
	@ApiProperty({ description: 'ID của bài đăng' })
	id: string;

	@ApiProperty({ description: 'Tiêu đề bài đăng' })
	title: string;

	@ApiProperty({ description: 'Mô tả chi tiết' })
	description: string;

	@ApiProperty({ description: 'Slug duy nhất' })
	slug: string;

	@ApiProperty({ description: 'ID của người đăng' })
	requesterId: string;

	@ApiPropertyOptional({ description: 'ID quận/huyện mong muốn' })
	preferredDistrictId?: number;

	@ApiPropertyOptional({ description: 'ID phường/xã mong muốn' })
	preferredWardId?: number;

	@ApiProperty({ description: 'ID tỉnh/thành phố mong muốn' })
	preferredProvinceId: number;

	@ApiPropertyOptional({ description: 'Ngân sách tối thiểu' })
	minBudget?: number;

	@ApiProperty({ description: 'Ngân sách tối đa' })
	maxBudget: number;

	@ApiProperty({ description: 'Đơn vị tiền tệ' })
	currency: string;

	@ApiPropertyOptional({ description: 'Loại phòng mong muốn' })
	preferredRoomType?: RoomType;

	@ApiPropertyOptional({ description: 'Số người sẽ ở' })
	occupancy?: number;

	@ApiPropertyOptional({ description: 'Thời gian dự định vào ở' })
	moveInDate?: Date;

	@ApiProperty({ description: 'Trạng thái bài đăng' })
	status: SearchPostStatus;

	@ApiProperty({ description: 'Có công khai hay không' })
	isPublic: boolean;

	@ApiPropertyOptional({ description: 'Thời gian hết hạn' })
	expiresAt?: Date;

	@ApiProperty({ description: 'Số lượt xem' })
	viewCount: number;

	@ApiProperty({ description: 'Số lượt liên hệ' })
	contactCount: number;

	@ApiProperty({ description: 'Thời gian tạo' })
	createdAt: Date;

	@ApiProperty({ description: 'Thời gian cập nhật' })
	updatedAt: Date;

	@ApiProperty({ description: 'Thông tin người đăng', type: PersonPublicView })
	requester: PersonPublicView;

	@ApiProperty({ description: 'Danh sách tiện ích mong muốn (SystemAmenity)' })
	amenities: Array<{
		id: string;
		name: string;
		nameEn: string;
		category: AmenityCategory;
		description?: string;
	}>;

	@ApiPropertyOptional({ description: 'Thông tin tỉnh/thành phố' })
	preferredProvince?: {
		id: number;
		name: string;
		nameEn?: string;
	};

	@ApiPropertyOptional({ description: 'Thông tin quận/huyện' })
	preferredDistrict?: {
		id: number;
		name: string;
		nameEn?: string;
	};

	@ApiPropertyOptional({ description: 'Thông tin phường/xã' })
	preferredWard?: {
		id: number;
		name: string;
		nameEn?: string;
	};
}
