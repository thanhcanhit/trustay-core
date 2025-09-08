import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ContractStatus } from './contract-response.dto';

export class QueryContractDto extends PaginationQueryDto {
	@ApiProperty({ description: 'ID của rental', required: false })
	@IsOptional()
	@IsUUID()
	rentalId?: string;

	@ApiProperty({ enum: ContractStatus, description: 'Trạng thái hợp đồng', required: false })
	@IsOptional()
	@IsEnum(ContractStatus)
	status?: ContractStatus;

	@ApiProperty({ description: 'Từ ngày bắt đầu', required: false })
	@IsOptional()
	@IsDateString()
	fromStartDate?: string;

	@ApiProperty({ description: 'Đến ngày bắt đầu', required: false })
	@IsOptional()
	@IsDateString()
	toStartDate?: string;

	@ApiProperty({ description: 'Từ ngày kết thúc', required: false })
	@IsOptional()
	@IsDateString()
	fromEndDate?: string;

	@ApiProperty({ description: 'Đến ngày kết thúc', required: false })
	@IsOptional()
	@IsDateString()
	toEndDate?: string;

	@ApiProperty({ description: 'ID chủ nhà', required: false })
	@IsOptional()
	@IsUUID()
	landlordId?: string;

	@ApiProperty({ description: 'ID khách thuê', required: false })
	@IsOptional()
	@IsUUID()
	tenantId?: string;
}
