import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoommateApplicationStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkRespondApplicationsDto {
	@ApiProperty({
		description: 'Danh sách ID các đơn ứng tuyển',
		example: ['uuid1', 'uuid2', 'uuid3'],
	})
	@IsArray()
	@IsUUID('4', { each: true })
	applicationIds: string[];

	@ApiProperty({
		description: 'Quyết định áp dụng cho tất cả',
		enum: [
			RoommateApplicationStatus.approved_by_tenant,
			RoommateApplicationStatus.rejected_by_tenant,
			RoommateApplicationStatus.approved_by_landlord,
			RoommateApplicationStatus.rejected_by_landlord,
		],
	})
	@IsEnum([
		RoommateApplicationStatus.approved_by_tenant,
		RoommateApplicationStatus.rejected_by_tenant,
		RoommateApplicationStatus.approved_by_landlord,
		RoommateApplicationStatus.rejected_by_landlord,
	])
	status: RoommateApplicationStatus;

	@ApiPropertyOptional({ description: 'Lời nhắn phản hồi chung' })
	@IsOptional()
	@IsString()
	response?: string;
}

export class BulkResponseResultDto {
	@ApiProperty({ description: 'Số lượng đơn xử lý thành công' })
	successCount: number;

	@ApiProperty({ description: 'Số lượng đơn xử lý thất bại' })
	failureCount: number;

	@ApiProperty({ description: 'Danh sách lỗi (nếu có)' })
	errors: {
		applicationId: string;
		error: string;
	}[];

	@ApiProperty({ description: 'Danh sách đơn được xử lý thành công' })
	processedApplications: string[];
}
