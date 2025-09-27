import { Injectable } from '@nestjs/common';
import { AuthenticationData, SignatureMetadata } from '../types/contract-metadata.types';

/**
 * Contract Signing Service
 * Handles electronic signature process according to Vietnamese Law
 *
 * Implements:
 * - SMS OTP authentication
 * - Canvas signature capture
 * - Legal metadata generation
 * - Audit trail creation
 */
@Injectable()
export class ContractSigningService {
	/**
	 * Create signing session with SMS OTP
	 * Tạo session ký với xác thực SMS OTP
	 */
	async createSigningSession(
		contractId: string,
		userId: string,
		phoneNumber: string,
	): Promise<{
		sessionId: string;
		expiresAt: Date;
		maskedPhone: string;
	}> {
		// Generate OTP
		const otp = this.generateOTP();

		// Send SMS OTP
		await this.sendSMSOTP(phoneNumber, otp);

		// Create session
		const sessionId = this.generateSessionId();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

		// Store session (in real implementation, use Redis or database)
		await this.storeSigningSession({
			sessionId,
			contractId,
			userId,
			phoneNumber,
			otpHash: this.hashOTP(otp),
			expiresAt,
		});

		return {
			sessionId,
			expiresAt,
			maskedPhone: this.maskPhone(phoneNumber),
		};
	}

	/**
	 * Verify OTP and sign contract
	 * Xác thực OTP và ký hợp đồng
	 */
	async signContract(
		sessionId: string,
		otp: string,
		canvasData: string,
		userInfo: any,
		requestContext: any,
	): Promise<{
		signatureId: string;
		contractStatus: string;
	}> {
		// Verify session and OTP
		const session = await this.verifySigningSession(sessionId, otp);
		if (!session) {
			throw new Error('OTP không hợp lệ hoặc session đã hết hạn');
		}

		// Build signature metadata
		const signatureMetadata = await this.buildSignatureMetadata({
			signer: userInfo,
			authentication: { otp, phone: session.phoneNumber },
			context: requestContext,
			canvas: this.parseCanvasData(canvasData),
		});

		// Build authentication data
		const authenticationData = await this.buildAuthenticationData({
			sms: {
				provider: this.detectProvider(session.phoneNumber),
				phoneNumber: session.phoneNumber,
				maskedPhone: this.maskPhone(session.phoneNumber),
				otpLength: 6,
				otpExpiry: 300,
				sendStatus: 'success',
				sendTime: session.createdAt.toISOString(),
				verifyTime: new Date().toISOString(),
				attempts: session.attempts,
				maxAttempts: 5,
			},
			session: {
				id: sessionId,
				startTime: session.createdAt.toISOString(),
				endTime: new Date().toISOString(),
				duration: Math.floor((Date.now() - session.createdAt.getTime()) / 1000),
				activityLog: session.activityLog,
			},
			riskScore: {
				score: this.calculateRiskScore(requestContext),
				factors: this.identifyRiskFactors(requestContext),
				requiresAdditionalVerification: false,
			},
		});

		// Save signature
		const signatureId = await this.saveSignature({
			contractId: session.contractId,
			signerId: session.userId,
			signatureImage: canvasData,
			signatureHash: this.hashSignature(canvasData),
			signatureMetadata,
			authenticationData,
		});

		// Update contract status
		const contractStatus = await this.updateContractStatus(session.contractId);

		// Create audit log
		await this.createAuditLog({
			contractId: session.contractId,
			userId: session.userId,
			action: 'contract_signed',
			actionDetails: {
				signatureId,
				signatureMetadata,
				authenticationData,
			},
			ipAddress: requestContext.ip,
			userAgent: requestContext.userAgent,
			sessionId,
		});

		return {
			signatureId,
			contractStatus,
		};
	}

	/**
	 * Build signature metadata according to Vietnamese Law
	 */
	private async buildSignatureMetadata(params: {
		signer: any;
		authentication: { otp: string; phone: string };
		context: any;
		canvas: any;
	}): Promise<SignatureMetadata> {
		return {
			signer: {
				fullName: params.signer.fullName,
				idNumber: params.signer.idNumber,
				idIssuedDate: params.signer.idIssuedDate,
				idIssuedPlace: params.signer.idIssuedPlace,
				dateOfBirth: params.signer.dateOfBirth,
				permanentAddress: params.signer.permanentAddress,
				currentAddress: params.signer.currentAddress,
				phone: params.authentication.phone,
				email: params.signer.email,
			},
			authentication: {
				method: 'SMS_OTP',
				phone: params.authentication.phone,
				otpSentAt: new Date().toISOString(),
				otpVerifiedAt: new Date().toISOString(),
				otpAttempts: 1,
				verificationCode: params.authentication.otp,
			},
			signingContext: {
				timestamp: new Date().toISOString(),
				timezone: 'Asia/Ho_Chi_Minh',
				location: {
					address: params.context.location || 'Việt Nam',
					country: 'Việt Nam',
				},
				device: {
					type: this.detectDeviceType(params.context.userAgent),
					os: this.detectOS(params.context.userAgent),
					browser: this.detectBrowser(params.context.userAgent),
					screenResolution: params.context.screenResolution || '1920x1080',
					fingerprint: this.generateDeviceFingerprint(params.context),
				},
				network: {
					ip: params.context.ip,
					connectionType: params.context.connectionType || 'Wifi',
				},
			},
			canvas: {
				dimensions: {
					width: params.canvas.width || 400,
					height: params.canvas.height || 200,
				},
				strokeCount: params.canvas.strokeCount || 1,
				drawingTime: params.canvas.drawingTime || 1000,
			},
			integrity: {
				signatureHash: this.hashSignature(params.canvas.data),
				contractHash: await this.getContractHash(params.context.contractId),
			},
			evidence: {
				smsLogId: this.generateLogId(),
			},
		};
	}

