import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BuildingQuickItemDto {
	@ApiProperty({ example: 'nha-tro-minh-phat-quan-1' })
	id: string;

	@ApiProperty({ example: 'Nhà trọ Minh Phát' })
	name: string;

	@ApiPropertyOptional({ example: '/images/1757854142834-a76f44bd-19d60dce93ed8871.jpg' })
	coverImage?: string;

	@ApiProperty({ example: { districtName: 'Quận 1', provinceName: 'Thành phố Hồ Chí Minh' } })
	location: { districtName: string; provinceName: string };

	@ApiProperty({ example: 12 })
	roomCount: number;
}
