import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AmenityCategory, CostCategory, RuleCategory } from '@prisma/client';
import { PaginatedResponseDto, PaginationQueryDto } from '../../common/dto';
import { AllEnumsResponseDto, SystemAmenityDto, SystemCostTypeDto, SystemRoomRuleDto } from './dto';
import { ReferenceService } from './reference.service';

@ApiTags('Reference Data')
@Controller('api/reference')
export class ReferenceController {
	constructor(private readonly referenceService: ReferenceService) {}

	// System Amenities Endpoints
	@Get('amenities')
	@ApiOperation({ summary: 'Get all system amenities with pagination' })
	@ApiResponse({
		status: 200,
		description: 'System amenities retrieved successfully',
		type: PaginatedResponseDto<SystemAmenityDto>,
	})
	async getSystemAmenities(
		@Query() query: PaginationQueryDto,
	): Promise<PaginatedResponseDto<SystemAmenityDto>> {
		return this.referenceService.getSystemAmenities(query);
	}

	@Get('amenities/all')
	@ApiOperation({ summary: 'Get all active system amenities without pagination' })
	@ApiResponse({
		status: 200,
		description: 'All system amenities retrieved successfully',
		type: [SystemAmenityDto],
	})
	async getAllSystemAmenities(): Promise<SystemAmenityDto[]> {
		return this.referenceService.getSystemAmenitiesByCategory();
	}

	@Get('amenities/category/:category')
	@ApiOperation({ summary: 'Get system amenities by category' })
	@ApiParam({
		name: 'category',
		description: 'Amenity category',
		enum: AmenityCategory,
	})
	@ApiResponse({
		status: 200,
		description: 'System amenities by category retrieved successfully',
		type: [SystemAmenityDto],
	})
	async getSystemAmenitiesByCategory(
		@Param('category') category: AmenityCategory,
	): Promise<SystemAmenityDto[]> {
		return this.referenceService.getSystemAmenitiesByCategory(category);
	}

	// System Cost Types Endpoints
	@Get('cost-types')
	@ApiOperation({ summary: 'Get all system cost types with pagination' })
	@ApiResponse({
		status: 200,
		description: 'System cost types retrieved successfully',
		type: PaginatedResponseDto<SystemCostTypeDto>,
	})
	async getSystemCostTypes(
		@Query() query: PaginationQueryDto,
	): Promise<PaginatedResponseDto<SystemCostTypeDto>> {
		return this.referenceService.getSystemCostTypes(query);
	}

	@Get('cost-types/all')
	@ApiOperation({ summary: 'Get all active system cost types without pagination' })
	@ApiResponse({
		status: 200,
		description: 'All system cost types retrieved successfully',
		type: [SystemCostTypeDto],
	})
	async getAllSystemCostTypes(): Promise<SystemCostTypeDto[]> {
		return this.referenceService.getSystemCostTypesByCategory();
	}

	@Get('cost-types/category/:category')
	@ApiOperation({ summary: 'Get system cost types by category' })
	@ApiParam({
		name: 'category',
		description: 'Cost category',
		enum: CostCategory,
	})
	@ApiResponse({
		status: 200,
		description: 'System cost types by category retrieved successfully',
		type: [SystemCostTypeDto],
	})
	async getSystemCostTypesByCategory(
		@Param('category') category: CostCategory,
	): Promise<SystemCostTypeDto[]> {
		return this.referenceService.getSystemCostTypesByCategory(category);
	}

	// Enums Endpoints
	@Get('enums')
	@ApiOperation({ summary: 'Get all system enums and their values' })
	@ApiResponse({
		status: 200,
		description: 'All system enums retrieved successfully',
		type: AllEnumsResponseDto,
	})
	getAllEnums(): AllEnumsResponseDto {
		return this.referenceService.getAllEnums();
	}

	// Utility endpoints for specific enum types
	@Get('enums/room-types')
	@ApiOperation({ summary: 'Get room type enum values' })
	@ApiResponse({
		status: 200,
		description: 'Room types retrieved successfully',
	})
	getRoomTypes() {
		return this.referenceService.getAllEnums().roomTypes;
	}

	@Get('enums/user-roles')
	@ApiOperation({ summary: 'Get user role enum values' })
	@ApiResponse({
		status: 200,
		description: 'User roles retrieved successfully',
	})
	getUserRoles() {
		return this.referenceService.getAllEnums().userRoles;
	}

	@Get('enums/booking-statuses')
	@ApiOperation({ summary: 'Get booking status enum values' })
	@ApiResponse({
		status: 200,
		description: 'Booking statuses retrieved successfully',
	})
	getBookingStatuses() {
		return this.referenceService.getAllEnums().bookingStatuses;
	}

	@Get('enums/payment-methods')
	@ApiOperation({ summary: 'Get payment method enum values' })
	@ApiResponse({
		status: 200,
		description: 'Payment methods retrieved successfully',
	})
	getPaymentMethods() {
		return this.referenceService.getAllEnums().paymentMethods;
	}

	@Get('enums/amenity-categories')
	@ApiOperation({ summary: 'Get amenity category enum values' })
	@ApiResponse({
		status: 200,
		description: 'Amenity categories retrieved successfully',
	})
	getAmenityCategories() {
		return this.referenceService.getAllEnums().amenityCategories;
	}

	@Get('enums/cost-categories')
	@ApiOperation({ summary: 'Get cost category enum values' })
	@ApiResponse({
		status: 200,
		description: 'Cost categories retrieved successfully',
	})
	getCostCategories() {
		return this.referenceService.getAllEnums().costCategories;
	}

	// System Room Rules Endpoints
	@Get('room-rules')
	@ApiOperation({ summary: 'Get all system room rules with pagination' })
	@ApiResponse({
		status: 200,
		description: 'System room rules retrieved successfully',
		type: PaginatedResponseDto<SystemRoomRuleDto>,
	})
	async getSystemRoomRules(
		@Query() query: PaginationQueryDto,
	): Promise<PaginatedResponseDto<SystemRoomRuleDto>> {
		return this.referenceService.getSystemRoomRules(query);
	}

	@Get('room-rules/all')
	@ApiOperation({ summary: 'Get all active system room rules without pagination' })
	@ApiResponse({
		status: 200,
		description: 'All system room rules retrieved successfully',
		type: [SystemRoomRuleDto],
	})
	async getAllSystemRoomRules(): Promise<SystemRoomRuleDto[]> {
		return this.referenceService.getSystemRoomRulesByCategory();
	}

	@Get('room-rules/category/:category')
	@ApiOperation({ summary: 'Get system room rules by category' })
	@ApiParam({
		name: 'category',
		description: 'Rule category',
		enum: RuleCategory,
	})
	@ApiResponse({
		status: 200,
		description: 'System room rules by category retrieved successfully',
		type: [SystemRoomRuleDto],
	})
	async getSystemRoomRulesByCategory(
		@Param('category') category: RuleCategory,
	): Promise<SystemRoomRuleDto[]> {
		return this.referenceService.getSystemRoomRulesByCategory(category);
	}

	@Get('enums/rule-categories')
	@ApiOperation({ summary: 'Get rule category enum values' })
	@ApiResponse({
		status: 200,
		description: 'Rule categories retrieved successfully',
	})
	getRuleCategories() {
		return this.referenceService.getAllEnums().ruleCategories;
	}
}
