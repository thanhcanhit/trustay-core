import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
	private readonly saltRounds = 12; // Tăng từ 10 lên 12 để bảo mật cao hơn

	async hashPassword(plainPassword: string): Promise<string> {
		try {
			// Validate input
			if (!plainPassword || plainPassword.length < 6) {
				throw new Error('Password must be at least 6 characters long');
			}

			// Generate salt và hash password
			const salt = await bcrypt.genSalt(this.saltRounds);
			const hashedPassword = await bcrypt.hash(plainPassword, salt);

			return hashedPassword;
		} catch (error) {
			throw new Error(`Failed to hash password: ${error.message}`);
		}
	}

	async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
		try {
			// Validate inputs
			if (!plainPassword || !hashedPassword) {
				return false;
			}

			// So sánh password với hash
			const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
			return isMatch;
		} catch (error) {
			// Log error nhưng không expose chi tiết
			console.error('Password comparison failed:', error.message);
			return false;
		}
	}

	/**
	 * Kiểm tra độ mạnh của password
	 */
	validatePasswordStrength(password: string): {
		isValid: boolean;
		errors: string[];
		score: number; // 0-100
	} {
		const errors: string[] = [];
		let score = 0;

		// Validate length and add score
		score += this.validateLength(password, errors);

		// Validate character types
		score += this.validateCharacterTypes(password, errors);

		// Check for common patterns
		score += this.validateCommonPatterns(password, errors);

		// Ensure score is within bounds
		score = Math.max(0, Math.min(100, score));

		return {
			isValid: errors.length === 0 && score >= 60,
			errors,
			score,
		};
	}

	private validateLength(password: string, errors: string[]): number {
		if (password.length < 6) {
			errors.push('Mật khẩu phải có ít nhất 6 ký tự');
			return 0;
		}
		if (password.length >= 12) {
			return 35; // 20 for basic + 15 bonus
		}
		if (password.length >= 8) {
			return 20;
		}
		return 10;
	}

	private validateCharacterTypes(password: string, errors: string[]): number {
		let score = 0;

		// Contains lowercase
		if (/[a-z]/.test(password)) {
			score += 15;
		} else {
			errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái thường');
		}

		// Contains uppercase
		if (/[A-Z]/.test(password)) {
			score += 15;
		} else {
			errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái hoa');
		}

		// Contains numbers
		if (/\d/.test(password)) {
			score += 15;
		} else {
			errors.push('Mật khẩu phải chứa ít nhất 1 số');
		}

		// Contains special characters
		if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
			score += 20;
		} else {
			errors.push('Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)');
		}

		return score;
	}

	private validateCommonPatterns(password: string, errors: string[]): number {
		const commonPatterns = [/123456/, /password/i, /qwerty/i, /admin/i, /letmein/i];

		for (const pattern of commonPatterns) {
			if (pattern.test(password)) {
				errors.push('Mật khẩu không được chứa chuỗi phổ biến');
				return -20;
			}
		}
		return 0;
	}

	/**
	 * Generate a secure random password
	 */
	generateSecurePassword(length: number = 12): string {
		const lowercase = 'abcdefghijklmnopqrstuvwxyz';
		const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const numbers = '0123456789';
		const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

		const allChars = lowercase + uppercase + numbers + special;

		let password = '';

		// Ensure at least one character from each category
		password += lowercase[Math.floor(Math.random() * lowercase.length)];
		password += uppercase[Math.floor(Math.random() * uppercase.length)];
		password += numbers[Math.floor(Math.random() * numbers.length)];
		password += special[Math.floor(Math.random() * special.length)];

		// Fill the rest randomly
		for (let i = 4; i < length; i++) {
			password += allChars[Math.floor(Math.random() * allChars.length)];
		}

		// Shuffle the password
		return password
			.split('')
			.sort(() => Math.random() - 0.5)
			.join('');
	}

	/**
	 * Check if password needs rehashing (for security upgrades)
	 */
	async needsRehash(hashedPassword: string): Promise<boolean> {
		try {
			// Check if current hash uses our current salt rounds
			// bcrypt hashes contain the salt rounds in the hash itself
			const currentRounds = parseInt(hashedPassword.split('$')[2]);
			return currentRounds < this.saltRounds;
		} catch {
			// If we can't parse the hash, assume it needs rehashing
			return true;
		}
	}

	/**
	 * Rehash password with current settings
	 */
	async rehashPassword(plainPassword: string, oldHash: string): Promise<string> {
		// First verify the old password is correct
		const isValid = await this.comparePassword(plainPassword, oldHash);
		if (!isValid) {
			throw new Error('Invalid password for rehashing');
		}

		// Hash with current settings
		return this.hashPassword(plainPassword);
	}
}
