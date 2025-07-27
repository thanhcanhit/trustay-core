import { Controller, Get } from '@nestjs/common';
import { ProvinceService } from './province.service';

@Controller('api/provinces')
export class ProvinceController {
	constructor(private readonly provinceService: ProvinceService) {}

	@Get()
	findAll() {
		return this.provinceService.findAll();
	}
}
