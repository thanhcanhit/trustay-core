import { BadRequestException, Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
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
		required: false,
	})
	@ApiQuery({
		name: 'provinceId',
		description: 'Province ID (camelCase alternative)',
		example: 1,
		type: Number,
		required: false,
	})
	@ApiResponse({
		status: 200,
		description: 'List of districts for the specified province',
	})
	findByProvince(
		@Query('province_id') province_id: string,
		@Query('provinceId') provinceId: string,
	) {
		const id = Number(province_id ?? provinceId);
		if (isNaN(id)) {
			throw new BadRequestException('province_id or provinceId must be a valid number');
		}
		return this.districtService.findByProvince(id);
	}
}
