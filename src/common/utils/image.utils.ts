/**
 * Image size options for different use cases
 */
export enum ImageSize {
	THUMBNAIL = '128x128', // Thumbnails, avatars
	SMALL = '256x256', // Small previews
	MEDIUM = '512x512', // Medium previews (default)
	LARGE = '1024x1024', // Large previews
	HD = '1920x1080', // Full HD display
}

/**
 * Get full image URL with specified size
 *
 * @param imagePath - Image path returned from upload API (e.g., "/images/123-abc.jpg")
 * @param size - Image size enum (default: MEDIUM)
 * @param baseUrl - API base URL (optional, uses environment variable)
 * @returns Full URL to the sized image
 *
 * @example
 * ```typescript
 * // Basic usage
 * const imageUrl = getImageSrc("/images/123-abc.jpg");
 * // Returns: "https://api.trustay.com/images/512x512/123-abc.jpg"
 *
 * // With specific size
 * const thumbUrl = getImageSrc("/images/123-abc.jpg", ImageSize.THUMBNAIL);
 * // Returns: "https://api.trustay.com/images/128x128/123-abc.jpg"
 *
 * // With custom base URL
 * const customUrl = getImageSrc("/images/123-abc.jpg", ImageSize.HD, "https://cdn.example.com");
 * // Returns: "https://cdn.example.com/images/1920x1080/123-abc.jpg"
 * ```
 */
export function getImageSrc(
	imagePath: string,
	size: ImageSize = ImageSize.MEDIUM,
	baseUrl?: string,
): string {
	// Validate input
	if (!imagePath || typeof imagePath !== 'string') {
		console.warn('getImageSrc: Invalid imagePath provided', imagePath);
		return '';
	}

	// Handle non-image paths
	if (!imagePath.startsWith('/images/')) {
		console.warn('getImageSrc: Path does not start with /images/', imagePath);
		return imagePath;
	}

	// Get base URL from environment or parameter
	const apiBaseUrl =
		baseUrl ||
		(typeof window !== 'undefined' && window.location
			? `${window.location.protocol}//${window.location.host}`
			: process.env.NEXT_PUBLIC_API_URL ||
				process.env.REACT_APP_API_URL ||
				'http://localhost:3000');

	// Extract filename from path
	const filename = imagePath.substring(8); // Remove "/images/" prefix

	// Construct sized image URL
	return `${apiBaseUrl}/images/${size}/${filename}`;
}

/**
 * Get multiple image sizes for responsive images
 *
 * @param imagePath - Image path returned from upload API
 * @param sizes - Array of image sizes to generate
 * @param baseUrl - API base URL (optional)
 * @returns Object with size as key and URL as value
 *
 * @example
 * ```typescript
 * const responsiveImages = getResponsiveImageSrcs("/images/123-abc.jpg", [
 *   ImageSize.SMALL,
 *   ImageSize.MEDIUM,
 *   ImageSize.LARGE
 * ]);
 *
 * // Returns:
 * // {
 * //   "256x256": "https://api.trustay.com/images/256x256/123-abc.jpg",
 * //   "512x512": "https://api.trustay.com/images/512x512/123-abc.jpg",
 * //   "1024x1024": "https://api.trustay.com/images/1024x1024/123-abc.jpg"
 * // }
 * ```
 */
export function getResponsiveImageSrcs(
	imagePath: string,
	sizes: ImageSize[] = [ImageSize.SMALL, ImageSize.MEDIUM, ImageSize.LARGE],
	baseUrl?: string,
): Record<string, string> {
	const result: Record<string, string> = {};

	sizes.forEach((size) => {
		result[size] = getImageSrc(imagePath, size, baseUrl);
	});

	return result;
}

/**
 * Generate srcSet string for responsive images
 *
 * @param imagePath - Image path returned from upload API
 * @param sizeConfigs - Array of size and width configurations
 * @param baseUrl - API base URL (optional)
 * @returns srcSet string for use in img or picture elements
 *
 * @example
 * ```typescript
 * const srcSet = getImageSrcSet("/images/123-abc.jpg", [
 *   { size: ImageSize.SMALL, width: 256 },
 *   { size: ImageSize.MEDIUM, width: 512 },
 *   { size: ImageSize.LARGE, width: 1024 }
 * ]);
 *
 * // Returns:
 * // "https://api.trustay.com/images/256x256/123-abc.jpg 256w,
 * //  https://api.trustay.com/images/512x512/123-abc.jpg 512w,
 * //  https://api.trustay.com/images/1024x1024/123-abc.jpg 1024w"
 * ```
 */
export function getImageSrcSet(
	imagePath: string,
	sizeConfigs: Array<{ size: ImageSize; width: number }> = [
		{ size: ImageSize.SMALL, width: 256 },
		{ size: ImageSize.MEDIUM, width: 512 },
		{ size: ImageSize.LARGE, width: 1024 },
		{ size: ImageSize.HD, width: 1920 },
	],
	baseUrl?: string,
): string {
	return sizeConfigs
		.map(({ size, width }) => `${getImageSrc(imagePath, size, baseUrl)} ${width}w`)
		.join(', ');
}

/**
 * React hook for image URLs (optional, for React projects)
 */
export function useImageSrc(
	imagePath: string,
	size: ImageSize = ImageSize.MEDIUM,
	baseUrl?: string,
) {
	return getImageSrc(imagePath, size, baseUrl);
}
