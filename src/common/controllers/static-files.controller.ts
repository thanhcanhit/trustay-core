import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

/**
 * Controller to handle static file requests with proper 404 responses
 * This replaces the default static file serving to return 404 instead of 500
 */
@Controller('images')
export class StaticFilesController {
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

		// Construct the full path to the image file
		const fullPath = join(process.cwd(), 'uploads', 'images', imagePath);

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
