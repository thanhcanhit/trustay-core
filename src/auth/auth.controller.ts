import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserResponseDto } from '../api/users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordStrengthResponseDto } from './dto/password-strength-response.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	@ApiOperation({ summary: 'Register a new user' })
	@ApiResponse({
		status: 201,
		description: 'User registered successfully',
		type: AuthResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 409,
		description: 'Email or phone already in use',
	})
	async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
		return this.authService.register(registerDto);
	}

	@Post('login')
	@ApiOperation({ summary: 'Login user' })
	@ApiResponse({
		status: 200,
		description: 'User logged in successfully',
		type: AuthResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Invalid credentials',
	})
	async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
		return this.authService.login(loginDto);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get current user profile' })
	@ApiResponse({
		status: 200,
		description: 'Current user profile retrieved successfully',
		type: UserResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized',
	})
	async getCurrentUser(@CurrentUser() user: any) {
		return user;
	}

	@Put('change-password')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Change user password' })
	@ApiResponse({
		status: 200,
		description: 'Password changed successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'New password does not meet requirements',
	})
	@ApiResponse({
		status: 401,
		description: 'Current password is incorrect',
	})
	async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
		return this.authService.changePassword(
			user.id,
			changePasswordDto.currentPassword,
			changePasswordDto.newPassword,
		);
	}

	@Post('check-password-strength')
	@ApiOperation({ summary: 'Check password strength' })
	@ApiResponse({
		status: 200,
		description: 'Password strength checked',
		type: PasswordStrengthResponseDto,
	})
	async checkPasswordStrength(@Body('password') password: string) {
		return this.authService.checkPasswordStrength(password);
	}

	@Get('generate-password')
	@ApiOperation({ summary: 'Generate a secure password' })
	@ApiQuery({
		name: 'length',
		required: false,
		description: 'Password length (default: 12)',
		example: 12,
	})
	@ApiResponse({
		status: 200,
		description: 'Secure password generated',
	})
	async generateSecurePassword(@Query('length') length?: string) {
		const passwordLength = length ? parseInt(length, 10) : 12;
		return this.authService.generateSecurePassword(passwordLength);
	}
}
