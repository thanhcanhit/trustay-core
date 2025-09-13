import { ApiProperty } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { RoomListItemOutputDto } from '../../../common/dto/room-output.dto';

/**
 * Room listing response with SEO and breadcrumb metadata
 */
export class ListingWithMetaResponseDto extends PaginatedResponseDto<RoomListItemOutputDto> {
	@ApiProperty({ type: [RoomListItemOutputDto] })
	declare data: RoomListItemOutputDto[];

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
