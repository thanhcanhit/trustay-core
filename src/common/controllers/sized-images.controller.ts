import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Controller, Get, Logger, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

/**
 * Controller to handle size-prefixed image requests
 * Handles routes like /128x128/images/filename.png
 */
@Controller()
export class SizedImagesController {
	private readonly logger = new Logger(SizedImagesController.name);
	private readonly validSizes = ['128x128', '256x256', '512x512', '1024x1024', '1920x1080'];
	private readonly uploadDir: string;

	constructor(private readonly configService: ConfigService) {
		this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads/images';
	}

	@Get(':size/images/*path')
	async serveSizedImage(
		@Param('size') size: string,
		@Param('path') imagePathParam: string | string[],
		@Res() res: Response,
	): Promise<void> {
		this.logger.debug(
			`SizedImagesController called: size=${size}, path=${JSON.stringify(imagePathParam)}`,
		);

		// Validate size parameter
		if (!this.validSizes.includes(size)) {
			res.status(400).json({
				statusCode: 400,
				message: `Invalid image size. Valid sizes: ${this.validSizes.join(', ')}`,
				error: 'Bad Request',
			});
			return;
		}

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

		// Construct the full path to the image file using the same uploadDir as UploadService
		const relativePath = join(this.uploadDir, size, imagePath);
		// Resolve to absolute path (required by res.sendFile)
		const fullPath = resolve(relativePath);

		this.logger.debug(`Serving sized image: ${fullPath} (size: ${size}, path: ${imagePath})`);

		// Check if the file exists
		if (!existsSync(fullPath)) {
			this.logger.warn(`Sized image not found: ${fullPath}`);
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
