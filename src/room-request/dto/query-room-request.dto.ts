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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryRoomRequestDto extends PaginationQueryDto {
	@ApiPropertyOptional({ description: 'Lọc theo thành phố' })
	@IsOptional()
	@IsString()
	city?: string;

	@ApiPropertyOptional({ description: 'Lọc theo quận/huyện' })
	@IsOptional()
	@IsString()
	district?: string;

	@ApiPropertyOptional({ description: 'Lọc theo phường/xã' })
	@IsOptional()
	@IsString()
	ward?: string;

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
