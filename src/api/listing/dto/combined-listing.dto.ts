import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BreadcrumbDto, SeoDto } from '../../../common/dto';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { RoomListItemOutputDto } from '../../../common/dto/room-output.dto';

export class RoommateSeekingPostDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	type: 'roommate_seeking';

	@ApiProperty()
	title: string;

	@ApiProperty()
	description: string;

	@ApiProperty()
	slug: string;

	@ApiPropertyOptional()
	minBudget?: number;

	@ApiProperty()
	maxBudget: number;

	@ApiProperty()
	currency: string;

	@ApiPropertyOptional()
	preferredRoomType?: string;

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

	@ApiProperty()
	requester: {
		id: string;
		name: string;
		email?: string;
		phone?: string;
		avatarUrl?: string;
	};

	@ApiPropertyOptional()
	preferredProvince?: {
		id: number;
		name: string;
	};

	@ApiPropertyOptional()
	preferredDistrict?: {
		id: number;
		name: string;
	};

	@ApiPropertyOptional()
	preferredWard?: {
		id: number;
		name: string;
	};

	@ApiProperty({ type: [Object] })
	amenities: Array<{
		id: string;
		name: string;
		category: string;
	}>;
}

export class RoomListingDto extends RoomListItemOutputDto {
	@ApiProperty()
	type: 'room';
}

export type CombinedListingItem = RoomListingDto | RoommateSeekingPostDto;

export class CombinedListingWithMetaResponseDto extends PaginatedResponseDto<CombinedListingItem> {
	@ApiProperty({
		type: [Object],
		description: 'Combined array of room listings and roommate seeking posts',
	})
	declare data: CombinedListingItem[];

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
		description: 'Statistics about the combined results',
	})
	stats: {
		totalRooms: number;
		totalRoommateSeekingPosts: number;
	};
}
