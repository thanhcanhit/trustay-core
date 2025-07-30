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
	findByDistrict(
		@Query('district_id') district_id: string,
		@Query('districtId') districtId: string,
	) {
		const id = Number(district_id ?? districtId);
		if (isNaN(id)) {
			throw new BadRequestException('district_id or districtId must be a valid number');
		}
		return this.wardService.findByDistrict(id);
	}
}
