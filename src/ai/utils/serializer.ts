/**
 * Serialize BigInt values to strings for JSON compatibility
 * @param data - Data that may contain BigInt values
 * @returns Serialized data with BigInt converted to strings
 */
export function serializeBigInt(data: unknown): unknown {
	if (data === null || data === undefined) {
		return data;
	}
	if (typeof data === 'bigint') {
		return data.toString();
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
