import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EnumValuesDto, SimpleAmenityDto, SimpleCostTypeDto, SimpleRuleDto } from './dto';
import { ReferenceService } from './reference.service';

@ApiTags('Reference Data')
@Controller('api/reference')
export class ReferenceController {
	constructor(private readonly referenceService: ReferenceService) {}

	@Get('enums')
	@ApiOperation({ summary: 'Get all enum values for dropdowns and validation' })
	@ApiResponse({
		status: 200,
		description: 'All enum values retrieved successfully',
		type: EnumValuesDto,
	})
	getEnums(): EnumValuesDto {
		return this.referenceService.getEnums();
	}

	@Get('amenities')
	@ApiOperation({ summary: 'Get all amenities with optional category filter' })
	@ApiQuery({
		name: 'category',
		required: false,
		description:
			'Filter by category (basic, kitchen, bathroom, entertainment, safety, connectivity, building)',
	})
	@ApiResponse({
		status: 200,
		description: 'Amenities retrieved successfully',
		type: [SimpleAmenityDto],
	})
	async getAmenities(@Query('category') category?: string): Promise<SimpleAmenityDto[]> {
		return this.referenceService.getAmenities(category);
	}

	@Get('cost-types')
	@ApiOperation({ summary: 'Get all cost types with optional category filter' })
	@ApiQuery({
		name: 'category',
		required: false,
		description: 'Filter by category (utility, service, parking, maintenance)',
	})
	@ApiResponse({
		status: 200,
		description: 'Cost types retrieved successfully',
		type: [SimpleCostTypeDto],
	})
	async getCostTypes(@Query('category') category?: string): Promise<SimpleCostTypeDto[]> {
		return this.referenceService.getCostTypes(category);
	}

	@Get('rules')
	@ApiOperation({ summary: 'Get all room rules with optional category filter' })
	@ApiQuery({
		name: 'category',
		required: false,
		description:
			'Filter by category (smoking, pets, visitors, noise, cleanliness, security, usage, other)',
	})
	@ApiResponse({
		status: 200,
		description: 'Room rules retrieved successfully',
		type: [SimpleRuleDto],
	})
	async getRules(@Query('category') category?: string): Promise<SimpleRuleDto[]> {
		return this.referenceService.getRules(category);
	}
}
