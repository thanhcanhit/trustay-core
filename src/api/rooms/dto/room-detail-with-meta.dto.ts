import { ApiProperty } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { RoomDetailOutputDto } from '../../../common/dto/room-output.dto';

/**
 * Room detail response with SEO and breadcrumb metadata
 */
export class RoomDetailWithMetaResponseDto extends RoomDetailOutputDto {
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
