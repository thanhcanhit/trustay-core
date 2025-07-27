import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { DistrictService } from './district.service';

@Controller('api/districts')
export class DistrictController {
	constructor(private readonly districtService: DistrictService) {}

	@Get()
	findByProvince(@Query('province_id', ParseIntPipe) provinceId: number) {
		return this.districtService.findByProvince(provinceId);
	}
}
