import { ApiProperty } from '@nestjs/swagger';

export class ChartPointDto {
	@ApiProperty({ example: '2025-11-01' })
	readonly x: string;

	@ApiProperty({ example: 12.5 })
	readonly y: number;

	@ApiProperty({ example: 'Chi tiết hiển thị thêm', required: false })
	readonly tooltip?: string;
}

export class ChartDatasetDto {
	@ApiProperty({ example: 'Tổng doanh thu' })
	readonly label: string;

	@ApiProperty({ example: '#3B82F6', required: false })
	readonly color?: string;

	@ApiProperty({ type: () => ChartPointDto, isArray: true })
	readonly points: ChartPointDto[];
}

export class ChartMetaDto {
	@ApiProperty({ example: 'VND', required: false })
	readonly unit?: string;

	@ApiProperty({
		example: { start: '2025-11-01T00:00:00.000Z', end: '2025-11-30T23:59:59.999Z' },
		required: false,
	})
	readonly period?: { start: string; end: string };

	@ApiProperty({
		example: { buildingId: 'building-123', referenceMonth: '2025-11' },
		required: false,
	})
	readonly filters?: Record<string, string>;
}

export class ChartResponseDto {
	@ApiProperty({ example: 'line' })
	readonly type: 'line' | 'bar' | 'pie';

	@ApiProperty({ example: 'Doanh thu theo ngày' })
	readonly title: string;

	@ApiProperty({ example: 'Theo dõi biến động doanh thu trong tháng', required: false })
	readonly description?: string;

	@ApiProperty({ type: () => ChartMetaDto })
	readonly meta: ChartMetaDto;

	@ApiProperty({ type: () => ChartDatasetDto, isArray: true })
	readonly dataset: ChartDatasetDto[];
}
