import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateNested,
} from 'class-validator';

export class ContractDataDto {
	@ApiProperty({ description: 'Tiền thuê hàng tháng', example: 5000000 })
	@IsNotEmpty()
	@IsNumber()
	monthlyRent: number;

	@ApiProperty({ description: 'Tiền đặt cọc', example: 10000000 })
	@IsNotEmpty()
	@IsNumber()
	depositAmount: number;

	@ApiPropertyOptional({ description: 'Các điều khoản bổ sung' })
	@IsOptional()
	@IsString()
	additionalTerms?: string;

	@ApiPropertyOptional({ description: 'Quy tắc phòng', type: [String] })
	@IsOptional()
	rules?: string[];

	@ApiPropertyOptional({ description: 'Tiện nghi', type: [String] })
	@IsOptional()
	amenities?: string[];
}

export class CreateContractDto {
	@ApiPropertyOptional({ description: 'ID của rental (nếu tạo từ rental)' })
	@IsOptional()
	@IsUUID()
	rentalId?: string;

	@ApiProperty({ description: 'ID chủ nhà' })
	@IsNotEmpty()
	@IsUUID()
	landlordId: string;

	@ApiProperty({ description: 'ID khách thuê' })
	@IsNotEmpty()
	@IsUUID()
	tenantId: string;

	@ApiProperty({ description: 'ID phòng cụ thể' })
	@IsNotEmpty()
	@IsUUID()
	roomInstanceId: string;

	@ApiProperty({ enum: ContractType, description: 'Loại hợp đồng', default: 'monthly_rental' })
	@IsOptional()
	@IsEnum(ContractType)
	contractType?: ContractType;

	@ApiProperty({ description: 'Ngày bắt đầu hợp đồng (YYYY-MM-DD)', example: '2025-01-01' })
	@IsNotEmpty()
	@IsDateString()
	startDate: string;

	@ApiPropertyOptional({
		description: 'Ngày kết thúc hợp đồng (YYYY-MM-DD)',
		example: '2026-01-01',
	})
	@IsOptional()
	@IsDateString({}, { message: 'endDate must be a valid date string in format YYYY-MM-DD' })
	endDate?: string;

	@ApiProperty({ type: ContractDataDto, description: 'Dữ liệu hợp đồng (JSON)' })
	@IsNotEmpty()
	@ValidateNested()
	@Type(() => ContractDataDto)
	contractData: ContractDataDto;
}
