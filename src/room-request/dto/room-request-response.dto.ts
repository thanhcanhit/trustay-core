import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmenityCategory, RoomType, SearchPostStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class RoomRequestAmenityResponseDto {
	@ApiProperty({ description: 'ID của tiện ích' })
	id: string;

	@ApiProperty({ description: 'ID của bài đăng' })
	roomRequestId: string;

	@ApiProperty({ description: 'ID của tiện ích hệ thống' })
	systemAmenityId: string;

	@ApiProperty({ description: 'Tiện ích có bắt buộc hay không' })
	isRequired: boolean;

	@ApiPropertyOptional({ description: 'Giá trị tùy chỉnh' })
	customValue?: string;

	@ApiPropertyOptional({ description: 'Ghi chú' })
	notes?: string;

	@ApiProperty({ description: 'Thời gian tạo' })
	createdAt: Date;

	@ApiProperty({ description: 'Thông tin tiện ích hệ thống' })
	systemAmenity: {
		id: string;
		name: string;
		nameEn: string;
		category: AmenityCategory;
		description?: string;
	};
}

export class RoomRequestResponseDto {
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

	@ApiPropertyOptional({ description: 'Quận/huyện mong muốn' })
	preferredDistrict?: string;

	@ApiPropertyOptional({ description: 'Phường/xã mong muốn' })
	preferredWard?: string;

	@ApiProperty({ description: 'Thành phố mong muốn' })
	preferredCity: string;

	@ApiPropertyOptional({ description: 'Ngân sách tối thiểu' })
	minBudget?: Decimal;

	@ApiProperty({ description: 'Ngân sách tối đa' })
	maxBudget: Decimal;

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

	@ApiProperty({ description: 'Thông tin người đăng' })
	requester: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		phone?: string;
		avatarUrl?: string;
	};

	@ApiProperty({ description: 'Danh sách tiện ích mong muốn' })
	amenities: RoomRequestAmenityResponseDto[];
}
