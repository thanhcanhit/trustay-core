import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateRentalDto {
	@ApiPropertyOptional({
		description: 'Ngày kết thúc hợp đồng',
		example: '2024-08-01T00:00:00.000Z',
	})
	@IsOptional()
	@IsDateString()
	contractEndDate?: string;

	@ApiPropertyOptional({
		description: 'Trạng thái rental',
		enum: RentalStatus,
		example: 'active',
	})
	@IsOptional()
	@IsEnum(RentalStatus)
	status?: RentalStatus;

	@ApiPropertyOptional({
		description: 'URL document hợp đồng',
		example: 'https://example.com/contracts/contract-123.pdf',
	})
	@IsOptional()
	@IsString()
	contractDocumentUrl?: string;
}

export class TerminateRentalDto {
	@ApiProperty({
		description: 'Ngày thông báo chấm dứt hợp đồng',
		example: '2024-01-15T00:00:00.000Z',
	})
	@IsDateString()
	@IsNotEmpty()
	terminationNoticeDate: string;

	@ApiProperty({
		description: 'Lý do chấm dứt hợp đồng',
		example: 'Tenant vi phạm điều khoản hợp đồng',
	})
	@IsString()
	@IsNotEmpty()
	terminationReason: string;
}