	/**
	 * Build authentication data
	 */
	private async buildAuthenticationData(data: any): Promise<AuthenticationData> {
		return data;
	}

	/**
	 * Generate 6-digit OTP
	 */
	private generateOTP(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	/**
	 * Send SMS OTP (mock implementation)
	 */
	private async sendSMSOTP(phone: string, otp: string): Promise<void> {
		// In real implementation, integrate with SMS provider
		console.log(`Sending OTP ${otp} to ${phone}`);
	}

	/**
	 * Generate session ID
	 */
	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Hash OTP for storage
	 */
	private hashOTP(otp: string): string {
		// In real implementation, use proper hashing
		return Buffer.from(otp).toString('base64');
	}

	/**
	 * Hash signature data
	 */
	private hashSignature(data: string): string {
		// In real implementation, use SHA-256
		return Buffer.from(data).toString('base64');
	}

	/**
	 * Mask phone number
	 */
	private maskPhone(phone: string): string {
		return phone.replace(/(\d{3})\d{3}(\d{3})/, '$1***$2');
	}

	/**
	 * Detect mobile provider
	 */
	private detectProvider(phone: string): 'Viettel' | 'Vinaphone' | 'Mobifone' | 'VNPT' {
		if (phone.startsWith('096') || phone.startsWith('097') || phone.startsWith('098')) {
			return 'Viettel';
		}
		if (phone.startsWith('091') || phone.startsWith('094')) {
			return 'Vinaphone';
		}
		if (phone.startsWith('089') || phone.startsWith('090')) {
			return 'Mobifone';
		}
		return 'VNPT';
	}

	/**
	 * Detect device type from user agent
	 */
	private detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
		if (/Mobile|Android|iPhone/i.test(userAgent)) {
			return 'mobile';
		}
		if (/Tablet|iPad/i.test(userAgent)) {
			return 'tablet';
		}
		return 'desktop';
	}

	/**
	 * Detect OS from user agent
	 */
	private detectOS(userAgent: string): string {
		if (/Windows/i.test(userAgent)) return 'Windows';
		if (/Mac/i.test(userAgent)) return 'macOS';
		if (/Linux/i.test(userAgent)) return 'Linux';
		if (/Android/i.test(userAgent)) return 'Android';
		if (/iOS/i.test(userAgent)) return 'iOS';
		return 'Unknown';
	}

	/**
	 * Detect browser from user agent
	 */
	private detectBrowser(userAgent: string): string {
		if (/Chrome/i.test(userAgent)) return 'Chrome';
		if (/Firefox/i.test(userAgent)) return 'Firefox';
		if (/Safari/i.test(userAgent)) return 'Safari';
		if (/Edge/i.test(userAgent)) return 'Edge';
		return 'Unknown';
	}

	/**
	 * Generate device fingerprint
	 */
	private generateDeviceFingerprint(_context: any): string {
		// In real implementation, create unique device fingerprint
		return `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Parse canvas data
	 */
	private parseCanvasData(canvasData: string): any {
		// In real implementation, parse canvas signature data
		return {
			data: canvasData,
			width: 400,
			height: 200,
			strokeCount: 1,
			drawingTime: 1000,
		};
	}

	/**
	 * Calculate risk score
	 */
	private calculateRiskScore(_context: any): number {
		// In real implementation, calculate based on various factors
		return 25; // Low risk
	}

	/**
	 * Identify risk factors
	 */
	private identifyRiskFactors(context: any): string[] {
		const factors: string[] = [];

		// Check for new device
		if (context.isNewDevice) {
			factors.push('new_device');
		}

		// Check for different location
		if (context.isDifferentLocation) {
			factors.push('different_location');
		}

		return factors;
	}

	/**
	 * Get contract hash
	 */
	private async getContractHash(contractId: string): Promise<string> {
		// In real implementation, get hash of contract content
		return `contract_hash_${contractId}`;
	}

	/**
	 * Generate log ID
	 */
	private generateLogId(): string {
		return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// Mock implementations for database operations
	private async storeSigningSession(_data: any): Promise<void> {
		// In real implementation, store in Redis or database
	}

	private async verifySigningSession(_sessionId: string, _otp: string): Promise<any> {
		// In real implementation, verify from storage
		return {
			contractId: 'contract_123',
			userId: 'user_123',
			phoneNumber: '0909123456',
			createdAt: new Date(),
			attempts: 1,
			activityLog: [],
		};
	}

	private async saveSignature(_data: any): Promise<string> {
		// In real implementation, save to database
		return `signature_${Date.now()}`;
	}

	private async updateContractStatus(_contractId: string): Promise<string> {
		// In real implementation, update contract status
		return 'partially_signed';
	}

	private async createAuditLog(_data: any): Promise<void> {
		// In real implementation, create audit log
	}
}
