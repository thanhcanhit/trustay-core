/**
 * Safely converts Prisma Decimal-like values into native numbers.
 * Handles Decimal objects, strings, and primitives while defaulting to 0 for invalid inputs.
 */
export const convertDecimalToNumber = (value: unknown): number => {
	if (value === null || value === undefined) {
		return 0;
	}
	if (typeof value === 'number') {
		return value;
	}
	if (typeof value === 'object') {
		const decimalObject = value as { toNumber?: () => number };
		if ('toNumber' in decimalObject && typeof decimalObject.toNumber === 'function') {
			return decimalObject.toNumber();
		}
		const decimalLike = value as { d?: number[]; e?: number; s?: number };
		if (Array.isArray(decimalLike.d) && typeof decimalLike.s === 'number') {
			const digits = decimalLike.d;
			if (digits.length === 0) {
				return 0;
			}
			if (digits.length === 1 && typeof digits[0] === 'number') {
				return digits[0] * (decimalLike.s ?? 1);
			}
			const numStr = digits.join('');
			const parsed = Number.parseFloat(numStr);
			return Number.isNaN(parsed) ? 0 : parsed * (decimalLike.s ?? 1);
		}
		if ('toString' in value && typeof value.toString === 'function') {
			const parsed = Number(value.toString());
			return Number.isNaN(parsed) ? 0 : parsed;
		}
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};
