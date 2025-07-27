import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class PaginationMetaDto {
	@ApiProperty({
		description: 'Current page number',
		example: 1,
	})
	page: number;

	@ApiProperty({
		description: 'Number of items per page',
		example: 10,
	})
	limit: number;

	@ApiProperty({
		description: 'Total number of items',
		example: 100,
	})
	total: number;

	@ApiProperty({
		description: 'Total number of pages',
		example: 10,
	})
	totalPages: number;

	@ApiProperty({
		description: 'Whether there is a next page',
		example: true,
	})
	hasNext: boolean;

	@ApiProperty({
		description: 'Whether there is a previous page',
		example: false,
	})
	hasPrev: boolean;
}

export class PaginatedUsersResponseDto {
	@ApiProperty({
		description: 'List of users',
		type: [UserResponseDto],
	})
	data: UserResponseDto[];

	@ApiProperty({
		description: 'Pagination metadata',
		type: PaginationMetaDto,
	})
	meta: PaginationMetaDto;
}
