import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Headers,
	Post,
	Put,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { UserResponseDto } from '../api/users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordStrengthResponseDto } from './dto/password-strength-response.dto';
import { PreRegisterDto } from './dto/pre-register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	@ApiOperation({
		summary: 'Complete user registration with verified email/phone',
		description:
			'Register a new user account. Requires a valid verification token obtained from email/phone verification.',
	})
	@ApiHeader({
		name: 'X-Verification-Token',
		description: 'Verification token obtained from email/phone verification',
		required: true,
	})
	@ApiResponse({
		status: 201,
		description: 'User registered successfully',
		type: AuthResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data or password requirements not met',
	})
	@ApiResponse({
		status: 401,
		description: 'Invalid or expired verification token',
	})
	@ApiResponse({
		status: 409,
		description: 'Email or phone already in use',
	})
	async register(
		@Body() preRegisterDto: PreRegisterDto,
		@Headers('x-verification-token') verificationToken?: string,
	): Promise<AuthResponseDto> {
		if (!verificationToken) {
			throw new BadRequestException({
				message: 'Verification token is required',
				error: 'VERIFICATION_TOKEN_MISSING',
				details: {
					step: 'verification_required',
					instructions: [
						'1. Call POST /api/verification/send to send verification code',
						'2. Call POST /api/verification/verify to verify code and get token',
						'3. Include token in X-Verification-Token header for registration',
					],
					alternativeEndpoint: {
						development: 'POST /api/auth/register-direct (development only)',
						description: 'Use register-direct for development without verification',
					},
				},
			});
		}
		return this.authService.preRegister(preRegisterDto, verificationToken);
	}

	@Post('register-direct')
	@ApiOperation({
		summary: '[DEV ONLY] Direct registration without verification',
		description:
			'Register without email/phone verification. Only available in development environment or when ALLOW_DIRECT_REGISTRATION=true.',
	})
	@ApiResponse({
		status: 201,
		description: 'User registered successfully',
		type: AuthResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data or not allowed in production',
	})
	@ApiResponse({
		status: 409,
		description: 'Email or phone already in use',
	})
	async registerDirect(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
		return this.authService.registerDirectly(registerDto);
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
	@Auth()
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
	@Auth()
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

	@Post('refresh')
	@ApiOperation({ summary: 'Refresh access token using refresh token' })
	@ApiResponse({
		status: 200,
		description: 'Access token refreshed successfully',
		type: AuthResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Invalid or expired refresh token',
	})
	async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
		return this.authService.refreshToken(refreshTokenDto);
	}

	@Post('revoke')
	@ApiOperation({ summary: 'Revoke a specific refresh token' })
	@ApiResponse({
		status: 200,
		description: 'Refresh token revoked successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Refresh token not found',
	})
	async revokeRefreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
		return this.authService.revokeRefreshToken(refreshTokenDto.refreshToken);
	}

	@Post('revoke-all')
	@Auth()
	@ApiOperation({ summary: 'Revoke all refresh tokens for current user' })
	@ApiResponse({
		status: 200,
		description: 'All refresh tokens revoked successfully',
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized',
	})
	async revokeAllRefreshTokens(@CurrentUser() user: any) {
		return this.authService.revokeAllRefreshTokens(user.id);
	}
}
