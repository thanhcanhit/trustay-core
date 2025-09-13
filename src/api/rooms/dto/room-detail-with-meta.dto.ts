import { ApiProperty } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { RoomDetailOutputDto, RoomListItemOutputDto } from '../../../common/dto/room-output.dto';

/**
 * Room detail response with SEO, breadcrumb metadata and similar rooms
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

	@ApiProperty({
		description: 'Similar rooms in the same district and province',
		type: [RoomListItemOutputDto],
	})
	similarRooms: RoomListItemOutputDto[];
}
