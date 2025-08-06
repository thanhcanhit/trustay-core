import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@Auth()
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('profile')
	@ApiOperation({ summary: 'Get user profile' })
	@ApiResponse({
		status: 200,
		description: 'User profile retrieved successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async getProfile(@CurrentUser() user: any) {
		return this.usersService.getProfile(user.id);
	}

	@Put('profile')
	@ApiOperation({ summary: 'Update user profile' })
	@ApiResponse({
		status: 200,
		description: 'Profile updated successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async updateProfile(@CurrentUser() user: any, @Body() updateProfileDto: UpdateProfileDto) {
		return this.usersService.updateProfile(user.id, updateProfileDto);
	}

	@Post('addresses')
	@ApiOperation({ summary: 'Create a new address for user' })
	@ApiResponse({
		status: 201,
		description: 'Address created successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async createAddress(@CurrentUser() user: any, @Body() createAddressDto: CreateAddressDto) {
		return this.usersService.createAddress(user.id, createAddressDto);
	}

	@Put('addresses/:id')
	@ApiOperation({ summary: 'Update user address' })
	@ApiParam({ name: 'id', description: 'Address ID' })
	@ApiResponse({
		status: 200,
		description: 'Address updated successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 404,
		description: 'Address not found',
	})
	async updateAddress(
		@CurrentUser() user: any,
		@Param('id') addressId: string,
		@Body() updateAddressDto: UpdateAddressDto,
	) {
		return this.usersService.updateAddress(user.id, addressId, updateAddressDto);
	}

	@Delete('addresses/:id')
	@ApiOperation({ summary: 'Delete user address' })
	@ApiParam({ name: 'id', description: 'Address ID' })
	@ApiResponse({
		status: 200,
		description: 'Address deleted successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Address not found',
	})
	async deleteAddress(@CurrentUser() user: any, @Param('id') addressId: string) {
		return this.usersService.deleteAddress(user.id, addressId);
	}

	@Post('verify-phone')
	@ApiOperation({ summary: 'Verify user phone number' })
	@ApiResponse({
		status: 200,
		description: 'Phone number verified successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid verification code or phone number',
	})
	@ApiResponse({
		status: 409,
		description: 'Phone number already in use',
	})
	async verifyPhone(@CurrentUser() user: any, @Body() verifyPhoneDto: VerifyPhoneDto) {
		return this.usersService.verifyPhone(user.id, verifyPhoneDto);
	}

	@Post('verify-email')
	@ApiOperation({ summary: 'Verify user email address' })
	@ApiResponse({
		status: 200,
		description: 'Email verified successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid verification code or email',
	})
	@ApiResponse({
		status: 409,
		description: 'Email already in use',
	})
	async verifyEmail(@CurrentUser() user: any, @Body() verifyEmailDto: VerifyEmailDto) {
		return this.usersService.verifyEmail(user.id, verifyEmailDto);
	}

	@Post('verify-identity')
	@ApiOperation({ summary: 'Verify user identity with ID card' })
	@ApiResponse({
		status: 200,
		description: 'Identity verified successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid ID card data',
	})
	@ApiResponse({
		status: 409,
		description: 'ID card number already in use',
	})
	async verifyIdentity(@CurrentUser() user: any, @Body() verifyIdentityDto: VerifyIdentityDto) {
		return this.usersService.verifyIdentity(user.id, verifyIdentityDto);
	}
}
