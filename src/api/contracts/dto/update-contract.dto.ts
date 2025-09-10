import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ContractStatus } from './contract-response.dto';

export class UpdateContractDto {
	@ApiProperty({
		enum: ContractStatus,
		description: 'Cập nhật trạng thái hợp đồng',
		required: false,
	})
	@IsOptional()
	@IsEnum(ContractStatus)
	status?: ContractStatus;

	@ApiProperty({ description: 'Cập nhật ngày kết thúc hợp đồng', required: false })
	@IsOptional()
	@IsDateString()
	endDate?: string;

	@ApiProperty({ description: 'Cập nhật URL tài liệu hợp đồng', required: false })
	@IsOptional()
	@IsString()
	documentUrl?: string;

	@ApiProperty({ description: 'Cập nhật ghi chú', required: false })
	@IsOptional()
	@IsString()
	notes?: string;
}

export class CreateContractAmendmentDto {
	@ApiProperty({ description: 'Loại sửa đổi' })
	@IsString()
	amendmentType: string;

	@ApiProperty({ description: 'Mô tả sửa đổi' })
	@IsString()
	description: string;

	@ApiProperty({ description: 'Dữ liệu thay đổi' })
	@IsObject()
	changes: Record<string, any>;

	@ApiProperty({ description: 'Ghi chú bổ sung', required: false })
	@IsOptional()
	@IsString()
	notes?: string;
}
