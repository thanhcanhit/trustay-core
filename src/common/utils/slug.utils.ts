import slugify from 'slugify';

/**
 * Generate a URL-friendly slug from text
 * Uses slugify library with Vietnamese character support
 */
export function generateSlug(text: string): string {
	return slugify(text, {
		lower: true, // Convert to lowercase
		strict: true, // Remove special characters
		locale: 'vi', // Vietnamese locale support
		trim: true, // Trim whitespace
	});
}

/**
 * Generate building slug from name and district
 * Format: "nha-tro-minh-phat-quan-9"
 */
export function generateBuildingSlug(name: string, districtName: string): string {
	const nameSlug = generateSlug(name);
	const districtSlug = generateSlug(districtName);
	return `${nameSlug}-${districtSlug}`;
}

/**
 * Generate room slug from building slug and room name
 * Format: "nha-tro-minh-phat-quan-9-phong-vip"
 */
export function generateRoomSlug(buildingSlug: string, roomName: string): string {
	const roomSlug = generateSlug(roomName);
	return `${buildingSlug}-${roomSlug}`;
}

/**
 * Generate unique slug by appending number if exists
 */
export async function generateUniqueSlug(
	baseSlug: string,
	checkExists: (slug: string) => Promise<boolean>,
): Promise<string> {
	let slug = baseSlug;
	let counter = 1;

	while (await checkExists(slug)) {
		slug = `${baseSlug}-${counter}`;
		counter++;
	}

	return slug;
}
