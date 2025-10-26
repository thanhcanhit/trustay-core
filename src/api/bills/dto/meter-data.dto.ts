import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class MeterDataDto {
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
