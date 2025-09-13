import { ApiProperty } from '@nestjs/swagger';

/**
 * SEO metadata DTO for API responses
 * Core SEO fields only - frontend handles the rest
 */
export class SeoDto {
	@ApiProperty({
		description: 'Page title for SEO',
		example: 'Phòng trọ Quận 9 - Giá rẻ, đầy đủ tiện nghi | Trustay',
	})
	title: string;

	@ApiProperty({
		description: 'Meta description for SEO',
		example:
			'Tìm phòng trọ Quận 9 giá rẻ, đầy đủ tiện nghi. Hàng ngàn phòng trọ chất lượng cao, giá tốt nhất tại TP.HCM. Đặt phòng ngay!',
	})
	description: string;

	@ApiProperty({
		description: 'SEO keywords separated by commas',
		example: 'phòng trọ quận 9, nhà trọ giá rẻ, thuê phòng quận 9, phòng trọ đầy đủ tiện nghi',
	})
	keywords: string;
}
