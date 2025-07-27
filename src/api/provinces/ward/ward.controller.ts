import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
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
	})
	@ApiResponse({
		status: 200,
		description: 'List of wards for the specified district',
	})
	findByDistrict(@Query('district_id', ParseIntPipe) districtId: number) {
		return this.wardService.findByDistrict(districtId);
	}
}
