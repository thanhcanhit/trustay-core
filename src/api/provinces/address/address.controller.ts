import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AddressService } from './address.service';

@ApiTags('Address')
@Controller('address')
export class AddressController {
	constructor(private readonly addressService: AddressService) {}

	@Get('search')
	@ApiOperation({ summary: 'Search addresses by query' })
	@ApiQuery({
		name: 'query',
		description: 'Search term (minimum 2 characters)',
		example: 'Ha Noi',
	})
	@ApiResponse({
		status: 200,
		description: 'Search results for provinces, districts, and wards',
	})
	@ApiResponse({
		status: 400,
		description: 'Query must be at least 2 characters long',
	})
	search(@Query('query') query: string) {
		return this.addressService.search(query);
	}
}
