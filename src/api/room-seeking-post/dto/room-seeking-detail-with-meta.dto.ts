import { ApiProperty } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { RoomRoomSeekingPostDto } from './room-seeking-post-response.dto';

/**
 * Room seeking detail response with SEO and breadcrumb metadata
 */
export class RoomSeekingDetailWithMetaResponseDto extends RoomRoomSeekingPostDto {
	@ApiProperty({
		description: 'SEO metadata for the page',
		type: SeoDto,
	})
	seo: SeoDto;

	@ApiProperty({
		description: 'Breadcrumb navigation for the page',
		type: BreadcrumbDto,
	})
	breadcrumb: BreadcrumbDto;
}
