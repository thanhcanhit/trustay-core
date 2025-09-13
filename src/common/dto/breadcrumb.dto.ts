import { ApiProperty } from '@nestjs/swagger';

/**
 * Individual breadcrumb item DTO
 * Only path and title - frontend handles the rest
 */
export class BreadcrumbItemDto {
	@ApiProperty({
		description: 'Display text for the breadcrumb item',
		example: 'Trang chủ',
	})
	title: string;

	@ApiProperty({
		description: 'URL path for the breadcrumb item',
		example: '/',
	})
	path: string;
}

/**
 * Breadcrumb navigation DTO
 * Complete breadcrumb trail for a page
 */
export class BreadcrumbDto {
	@ApiProperty({
		description: 'Array of breadcrumb items in order',
		type: [BreadcrumbItemDto],
		example: [
			{ title: 'Trang chủ', path: '/' },
			{ title: 'Tìm phòng trọ', path: '/rooms' },
			{ title: 'Quận 9', path: '/rooms?district=quan-9' },
			{ title: 'Phòng VIP Deluxe', path: '/rooms/phong-vip-deluxe' },
		],
	})
	items: BreadcrumbItemDto[];
}
