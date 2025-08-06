import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendVerificationDto } from './dto/send-verification.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { VerificationService } from './services/verification.service';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
	constructor(private readonly verificationService: VerificationService) {}

	@Post('send')
	@ApiOperation({
		summary: 'Send verification code',
		description: 'Send a verification code to email or phone number before registration.',
	})
	@ApiResponse({
		status: 200,
		description: 'Verification code sent successfully or SMS disabled notification',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'Verification code sent to email successfully',
					description: 'Success message or SMS disabled notification',
				},
				verificationId: { type: 'string', example: 'clx123456789' },
				expiresInMinutes: { type: 'number', example: 5 },
				remainingAttempts: { type: 'number', example: 5 },
				smsDisabled: {
					type: 'boolean',
					example: true,
					description: 'Present and true when SMS verification is attempted but disabled',
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input or email/phone already registered',
	})
	@ApiResponse({
		status: 429,
		description: 'Rate limit exceeded - too many requests',
	})
	async sendVerificationCode(@Body() sendVerificationDto: SendVerificationDto) {
		return this.verificationService.sendVerificationCode(
			sendVerificationDto.type,
			sendVerificationDto.email,
			sendVerificationDto.phone,
		);
	}

	@Post('verify')
	@ApiOperation({
		summary: 'Verify code and get verification token',
		description: 'Verify the received code and get a verification token for registration.',
	})
	@ApiResponse({
		status: 200,
		description: 'Code verified successfully',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string', example: 'Email verified successfully' },
				canProceedToRegister: { type: 'boolean', example: true },
				verificationToken: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					description:
						'Short-lived token (10 minutes) to be used in registration X-Verification-Token header',
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid code, expired code, or maximum attempts exceeded',
	})
	async verifyCode(@Body() verifyCodeDto: VerifyCodeDto) {
		return this.verificationService.verifyCode(
			verifyCodeDto.type,
			verifyCodeDto.email,
			verifyCodeDto.phone,
			verifyCodeDto.code,
		);
	}
}
