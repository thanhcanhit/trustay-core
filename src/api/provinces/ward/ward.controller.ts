import { BadRequestException, Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WardService } from './ward.service';

@ApiTags('Wards')
@Controller('api/wards')
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
}
