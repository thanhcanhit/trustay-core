import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Put,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ConfirmChangeEmailDto } from './dto/confirm-change-email.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { RequestChangeEmailDto } from './dto/request-change-email.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('public/:id')
	@ApiOperation({ summary: 'Get public user information' })
	@ApiParam({ name: 'id', description: 'User ID' })
	@ApiResponse({
		status: 200,
		description: 'User information retrieved successfully',
		type: PublicUserResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async getPublicUser(@Param('id') userId: string, @CurrentUser() user?: any) {
		const isAuthenticated = Boolean(user);
		const currentUserId = user?.id;
		return this.usersService.getPublicUser(userId, isAuthenticated, currentUserId);
	}

	@Get('profile')
	@Auth()
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
	@Auth()
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
	@Auth()
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
	@Auth()
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
	@Auth()
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
	@Auth()
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
	@Auth()
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
	@Auth()
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

	@Put('avatar')
	@Auth()
	@UseInterceptors(FileInterceptor('file'))
	@ApiOperation({ summary: 'Upload/update user avatar' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
					description: 'Avatar image file',
				},
			},
			required: ['file'],
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Avatar uploaded/updated successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid file or user not found',
	})
	async updateAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
		return this.usersService.updateAvatar(user.id, file);
	}

	@Post('request-change-email')
	@Auth()
	@ApiOperation({ summary: 'Request email change - Step 1: Send OTP to new email' })
	@ApiResponse({
		status: 200,
		description: 'Verification code sent to new email address',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Verification code sent to new email address' },
				newEmail: { type: 'string', example: 'newemail@example.com' },
				expiresInMinutes: { type: 'number', example: 10 },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid password or new email same as current',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Email is already in use',
	})
	async requestChangeEmail(
		@CurrentUser() user: any,
		@Body() requestChangeEmailDto: RequestChangeEmailDto,
	) {
		return this.usersService.requestChangeEmail(user.id, requestChangeEmailDto);
	}

	@Post('confirm-change-email')
	@Auth()
	@ApiOperation({ summary: 'Confirm email change - Step 2: Verify OTP and update email' })
	@ApiResponse({
		status: 200,
		description: 'Email changed successfully',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Email changed successfully' },
				user: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						email: { type: 'string' },
						firstName: { type: 'string' },
						lastName: { type: 'string' },
						isVerifiedEmail: { type: 'boolean' },
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid or expired verification code',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Email is already in use',
	})
	async confirmChangeEmail(
		@CurrentUser() user: any,
		@Body() confirmChangeEmailDto: ConfirmChangeEmailDto,
	) {
		return this.usersService.confirmChangeEmail(user.id, confirmChangeEmailDto);
	}
}
