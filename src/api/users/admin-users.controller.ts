import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersService } from './users.service';

@ApiTags('Admin - Users')
@Controller('api/admin/users')
export class AdminUsersController {
	constructor(private readonly usersService: UsersService) {}

	@Post()
	@ApiOperation({ summary: '[Admin] Create a new user' })
	@ApiResponse({
		status: 201,
		description: 'User created successfully',
		type: UserResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 409,
		description: 'Email or phone already in use',
	})
	async createUser(@Body() createUserDto: CreateUserDto) {
		return this.usersService.createUser(createUserDto);
	}

	@Get()
	@ApiOperation({ summary: '[Admin] Get all users with pagination and filtering' })
	@ApiResponse({
		status: 200,
		description: 'Users retrieved successfully',
		type: PaginatedUsersResponseDto,
	})
	async findAllUsers(@Query() query: UsersQueryDto) {
		return this.usersService.findAllUsers(query);
	}

	@Get(':id')
	@ApiOperation({ summary: '[Admin] Get user by ID' })
	@ApiParam({ name: 'id', description: 'User ID' })
	@ApiResponse({
		status: 200,
		description: 'User retrieved successfully',
		type: UserResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async findUserById(@Param('id') id: string) {
		return this.usersService.findUserById(id);
	}

	@Delete(':id')
	@ApiOperation({ summary: '[Admin] Delete user by ID' })
	@ApiParam({ name: 'id', description: 'User ID' })
	@ApiResponse({
		status: 200,
		description: 'User deleted successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async deleteUser(@Param('id') id: string) {
		return this.usersService.deleteUser(id);
	}
}
