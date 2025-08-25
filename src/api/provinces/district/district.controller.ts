import { BadRequestException, Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DistrictService } from './district.service';

@ApiTags('Districts')
@Controller('districts')
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
	findByProvince(@Query('provinceId', ParseIntPipe) provinceId?: number) {
		let id: number | undefined = provinceId;
		if (id === undefined && provinceId !== undefined) {
			id = Number(provinceId);
			if (Number.isNaN(id)) {
				throw new BadRequestException('provinceId must be a valid number');
			}
		}
		if (id === undefined) {
			throw new BadRequestException('province_id or provinceId must be provided');
		}
		return this.districtService.findByProvince(id);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get district by ID' })
	@ApiParam({ name: 'id', description: 'District ID', type: Number })
	@ApiResponse({
		status: 200,
		description: 'District details found',
	})
	@ApiResponse({
		status: 404,
		description: 'District not found',
	})
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.districtService.findOne(id);
	}
}
