import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoommateApplicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryRoommateApplicationDto {
	@ApiPropertyOptional({
		description: 'Số trang',
		example: 1,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Số lượng mỗi trang',
		example: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Lọc theo trạng thái',
		enum: RoommateApplicationStatus,
		example: 'pending',
	})
	@IsOptional()
	@IsEnum(RoommateApplicationStatus)
	status?: RoommateApplicationStatus;

	@ApiPropertyOptional({
		description: 'Tìm kiếm theo tên ứng viên',
		example: 'Nguyễn Văn A',
	})
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({
		description: 'Lọc theo ID bài đăng roommate seeking',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsString()
	roommateSeekingPostId?: string;

	@ApiPropertyOptional({
		description: 'Chỉ lấy các đơn ứng tuyển khẩn cấp',
		example: true,
	})
	@IsOptional()
	isUrgent?: boolean;

	@ApiPropertyOptional({
		description: 'Sắp xếp theo',
		enum: ['createdAt', 'moveInDate', 'updatedAt'],
		example: 'createdAt',
	})
	@IsOptional()
	@IsString()
	sortBy?: 'createdAt' | 'moveInDate' | 'updatedAt' = 'createdAt';

	@ApiPropertyOptional({
		description: 'Thứ tự sắp xếp',
		enum: ['asc', 'desc'],
		example: 'desc',
	})
	@IsOptional()
	@IsString()
	sortOrder?: 'asc' | 'desc' = 'desc';
}
