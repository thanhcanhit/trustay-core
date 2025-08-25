import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType, SearchPostStatus } from '@prisma/client';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryRoomRequestDto extends PaginationQueryDto {
	@ApiPropertyOptional({ description: 'Lọc theo ID tỉnh/thành phố' })
	@IsOptional()
	@IsNumber()
	provinceId?: number;

	@ApiPropertyOptional({ description: 'Lọc theo ID quận/huyện' })
	@IsOptional()
	@IsNumber()
	districtId?: number;

	@ApiPropertyOptional({ description: 'Lọc theo ID phường/xã' })
	@IsOptional()
	@IsNumber()
	wardId?: number;

	@ApiPropertyOptional({ description: 'Ngân sách tối thiểu' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	minBudget?: number;

	@ApiPropertyOptional({ description: 'Ngân sách tối đa' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	maxBudget?: number;

	@ApiPropertyOptional({ description: 'Lọc theo loại phòng', enum: RoomType })
	@IsOptional()
	@IsEnum(RoomType)
	roomType?: RoomType;

	@ApiPropertyOptional({ description: 'Lọc theo số người ở' })
	@IsOptional()
	@IsNumber()
	@Min(1)
	@Max(10)
	occupancy?: number;

	@ApiPropertyOptional({ description: 'Lọc theo trạng thái', enum: SearchPostStatus })
	@IsOptional()
	@IsEnum(SearchPostStatus)
	status?: SearchPostStatus;

	@ApiPropertyOptional({ description: 'Lọc theo trạng thái công khai' })
	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;

	@ApiPropertyOptional({ description: 'Lọc theo người đăng' })
	@IsOptional()
	@IsString()
	requesterId?: string;
}
