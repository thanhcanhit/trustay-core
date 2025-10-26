import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRentalDto {
	@ApiPropertyOptional({
		description: 'ID của room booking (nếu rental tạo từ room booking)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	bookingRequestId?: string;

	@ApiPropertyOptional({
		description: 'ID của room invitation (nếu rental tạo từ invitation)',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsUUID()
	invitationId?: string;

	@ApiProperty({
		description: 'ID của room instance',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	@IsNotEmpty()
	roomInstanceId: string;

	@ApiProperty({
		description: 'ID của tenant',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	@IsNotEmpty()
	tenantId: string;

	@ApiProperty({
		description: 'Ngày bắt đầu hợp đồng',
		example: '2024-02-01T00:00:00.000Z',
	})
	@IsDateString()
	@IsNotEmpty()
	contractStartDate: string;

	@ApiPropertyOptional({
		description: 'Ngày kết thúc hợp đồng',
		example: '2024-08-01T00:00:00.000Z',
	})
	@IsOptional()
	@IsDateString()
	contractEndDate?: string;

	@ApiProperty({
		description: 'Tiền thuê hàng tháng',
		example: '3500000',
	})
	@IsString()
	@IsNotEmpty()
	monthlyRent: string;

	@ApiProperty({
		description: 'Tiền cọc đã trả',
		example: '7000000',
	})
	@IsString()
	@IsNotEmpty()
	depositPaid: string;

	@ApiPropertyOptional({
		description: 'URL document hợp đồng',
		example: 'https://example.com/contracts/contract-123.pdf',
	})
	@IsOptional()
	@IsString()
	contractDocumentUrl?: string;
}
