/**
 * Convert enum values to uppercase array
 * @param enumObject - The enum object to convert
 * @returns Array of uppercase enum values
 */
export function uppercaseArray<T extends Record<string, string>>(enumObject: T): string[] {
	return Object.values(enumObject).map((value) => value.toUpperCase());
}

/**
 * Convert enum values to lowercase array
 * @param enumObject - The enum object to convert
 * @returns Array of lowercase enum values
 */
export function lowercaseArray<T extends Record<string, string>>(enumObject: T): string[] {
	return Object.values(enumObject).map((value) => value.toLowerCase());
}

/**
 * Get original enum values as array
 * @param enumObject - The enum object to convert
 * @returns Array of original enum values
 */
export function enumToArray<T extends Record<string, string>>(enumObject: T): string[] {
	return Object.values(enumObject);
}
