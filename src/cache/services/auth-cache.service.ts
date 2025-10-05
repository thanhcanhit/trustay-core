import { Injectable, Logger } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '../constants';
import { CacheService } from './cache.service';

export interface RefreshTokenData {
	tokenId: string;
	userId: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
}

export interface VerificationCodeData {
	code: string;
	attempts: number;
	createdAt: Date;
}

@Injectable()
export class AuthCacheService {
	private readonly logger = new Logger(AuthCacheService.name);

	constructor(private readonly cacheService: CacheService) {}

	// ==================== Refresh Tokens ====================

	/**
	 * Store refresh token in cache
	 */
	async setRefreshToken(data: RefreshTokenData): Promise<void> {
		const key = CACHE_KEYS.REFRESH_TOKEN(data.userId, data.tokenId);
		await this.cacheService.set(key, data, CACHE_TTL.REFRESH_TOKEN);
		this.logger.debug(`Refresh token cached for user ${data.userId}`);
	}

	/**
	 * Get refresh token from cache
	 */
	async getRefreshToken(userId: string, tokenId: string): Promise<RefreshTokenData | null> {
		const key = CACHE_KEYS.REFRESH_TOKEN(userId, tokenId);
		const data = await this.cacheService.get<RefreshTokenData>(key);

		if (data) {
			this.logger.debug(`Refresh token found in cache for user ${userId}`);
		} else {
			this.logger.debug(`Refresh token not found in cache for user ${userId}`);
		}

		return data || null;
	}

	/**
	 * Delete refresh token from cache
	 */
	async deleteRefreshToken(userId: string, tokenId: string): Promise<void> {
		const key = CACHE_KEYS.REFRESH_TOKEN(userId, tokenId);
		await this.cacheService.del(key);
		this.logger.debug(`Refresh token deleted for user ${userId}`);
	}

	/**
	 * Delete all refresh tokens for a user
	 */
	async deleteAllUserRefreshTokens(userId: string): Promise<void> {
		const pattern = `auth:refresh:${userId}:*`;
		await this.cacheService.delPattern(pattern);
		this.logger.debug(`All refresh tokens deleted for user ${userId}`);
	}

	// ==================== JWT Blacklist ====================

	/**
	 * Blacklist a JWT token (for logout/revoke)
	 */
	async blacklistToken(jti: string, expiresIn: number): Promise<void> {
		const key = CACHE_KEYS.JWT_BLACKLIST(jti);
		await this.cacheService.set(key, { blacklistedAt: new Date() }, expiresIn);
		this.logger.debug(`JWT token blacklisted: ${jti}`);
	}

	/**
	 * Check if JWT token is blacklisted
	 */
	async isTokenBlacklisted(jti: string): Promise<boolean> {
		const key = CACHE_KEYS.JWT_BLACKLIST(jti);
		const blacklisted = await this.cacheService.get(key);

		if (blacklisted) {
			this.logger.debug(`JWT token ${jti} is blacklisted`);
			return true;
		}

		return false;
	}

	// ==================== Verification Codes (OTP) ====================

	/**
	 * Store verification code (OTP)
	 */
	async setVerificationCode(type: string, target: string, code: string): Promise<void> {
		const key = CACHE_KEYS.VERIFICATION_CODE(type, target);
		const data: VerificationCodeData = {
			code,
			attempts: 0,
			createdAt: new Date(),
		};

		await this.cacheService.set(key, data, CACHE_TTL.VERIFICATION_CODE);
		this.logger.debug(`Verification code cached: ${type} for ${target}`);
	}

	/**
	 * Get verification code and increment attempts
	 */
	async getVerificationCode(type: string, target: string): Promise<VerificationCodeData | null> {
		const key = CACHE_KEYS.VERIFICATION_CODE(type, target);
		const data = await this.cacheService.get<VerificationCodeData>(key);

		if (data) {
			// Increment attempts
			data.attempts += 1;
			await this.cacheService.set(key, data, CACHE_TTL.VERIFICATION_CODE);
			this.logger.debug(`Verification attempt ${data.attempts} for ${type}:${target}`);
		}

		return data || null;
	}

	/**
	 * Verify code and delete if correct
	 */
	async verifyCode(
		type: string,
		target: string,
		inputCode: string,
		maxAttempts = 5,
	): Promise<{ valid: boolean; attemptsRemaining: number }> {
		const data = await this.getVerificationCode(type, target);

		if (!data) {
			return { valid: false, attemptsRemaining: 0 };
		}

		if (data.attempts > maxAttempts) {
			await this.deleteVerificationCode(type, target);
			this.logger.warn(`Max verification attempts exceeded for ${type}:${target}`);
			return { valid: false, attemptsRemaining: 0 };
		}

		if (data.code === inputCode) {
			await this.deleteVerificationCode(type, target);
			this.logger.debug(`Verification successful for ${type}:${target}`);
			return { valid: true, attemptsRemaining: maxAttempts - data.attempts };
		}

		this.logger.debug(`Verification failed for ${type}:${target}`);
		return { valid: false, attemptsRemaining: maxAttempts - data.attempts };
	}

	/**
	 * Delete verification code
	 */
	async deleteVerificationCode(type: string, target: string): Promise<void> {
		const key = CACHE_KEYS.VERIFICATION_CODE(type, target);
		await this.cacheService.del(key);
		this.logger.debug(`Verification code deleted: ${type} for ${target}`);
	}
}
