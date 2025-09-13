import { ApiProperty } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { RoomRoomSeekingPostDto } from '../../room-seeking-post/dto/room-seeking-post-response.dto';

/**
 * Room seeking response with SEO and breadcrumb metadata
 */
export class RoomSeekingWithMetaResponseDto extends PaginatedResponseDto<RoomRoomSeekingPostDto> {
	@ApiProperty({ type: [RoomRoomSeekingPostDto] })
	declare data: RoomRoomSeekingPostDto[];

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
