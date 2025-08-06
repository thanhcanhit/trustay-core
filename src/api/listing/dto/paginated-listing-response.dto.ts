import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import { ListingItemDto } from './listing-item.dto';

export class PaginatedListingResponseDto extends PaginatedResponseDto<ListingItemDto> {
	@ApiProperty({ type: [ListingItemDto] })
	declare data: ListingItemDto[];
}
