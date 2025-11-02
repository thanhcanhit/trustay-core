import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Controller, Get, Logger, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
	private readonly logger = new Logger(StaticFilesController.name);
	private readonly defaultSize = '512x512';
	private readonly validSizes = ['128x128', '256x256', '512x512', '1024x1024', '1920x1080'];
	private readonly uploadDir: string;

	constructor(private readonly configService: ConfigService) {
		this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads/images';
	}

	@Get('*path')
	async serveImage(
		@Param('path') imagePathParam: string | string[],
		@Res() res: Response,
	): Promise<void> {
		// Handle both string and array (NestJS wildcard can return array)
		const imagePath = Array.isArray(imagePathParam) ? imagePathParam.join('/') : imagePathParam;

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

		// Construct the full path to the image file using the same uploadDir as UploadService
		const relativePath = join(this.uploadDir, size, filename);
		// Resolve to absolute path (required by res.sendFile)
		const fullPath = resolve(relativePath);

		this.logger.debug(`Serving image: ${fullPath} (size: ${size}, filename: ${filename})`);

		// Check if the file exists
		if (!existsSync(fullPath)) {
			this.logger.warn(`Image not found: ${fullPath}`);
			res.status(404).json({
				statusCode: 404,
				message: 'Image not found',
				error: 'Not Found',
			});
			return;
		}

		// Send the file (path must be absolute)
		res.sendFile(fullPath);
	}
}
