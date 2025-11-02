import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

/**
 * Controller to handle static file requests with proper 404 responses
 * Handles patterns:
 * - /images/{size}/{filename} - uses specified size
 * - /images/{filename} - uses default size 512x512
 * This replaces the default static file serving to return 404 instead of 500
 */
@Controller('images')
export class StaticFilesController {
	private readonly defaultSize = '512x512';
	private readonly validSizes = ['128x128', '256x256', '512x512', '1024x1024', '1920x1080'];

	@Get('*path')
	async serveImage(@Param('path') imagePath: string, @Res() res: Response): Promise<void> {
		// Validate the image path
		if (!imagePath || imagePath.includes('..') || imagePath.includes('//')) {
			res.status(400).json({
				statusCode: 400,
				message: 'Invalid image path',
				error: 'Bad Request',
			});
			return;
		}

		// Check if path starts with a valid size (e.g., "128x128/filename.png")
		const pathParts = imagePath.split('/');
		let size: string;
		let filename: string;

		if (pathParts.length >= 2 && this.validSizes.includes(pathParts[0])) {
			// Pattern: /images/128x128/filename.png
			size = pathParts[0];
			filename = pathParts.slice(1).join('/');
		} else {
			// Pattern: /images/filename.png (use default size)
			size = this.defaultSize;
			filename = imagePath;
		}

		// Construct the full path to the image file
		const fullPath = join(process.cwd(), 'uploads', 'images', size, filename);

		// Check if the file exists
		if (!existsSync(fullPath)) {
			res.status(404).json({
				statusCode: 404,
				message: 'Image not found',
				error: 'Not Found',
			});
			return;
		}

		// Send the file
		res.sendFile(fullPath);
	}
}
