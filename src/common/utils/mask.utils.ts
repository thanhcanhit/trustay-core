/**
 * Masking utility functions for sensitive user data
 * Provides functions to mask emails, phone numbers, and other sensitive information
 */

/**
 * Mask an email address while preserving some characters for readability
 * @param email - The email address to mask
 * @param visibleStart - Number of characters to show at the start (default: 2)
 * @param visibleEnd - Number of characters to show at the end (default: 2)
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked email address
 *
 * @example
 * maskEmail('thanchanh.dev@gmail.com') // 'th****an**@**i*c**'
 * maskEmail('user@example.com') // 'us****@**e**'
 */
export function maskEmail(
	email: string,
	visibleStart: number = 2,
	visibleEnd: number = 2,
	maskChar: string = '*',
): string {
	if (!email || typeof email !== 'string') {
		return '';
	}

	const [localPart, domain] = email.split('@');

	if (!localPart || !domain) {
		return email;
	}

	// Mask local part
	const maskedLocal = maskText(localPart, visibleStart, visibleEnd, maskChar);

	// Mask domain
	const maskedDomain = maskText(domain, visibleStart, visibleEnd, maskChar);

	return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask a phone number while preserving some characters
 * @param phone - The phone number to mask
 * @param visibleStart - Number of characters to show at the start (default: 3)
 * @param visibleEnd - Number of characters to show at the end (default: 3)
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked phone number
 *
 * @example
 * maskPhone('0123456789') // '012****789'
 * maskPhone('+84123456789') // '+84****789'
 */
export function maskPhone(
	phone: string,
	visibleStart: number = 3,
	visibleEnd: number = 3,
	maskChar: string = '*',
): string {
	if (!phone || typeof phone !== 'string') {
		return '';
	}

	// Remove all non-digit characters except + at the beginning
	const cleanPhone = phone.replace(/[^\d+]/g, '');

	if (cleanPhone.length <= visibleStart + visibleEnd) {
		return phone;
	}

	return maskText(cleanPhone, visibleStart, visibleEnd, maskChar);
}

/**
 * Mask a credit card number showing only last 4 digits
 * @param cardNumber - The credit card number to mask
 * @param visibleEnd - Number of digits to show at the end (default: 4)
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked credit card number
 *
 * @example
 * maskCreditCard('1234567890123456') // '************3456'
 */
export function maskCreditCard(
	cardNumber: string,
	visibleEnd: number = 4,
	maskChar: string = '*',
): string {
	if (!cardNumber || typeof cardNumber !== 'string') {
		return '';
	}

	const cleanNumber = cardNumber.replace(/\D/g, '');

	if (cleanNumber.length <= visibleEnd) {
		return cardNumber;
	}

	const maskedLength = cleanNumber.length - visibleEnd;
	const maskedPart = maskChar.repeat(maskedLength);
	const visiblePart = cleanNumber.slice(-visibleEnd);

	return maskedPart + visiblePart;
}

/**
 * Mask a generic text string while preserving some characters
 * @param text - The text to mask
 * @param visibleStart - Number of characters to show at the start
 * @param visibleEnd - Number of characters to show at the end
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked text
 *
 * @example
 * maskText('John Doe', 2, 2) // 'Jo****oe'
 * maskText('username', 3, 2) // 'use****me'
 */
export function maskText(
	text: string,
	visibleStart: number,
	visibleEnd: number,
	maskChar: string = '*',
): string {
	if (!text || typeof text !== 'string') {
		return '';
	}

	const textLength = text.length;

	// If text is too short, return as is
	if (textLength <= visibleStart + visibleEnd) {
		return text;
	}

	const startPart = text.substring(0, visibleStart);
	const endPart = text.substring(textLength - visibleEnd);
	const maskedLength = textLength - visibleStart - visibleEnd;
	const maskedPart = maskChar.repeat(maskedLength);

	return startPart + maskedPart + endPart;
}

/**
 * Mask a Vietnamese ID number (CCCD/CMND)
 * @param idNumber - The ID number to mask
 * @param visibleStart - Number of characters to show at the start (default: 3)
 * @param visibleEnd - Number of characters to show at the end (default: 3)
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked ID number
 *
 * @example
 * maskIdNumber('123456789012') // '123****012'
 */
export function maskIdNumber(
	idNumber: string,
	visibleStart: number = 3,
	visibleEnd: number = 3,
	maskChar: string = '*',
): string {
	if (!idNumber || typeof idNumber !== 'string') {
		return '';
	}

	const cleanId = idNumber.replace(/\D/g, '');

	if (cleanId.length <= visibleStart + visibleEnd) {
		return idNumber;
	}

	return maskText(cleanId, visibleStart, visibleEnd, maskChar);
}

/**
 * Mask a full name while preserving first and last name initials
 * @param fullName - The full name to mask
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked full name
 *
 * @example
 * maskFullName('Nguyen Van An') // 'N**** V**** A**'
 * maskFullName('John Doe') // 'J**** D***'
 */
export function maskFullName(fullName: string, maskChar: string = '*'): string {
	if (!fullName || typeof fullName !== 'string') {
		return '';
	}

	return fullName
		.trim()
		.split(/\s+/)
		.map((name) => {
			if (name.length <= 1) {
				return name;
			}
			return maskText(name, 1, 0, maskChar);
		})
		.join(' ');
}

/**
 * Mask sensitive data based on the type of information
 * @param data - The data to mask
 * @param type - The type of sensitive data
 * @returns Masked data
 *
 * @example
 * maskSensitiveData('user@example.com', 'email') // 'us****@**e**'
 * maskSensitiveData('0123456789', 'phone') // '012****789'
 * maskSensitiveData('John Doe', 'name') // 'J**** D***'
 */
export function maskSensitiveData(
	data: string,
	type: 'email' | 'phone' | 'creditCard' | 'idNumber' | 'name' | 'text',
): string {
	if (!data || typeof data !== 'string') {
		return '';
	}

	switch (type) {
		case 'email':
			return maskEmail(data);
		case 'phone':
			return maskPhone(data);
		case 'creditCard':
			return maskCreditCard(data);
		case 'idNumber':
			return maskIdNumber(data);
		case 'name':
			return maskFullName(data);
		default:
			return maskText(data, 2, 2);
	}
}
