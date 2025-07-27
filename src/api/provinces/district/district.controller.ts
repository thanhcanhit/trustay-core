import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DistrictService } from './district.service';

@ApiTags('Districts')
@Controller('api/districts')
export class DistrictController {
	constructor(private readonly districtService: DistrictService) {}

	@Get()
	@ApiOperation({ summary: 'Get districts by province ID' })
	@ApiQuery({
		name: 'province_id',
		description: 'Province ID',
		example: 1,
		type: Number,
	})
	@ApiResponse({
		status: 200,
		description: 'List of districts for the specified province',
	})
	findByProvince(@Query('province_id', ParseIntPipe) provinceId: number) {
		return this.districtService.findByProvince(provinceId);
	}
}
