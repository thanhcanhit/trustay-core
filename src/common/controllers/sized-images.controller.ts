import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Controller to handle size-prefixed image requests
 * Handles routes like /128x128/images/filename.png
 */
@Controller()
export class SizedImagesController {
	private readonly validSizes = ['128x128', '256x256', '512x512', '1024x1024', '1920x1080'];

	@Get(':size/images/*')
	async serveSizedImage(
		@Param('size') size: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		// Validate size parameter
		if (!this.validSizes.includes(size)) {
			res.status(400).json({
				statusCode: 400,
				message: `Invalid image size. Valid sizes: ${this.validSizes.join(', ')}`,
				error: 'Bad Request',
			});
			return;
		}

		// Extract image path from request path
		const requestPath = req.path || '';
		const imagesPrefix = `/${size}/images/`;
		const imagesIndex = requestPath.indexOf(imagesPrefix);

		if (imagesIndex === -1) {
			res.status(400).json({
				statusCode: 400,
				message: 'Invalid image path format',
				error: 'Bad Request',
			});
			return;
		}

		const imagePath = requestPath.substring(imagesIndex + imagesPrefix.length);

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
		const fullPath = join(process.cwd(), 'uploads', 'images', size, imagePath);

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
