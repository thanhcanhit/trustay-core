import { Controller, Get, Query } from '@nestjs/common';
import { AddressService } from './address.service';

@Controller('api/address')
export class AddressController {
	constructor(private readonly addressService: AddressService) {}

	@Get('search')
	search(@Query('q') query: string) {
		return this.addressService.search(query);
	}
}
