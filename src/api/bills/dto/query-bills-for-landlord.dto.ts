import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryBillsForLandlordDto {
	@ApiPropertyOptional({ description: 'ID của building' })
	@IsOptional()
	@IsString()
	buildingId?: string;

	@ApiPropertyOptional({ description: 'ID của room instance (để lọc theo building + room)' })
	@IsOptional()
	@IsString()
	roomInstanceId?: string;

	@ApiPropertyOptional({ description: 'Kỳ hóa đơn (format: YYYY-MM)', example: '2025-01' })
	@IsOptional()
	@IsString()
	billingPeriod?: string;

	@ApiPropertyOptional({ description: 'Tháng hóa đơn (1-12)', example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	billingMonth?: number;

	@ApiPropertyOptional({ description: 'Năm hóa đơn', example: 2025 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(2020)
	billingYear?: number;

	@ApiPropertyOptional({ description: 'Trạng thái hóa đơn' })
	@IsOptional()
	@IsEnum(BillStatus)
	status?: BillStatus;

	@ApiPropertyOptional({
		description: 'Tìm kiếm theo tên phòng hoặc số phòng',
		example: 'Phòng đôi',
	})
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({
		description: 'Sắp xếp theo trường',
		enum: ['roomName', 'status', 'totalAmount', 'createdAt', 'dueDate'],
		default: 'roomName',
	})
	@IsOptional()
	@IsString()
	@IsIn(['roomName', 'status', 'totalAmount', 'createdAt', 'dueDate'])
	sortBy?: string = 'roomName';

	@ApiPropertyOptional({
		description: 'Thứ tự sắp xếp',
		enum: ['asc', 'desc'],
		default: 'asc',
	})
	@IsOptional()
	@IsString()
	@IsIn(['asc', 'desc'])
	sortOrder?: 'asc' | 'desc' = 'asc';

	@ApiPropertyOptional({ description: 'Trang', example: 1, default: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Số lượng mỗi trang',
		example: 20,
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;
}
