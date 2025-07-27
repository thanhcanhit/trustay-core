import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProvinceService } from './province.service';

@ApiTags('Provinces')
@Controller('api/provinces')
export class ProvinceController {
	constructor(private readonly provinceService: ProvinceService) {}

	@Get()
	@ApiOperation({ summary: 'Get all provinces' })
	@ApiResponse({
		status: 200,
		description: 'List of all provinces sorted by name',
	})
	findAll() {
		return this.provinceService.findAll();
	}
}
