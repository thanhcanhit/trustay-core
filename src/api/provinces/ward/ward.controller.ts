import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { WardService } from './ward.service';

@Controller('api/wards')
export class WardController {
	constructor(private readonly wardService: WardService) {}

	@Get()
	findByDistrict(@Query('district_id', ParseIntPipe) districtId: number) {
		return this.wardService.findByDistrict(districtId);
	}
}
