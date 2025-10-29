/**
 * Utility for serializing BigInt values to strings for JSON compatibility
 */
export class Serializer {
	/**
	 * Serialize BigInt values to strings for JSON compatibility
	 * @param data - Data that may contain BigInt values
	 * @returns Serialized data with BigInt converted to strings
	 */
	static serializeBigInt(data: any): any {
		if (data === null || data === undefined) {
			return data;
		}
		if (typeof data === 'bigint') {
			return data.toString();
		}
		if (Array.isArray(data)) {
			return data.map((item) => Serializer.serializeBigInt(item));
		}
		if (typeof data === 'object') {
			const serialized: any = {};
			for (const [key, value] of Object.entries(data)) {
				serialized[key] = Serializer.serializeBigInt(value);
			}
			return serialized;
		}
		return data;
	}
}
