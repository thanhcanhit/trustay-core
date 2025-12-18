/**
 * Serialize BigInt and Decimal values for JSON compatibility
 * @param data - Data that may contain BigInt or Decimal values
 * @returns Serialized data with BigInt/Decimal converted to numbers or strings
 */
export function serializeBigInt(data: unknown): unknown {
	if (data === null || data === undefined) {
		return data;
	}
	if (typeof data === 'bigint') {
		return data.toString();
	}
	// Handle Prisma Decimal type (has toNumber method)
	if (
		typeof data === 'object' &&
		data !== null &&
		'toNumber' in data &&
		typeof (data as any).toNumber === 'function'
	) {
		try {
			return (data as any).toNumber();
		} catch {
			// Fallback to string if toNumber fails
			return String(data);
		}
	}
	// Handle Decimal objects that were already serialized to JSON (have d, e, s properties)
	// This happens when Decimal is stored in database and retrieved as JSON
	// Decimal format: { d: number[], e: number, s: number } where d is digits array, e is exponent, s is sign
	if (
		typeof data === 'object' &&
		data !== null &&
		'd' in data &&
		'e' in data &&
		's' in data &&
		typeof (data as any).e === 'number' &&
		typeof (data as any).s === 'number'
	) {
		try {
			const d = (data as any).d;
			const e = (data as any).e;
			const s = (data as any).s;
			// Handle case where d might be an array or a number (depending on serialization)
			let digits: number[];
			if (Array.isArray(d)) {
				digits = d;
			} else if (typeof d === 'number') {
				digits = d === 0 ? [] : [d];
			} else {
				// Fallback: try to convert to number directly
				return 0;
			}
			// If no digits, return 0
			if (digits.length === 0) {
				return 0;
			}
			// Reconstruct number from Decimal format
			let numStr = s < 0 ? '-' : '';
			const digitsStr = digits.join('');
			const decimalPoint = digitsStr.length + e;
			if (decimalPoint <= 0) {
				numStr += `0.${'0'.repeat(-decimalPoint)}${digitsStr}`;
			} else if (decimalPoint >= digitsStr.length) {
				numStr += `${digitsStr}${'0'.repeat(decimalPoint - digitsStr.length)}`;
			} else {
				numStr += `${digitsStr.slice(0, decimalPoint)}.${digitsStr.slice(decimalPoint)}`;
			}
			const num = Number(numStr);
			return Number.isNaN(num) ? 0 : num;
		} catch {
			// If reconstruction fails, return 0 to avoid errors
			return 0;
		}
	}
	if (Array.isArray(data)) {
		return data.map((item) => serializeBigInt(item));
	}
	if (typeof data === 'object') {
		const serialized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
			serialized[key] = serializeBigInt(value);
		}
		return serialized;
	}
	return data;
}
