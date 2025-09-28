import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
} from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum';

export class CreateRoommateSeekingPostDto {
	@ApiProperty({ description: 'Tiêu đề bài đăng tìm người ở ghép' })
	@IsString()
	title: string;

	@ApiProperty({ description: 'Mô tả chi tiết về phòng và yêu cầu' })
	@IsString()
	description: string;

	// Platform room info - optional
	@ApiPropertyOptional({ description: 'ID phòng trong hệ thống (nếu có)' })
	@IsOptional()
	@IsUUID()
	roomInstanceId?: string;

	@ApiPropertyOptional({ description: 'ID hợp đồng thuê hiện tại (nếu có)' })
	@IsOptional()
	@IsUUID()
	rentalId?: string;

	// External room info - optional
	@ApiPropertyOptional({ description: 'Địa chỉ phòng ngoài hệ thống' })
	@IsOptional()
	@IsString()
	externalAddress?: string;

	@ApiPropertyOptional({ description: 'ID tỉnh/thành phố (phòng ngoài hệ thống)' })
	@IsOptional()
	@IsNumber()
	externalProvinceId?: number;

	@ApiPropertyOptional({ description: 'ID quận/huyện (phòng ngoài hệ thống)' })
	@IsOptional()
	@IsNumber()
	externalDistrictId?: number;

	@ApiPropertyOptional({ description: 'ID phường/xã (phòng ngoài hệ thống)' })
	@IsOptional()
	@IsNumber()
	externalWardId?: number;

	@ApiProperty({ description: 'Giá thuê hàng tháng (VNĐ)' })
	@IsNumber()
	@Min(0)
	monthlyRent: number;

	@ApiPropertyOptional({ description: 'Đơn vị tiền tệ', default: 'VND' })
	@IsOptional()
	@IsString()
	currency?: string;

	@ApiProperty({ description: 'Tiền đặt cọc (VNĐ)' })
	@IsNumber()
	@Min(0)
	depositAmount: number;

	@ApiPropertyOptional({ description: 'Chi phí điện nước mỗi người/tháng (VNĐ)' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	utilityCostPerPerson?: number;

	@ApiProperty({ description: 'Số người cần tìm' })
	@IsNumber()
	@Min(1)
	seekingCount: number;

	@ApiProperty({ description: 'Tối đa số người ở ghép' })
	@IsNumber()
	@Min(1)
	maxOccupancy: number;

	@ApiPropertyOptional({ description: 'Số người hiện tại đang ở', default: 1 })
	@IsOptional()
	@IsNumber()
	@Min(1)
	currentOccupancy?: number;

	@ApiPropertyOptional({ description: 'Giới tính ưu tiên', enum: Gender })
	@IsOptional()
	@IsEnum(Gender)
	preferredGender?: Gender;

	@ApiPropertyOptional({ description: 'Các yêu cầu bổ sung' })
	@IsOptional()
	@IsString()
	additionalRequirements?: string;

	@ApiProperty({ description: 'Ngày có thể vào ở' })
	@IsDateString()
	availableFromDate: string;

	@ApiPropertyOptional({ description: 'Số tháng ở tối thiểu', default: 1 })
	@IsOptional()
	@IsNumber()
	@Min(1)
	minimumStayMonths?: number;

	@ApiPropertyOptional({ description: 'Số tháng ở tối đa' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	maximumStayMonths?: number;

	@ApiPropertyOptional({ description: 'Có cần phê duyệt từ chủ trọ không', default: false })
	@IsOptional()
	@IsBoolean()
	requiresLandlordApproval?: boolean;

	@ApiPropertyOptional({ description: 'Thời gian hết hạn bài đăng' })
	@IsOptional()
	@IsDateString()
	expiresAt?: string;
}
