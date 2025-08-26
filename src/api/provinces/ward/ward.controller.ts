import { BadRequestException, Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WardService } from './ward.service';

@ApiTags('Wards')
@Controller('wards')
export class WardController {
	constructor(private readonly wardService: WardService) {}

	@Get()
	@ApiOperation({ summary: 'Get wards by district ID' })
	@ApiQuery({
		name: 'district_id',
		description: 'District ID',
		example: 1,
		type: Number,
		required: false,
	})
	@ApiQuery({
		name: 'districtId',
		description: 'District ID (camelCase alternative)',
		example: 1,
		type: Number,
		required: false,
	})
	@ApiResponse({
		status: 200,
		description: 'List of wards for the specified district',
	})
	findByDistrict(@Query('districtId', ParseIntPipe) districtId?: number) {
		let id: number | undefined = districtId;
		if (id === undefined && districtId !== undefined) {
			id = Number(districtId);
			if (Number.isNaN(id)) {
				throw new BadRequestException('districtId must be a valid number');
			}
		}
		if (id === undefined) {
			throw new BadRequestException('district_id or districtId must be provided');
		}
		return this.wardService.findByDistrict(id);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get ward by ID' })
	@ApiParam({ name: 'id', description: 'Ward ID', type: Number })
	@ApiResponse({
		status: 200,
		description: 'Ward details found',
	})
	@ApiResponse({
		status: 404,
		description: 'Ward not found',
	})
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.wardService.findOne(id);
	}
}
