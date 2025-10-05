import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Param,
	Res,
} from '@nestjs/common';
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
			throw new BadRequestException('Invalid image path');
		}

		// Construct the full path to the image file
		const fullPath = join(process.cwd(), 'uploads', 'images', imagePath);

		// Check if the file exists
		if (!existsSync(fullPath)) {
			throw new NotFoundException('Image not found');
		}

		// Send the file
		res.sendFile(fullPath);
	}
}
