import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoomInstanceStatusDto {
	@ApiProperty({
		description: 'Trạng thái mới của room instance',
		enum: RoomStatus,
		example: RoomStatus.maintenance,
		enumName: 'RoomStatus',
	})
	@IsEnum(RoomStatus, {
		message: 'Status must be one of: available, occupied, maintenance, reserved, unavailable',
	})
	status: RoomStatus;

	@ApiPropertyOptional({
		description: 'Lý do thay đổi trạng thái',
		example: 'Sửa chữa điều hòa và sơn lại tường',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500, {
		message: 'Reason must not exceed 500 characters',
	})
	reason?: string;
}

export class BulkUpdateRoomInstanceStatusDto {
	@ApiProperty({
		description: 'Danh sách room instance IDs cần update',
		example: ['uuid-instance-1', 'uuid-instance-2', 'uuid-instance-3'],
		type: [String],
	})
	@IsString({ each: true })
	roomInstanceIds: string[];

	@ApiProperty({
		description: 'Trạng thái mới cho tất cả room instances',
		enum: RoomStatus,
		example: RoomStatus.maintenance,
		enumName: 'RoomStatus',
	})
	@IsEnum(RoomStatus, {
		message: 'Status must be one of: available, occupied, maintenance, reserved, unavailable',
	})
	status: RoomStatus;

	@ApiPropertyOptional({
		description: 'Lý do thay đổi trạng thái chung',
		example: 'Bảo trì định kỳ tòa nhà',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500, {
		message: 'Reason must not exceed 500 characters',
	})
	reason?: string;
}
