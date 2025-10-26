import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class MeterDataInputDto {
	@ApiProperty({ description: 'ID của room cost (metered type)' })
	@IsString()
	roomCostId: string;

	@ApiProperty({ description: 'Số đồng hồ hiện tại', example: 1500.5 })
	@IsNumber()
	@Min(0)
	currentReading: number;

	@ApiProperty({ description: 'Số đồng hồ tháng trước', example: 1200.0 })
	@IsNumber()
	@Min(0)
	lastReading: number;
}

export class UpdateBillWithMeterDataDto {
	@ApiProperty({ description: 'ID của bill cần cập nhật' })
	@IsString()
	billId: string;

	@ApiProperty({ description: 'Số người ở trong kỳ (cho per_person costs)', example: 2 })
	@IsNumber()
	@Min(1)
	occupancyCount: number;

	@ApiProperty({ description: 'Dữ liệu đồng hồ cho metered costs', type: [MeterDataInputDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MeterDataInputDto)
	meterData: MeterDataInputDto[];
}
