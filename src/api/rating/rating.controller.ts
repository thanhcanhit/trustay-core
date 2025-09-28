import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { RatingTargetType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
	CreateRatingDto,
	RatingQueryDto,
	RatingResponseDto,
	RatingStatsDto,
	UpdateRatingDto,
} from './dto';
import { RatingService } from './rating.service';

@ApiTags('Ratings')
@Controller('ratings')
export class RatingController {
	constructor(private readonly ratingService: RatingService) {}

	@Post()
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Create a new rating',
		description: 'Create a rating for tenant, landlord, or room',
	})
	@ApiResponse({
		status: 201,
		description: 'Rating created successfully',
		type: RatingResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Bad request - validation errors or business rule violations',
	})
	@ApiResponse({
		status: 403,
		description: 'Forbidden - user not authorized to rate this target',
	})
	async create(
		@Body() createRatingDto: CreateRatingDto,
		@Req() req: any,
	): Promise<RatingResponseDto> {
		return this.ratingService.create(createRatingDto, req.user.id);
	}

	@Get()
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get ratings with filters',
		description: 'Get all ratings with optional filters and pagination',
	})
	@ApiQuery({
		name: 'targetType',
		required: false,
		enum: RatingTargetType,
		description: 'Filter by target type',
	})
	@ApiQuery({
		name: 'targetId',
		required: false,
		type: String,
		description: 'Filter by target ID',
	})
	@ApiQuery({
		name: 'reviewerId',
		required: false,
		type: String,
		description: 'Filter by reviewer ID',
	})
	@ApiQuery({
		name: 'rentalId',
		required: false,
		type: String,
		description: 'Filter by rental ID',
	})
	@ApiQuery({
		name: 'minRating',
		required: false,
		type: Number,
		description: 'Minimum rating filter',
	})
	@ApiQuery({
		name: 'maxRating',
		required: false,
		type: Number,
		description: 'Maximum rating filter',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		type: Number,
		description: 'Page number',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Items per page',
	})
	@ApiQuery({
		name: 'sortBy',
		required: false,
		type: String,
		description: 'Sort field',
	})
	@ApiQuery({
		name: 'sortOrder',
		required: false,
		enum: ['asc', 'desc'],
		description: 'Sort order',
	})
	@ApiResponse({
		status: 200,
		description: 'Ratings retrieved successfully',
		type: PaginatedResponseDto<RatingResponseDto>,
	})
	async findAll(
		@Query() query: RatingQueryDto,
		@Req() req: any,
	): Promise<PaginatedResponseDto<RatingResponseDto> & { stats: RatingStatsDto }> {
		const isAuthenticated = Boolean(req.user);
		const currentUserId = req.user?.id;
		return this.ratingService.findAll(query, { isAuthenticated, currentUserId });
	}

	@Get(':id')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get a rating by ID',
		description: 'Retrieve a specific rating by its ID',
	})
	@ApiParam({
		name: 'id',
		description: 'Rating ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Rating retrieved successfully',
		type: RatingResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Rating not found',
	})
	async findOne(@Param('id') id: string, @Req() req: any): Promise<RatingResponseDto> {
		const isAuthenticated = Boolean(req.user);
		return this.ratingService.findOne(id, { isAuthenticated });
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Update a rating',
		description: 'Update an existing rating (only by the original reviewer)',
	})
	@ApiParam({
		name: 'id',
		description: 'Rating ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Rating updated successfully',
		type: RatingResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Rating not found',
	})
	@ApiResponse({
		status: 403,
		description: 'Forbidden - can only update own ratings',
	})
	async update(
		@Param('id') id: string,
		@Body() updateRatingDto: UpdateRatingDto,
		@Req() req: any,
	): Promise<RatingResponseDto> {
		return this.ratingService.update(id, updateRatingDto, req.user.id);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Delete a rating',
		description: 'Delete an existing rating (only by the original reviewer)',
	})
	@ApiParam({
		name: 'id',
		description: 'Rating ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Rating deleted successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Rating not found',
	})
	@ApiResponse({
		status: 403,
		description: 'Forbidden - can only delete own ratings',
	})
	async remove(@Param('id') id: string, @Req() req: any): Promise<{ message: string }> {
		await this.ratingService.remove(id, req.user.id);
		return { message: 'Rating deleted successfully' };
	}

	// Removed response and helpful functionality for simplified version

	@Get('user/:userId')
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: 'Get reviews created by a user',
		description:
			'Get all reviews/ratings that were created by a specific user (reviews they wrote)',
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID of the reviewer',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		type: Number,
		description: 'Page number',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Items per page',
	})
	@ApiQuery({
		name: 'targetType',
		required: false,
		enum: RatingTargetType,
		description: 'Filter by target type (tenant, landlord, room)',
	})
	@ApiQuery({
		name: 'minRating',
		required: false,
		type: Number,
		description: 'Minimum rating filter',
	})
	@ApiQuery({
		name: 'maxRating',
		required: false,
		type: Number,
		description: 'Maximum rating filter',
	})
	@ApiQuery({
		name: 'sortBy',
		required: false,
		type: String,
		description: 'Sort field',
	})
	@ApiQuery({
		name: 'sortOrder',
		required: false,
		enum: ['asc', 'desc'],
		description: 'Sort order',
	})
	@ApiResponse({
		status: 200,
		description: 'User created reviews retrieved successfully',
		type: PaginatedResponseDto<RatingResponseDto>,
	})
	async getUserCreatedReviews(
		@Param('userId') userId: string,
		@Query() query: {
			page?: number;
			limit?: number;
			targetType?: RatingTargetType;
			minRating?: number;
			maxRating?: number;
			sortBy?: string;
			sortOrder?: 'asc' | 'desc';
		},
		@Req() req: any,
	): Promise<PaginatedResponseDto<RatingResponseDto> & { stats: RatingStatsDto }> {
		const isAuthenticated = Boolean(req.user);
		const currentUserId = req.user?.id;
		const ratingQuery: RatingQueryDto = {
			...query,
			reviewerId: userId,
		};
		return this.ratingService.findAll(ratingQuery, { isAuthenticated, currentUserId });
	}
}
