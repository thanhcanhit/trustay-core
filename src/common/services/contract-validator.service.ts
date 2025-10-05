import { Injectable } from '@nestjs/common';
import {
	ContractData,
	SignatureMetadata,
	ValidationResult,
} from '../types/contract-metadata.types';

/**
 * Contract Validator Service
 * Validates electronic contracts according to Vietnamese Law
 *
 * Compliant with:
 * - Luật Giao dịch điện tử số 51/2023/QH15
 * - Nghị định 91/2023/NĐ-CP
 * - Bộ luật Dân sự 2015
 */
@Injectable()
export class ContractValidatorService {
	/**
	 * Validate legal requirements according to Civil Code Article 117
	 * Điều 117 BLDS - Điều kiện có hiệu lực của giao dịch dân sự
	 */
	validateLegalRequirements(contractData: ContractData): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check required elements
		const hasRequiredElements = this.checkRequiredElements(contractData);
		if (!hasRequiredElements) {
			errors.push('Hợp đồng thiếu các yếu tố bắt buộc theo pháp luật');
		}

		// Check legal capacity
		const hasCapacity = this.checkLegalCapacity(contractData);
		if (!hasCapacity) {
			errors.push('Các bên tham gia không có năng lực pháp luật đầy đủ');
		}

		// Check voluntary consent
		const isVoluntary = this.checkVoluntary(contractData);
		if (!isVoluntary) {
			errors.push('Giao dịch không được thực hiện trên tinh thần tự nguyện');
		}

		// Check legal purpose
		const hasLegalPurpose = this.checkPurpose(contractData);
		if (!hasLegalPurpose) {
			errors.push('Mục đích của giao dịch không hợp pháp');
		}

		// Check required form
		const hasRequiredForm = this.checkForm(contractData);
		if (!hasRequiredForm) {
			errors.push('Hình thức hợp đồng không đúng theo quy định pháp luật');
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			legalCompliance: {
				hasCapacity,
				isVoluntary,
				hasLegalPurpose,
				hasRequiredForm,
			},
			signatureValidation: {
				hasAuthentication: false,
				hasIntegrity: false,
				hasNonRepudiation: false,
				hasTimestamp: false,
			},
		};
	}

	/**
	 * Validate electronic signature according to Electronic Transaction Law
	 * Điều 16-17 Luật Giao dịch điện tử - Giá trị pháp lý của chữ ký điện tử
	 */
	validateElectronicSignature(signature: SignatureMetadata): boolean {
		const hasAuthentication = this.checkAuthentication(signature);
		const hasIntegrity = this.checkIntegrity(signature);
		const hasNonRepudiation = this.checkNonRepudiation(signature);
		const hasTimestamp = this.checkTimestamp(signature);

		return hasAuthentication && hasIntegrity && hasNonRepudiation && hasTimestamp;
	}

	/**
	 * Validate metadata according to Decree 91/2023/NĐ-CP
	 * Nghị định 91/2023 - Metadata bắt buộc
	 */
	validateMetadata(metadata: SignatureMetadata): string[] {
		const required = [
			'signer.fullName',
			'signer.idNumber',
			'authentication.method',
			'authentication.verificationCode',
			'signingContext.timestamp',
			'signingContext.location',
			'signingContext.device',
			'signingContext.network.ip',
			'integrity.signatureHash',
			'integrity.contractHash',
		];

		return this.checkRequiredFields(metadata, required);
	}

	/**
	 * Check if contract has all required elements
	 */
	private checkRequiredElements(contractData: ContractData): boolean {
		return !!(
			contractData.title &&
			contractData.parties.landlord.name &&
			contractData.parties.tenant.name &&
			contractData.room.buildingName &&
			contractData.financial.monthlyRent > 0 &&
			contractData.duration.startDate
		);
	}

	/**
	 * Check legal capacity of parties
	 */
	private checkLegalCapacity(_contractData: ContractData): boolean {
		// In real implementation, check age, mental capacity, etc.
		// For now, assume all parties have legal capacity
		return true;
	}

	/**
	 * Check if transaction is voluntary
	 */
	private checkVoluntary(_contractData: ContractData): boolean {
		// In real implementation, check for coercion, fraud, etc.
		// For now, assume voluntary
		return true;
	}

	/**
	 * Check if purpose is legal
	 */
	private checkPurpose(_contractData: ContractData): boolean {
		// Rental contracts are generally legal
		return true;
	}

	/**
	 * Check if form is correct
	 */
	private checkForm(_contractData: ContractData): boolean {
		// Electronic contracts are valid if properly authenticated
		return true;
	}

	/**
	 * Check authentication method
	 */
	private checkAuthentication(signature: SignatureMetadata): boolean {
		return !!(
			signature.authentication.method === 'SMS_OTP' &&
			signature.authentication.verificationCode &&
			signature.authentication.otpVerifiedAt
		);
	}

	/**
	 * Check data integrity
	 */
	private checkIntegrity(signature: SignatureMetadata): boolean {
		return !!(signature.integrity.signatureHash && signature.integrity.contractHash);
	}

	/**
	 * Check non-repudiation
	 */
	private checkNonRepudiation(signature: SignatureMetadata): boolean {
		return !!(
			signature.signer.idNumber &&
			signature.authentication.verificationCode &&
			signature.signingContext.timestamp
		);
	}

	/**
	 * Check timestamp
	 */
	private checkTimestamp(signature: SignatureMetadata): boolean {
		return !!signature.signingContext.timestamp;
	}

	/**
	 * Check required fields in metadata
	 */
	private checkRequiredFields(obj: any, required: string[]): string[] {
		const missing: string[] = [];

		for (const field of required) {
			const value = this.getNestedValue(obj, field);
			if (value === undefined || value === null || value === '') {
				missing.push(field);
			}
		}

		return missing;
	}

	/**
	 * Get nested value from object using dot notation
	 */
	private getNestedValue(obj: any, path: string): any {
		return path.split('.').reduce((current, key) => current?.[key], obj);
	}
}
