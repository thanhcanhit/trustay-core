import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { PersonPublicView } from '../../../common/serialization/person.view';

export class RoommateSeekingListItemDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	title: string;

	@ApiProperty()
	description: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	maxBudget: number;

	@ApiProperty()
	currency: string;

	@ApiProperty()
	occupancy: number;

	@ApiPropertyOptional()
	moveInDate?: Date;

	@ApiProperty()
	status: string;

	@ApiProperty()
	viewCount: number;

	@ApiProperty()
	contactCount: number;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty({
		description: 'Requester information. Sensitive fields are masked when unauthenticated.',
		type: PersonPublicView,
	})
	requester: PersonPublicView;
}

export class RoommateSeekingWithMetaResponseDto extends PaginatedResponseDto<RoommateSeekingListItemDto> {
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
