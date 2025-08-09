import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';

export interface ImageSize {
	width: number;
	height: number;
	suffix: string;
}

export interface UploadResult {
	imagePath: string;
	savedToDb: boolean;
	imageId?: string;
}

@Injectable()
export class UploadService {
	private readonly uploadDir: string;
	private readonly baseUrl: string;

	private readonly imageSizes: ImageSize[] = [
		{ width: 128, height: 128, suffix: '128x128' },
		{ width: 256, height: 256, suffix: '256x256' },
		{ width: 512, height: 512, suffix: '512x512' },
		{ width: 1024, height: 1024, suffix: '1024x1024' },
		{ width: 1920, height: 1080, suffix: '1920x1080' },
	];

	private readonly allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
	private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

	constructor(
		private readonly configService: ConfigService,
		private readonly prisma: PrismaService,
	) {
		this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads/images';
		this.baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
	}

	private async ensureUploadDirectory(): Promise<void> {
		try {
			await fs.access(this.uploadDir);
		} catch {
			await fs.mkdir(this.uploadDir, { recursive: true });
		}
	}

	async uploadImage(
		file: Express.Multer.File,
		options: {
			altText?: string;
		} = {},
	): Promise<UploadResult> {
		const { altText } = options;

		// Validate file
		this.validateFile(file);

		// Ensure upload directory exists
		await this.ensureUploadDirectory();

		const fileName = await this.generateUniqueFileName(file.originalname);
		const ext = path.extname(fileName).toLowerCase();

		// Generate resized versions and store in size-specific directories
		for (const size of this.imageSizes) {
			const sizeDir = path.join(this.uploadDir, size.suffix);

			// Ensure size directory exists
			try {
				await fs.access(sizeDir);
			} catch {
				await fs.mkdir(sizeDir, { recursive: true });
			}

			const resizedPath = path.join(sizeDir, fileName);

			const resizedSharp = sharp(file.buffer)
				.rotate() // Auto-rotate
				.resize(size.width, size.height, {
					fit: 'cover',
					position: 'center',
					withoutEnlargement: true, // Don't upscale small images
				});

			// Apply same optimization based on format
			if (ext === '.png') {
				await resizedSharp
					.png({
						quality: 85,
						compressionLevel: 9,
					})
					.toFile(resizedPath);
			} else if (ext === '.webp') {
				await resizedSharp
					.webp({
						quality: 85,
						effort: 4,
					})
					.toFile(resizedPath);
			} else {
				await resizedSharp
					.jpeg({
						quality: 85,
						progressive: true,
					})
					.toFile(resizedPath);
			}
		}

		const imagePath = `/images/${fileName}`;

		return {
			imagePath,
			savedToDb: false, // Upload chỉ lưu file, không lưu DB
			imageId: undefined,
		};
	}

	async uploadMultipleImages(
		files: Express.Multer.File[],
		options: {
			altTexts?: string[];
		} = {},
	): Promise<UploadResult[]> {
		const results: UploadResult[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const altText = options.altTexts?.[i] || `Image ${i + 1}`;

			const result = await this.uploadImage(file, {
				altText,
			});

			results.push(result);
		}

		return results;
	}

	async deleteImage(imageId: string): Promise<boolean> {
		try {
			const roomImage = await this.prisma.roomImage.findUnique({
				where: { id: imageId },
			});

			if (!roomImage) {
				return false;
			}

			const fileName = path.basename(roomImage.imageUrl);
			await this.deleteFileAndResized(fileName);

			await this.prisma.roomImage.delete({
				where: { id: imageId },
			});

			return true;
		} catch (error) {
			console.error('Error deleting image:', error);
			return false;
		}
	}

	async deleteUserAvatar(userId: string): Promise<boolean> {
		try {
			const user = await this.prisma.user.findUnique({
				where: { id: userId },
				select: { avatarUrl: true },
			});

			if (!user?.avatarUrl || !user.avatarUrl.startsWith('/images/')) {
				return false;
			}

			const fileName = path.basename(user.avatarUrl);
			await this.deleteFileAndResized(fileName);

			await this.prisma.user.update({
				where: { id: userId },
				data: { avatarUrl: null },
			});

			return true;
		} catch (error) {
			console.error('Error deleting user avatar:', error);
			return false;
		}
	}

	async deleteFileByPath(imagePath: string): Promise<boolean> {
		try {
			if (!imagePath.startsWith('/images/')) {
				return false;
			}

			const fileName = path.basename(imagePath);
			await this.deleteFileAndResized(fileName);
			return true;
		} catch (error) {
			console.error('Error deleting file by path:', error);
			return false;
		}
	}

	private async deleteFileAndResized(fileName: string): Promise<void> {
		// Only delete from size directories (no original file to delete)
		for (const size of this.imageSizes) {
			const resizedPath = path.join(this.uploadDir, size.suffix, fileName);

			try {
				await fs.unlink(resizedPath);
			} catch {
				// Ignore file not found errors
			}
		}
	}

	getImageUrl(imagePath: string, size?: string): string {
		if (!imagePath.startsWith('/images/')) {
			return imagePath;
		}

		if (!size) {
			return `${this.baseUrl}${imagePath}`;
		}

		// For sized images: /images/128x128/filename.jpg
		const fileName = path.basename(imagePath);
		return `${this.baseUrl}/images/${size}/${fileName}`;
	}

	private sanitizeFileName(originalName: string): string {
		// Remove path separators and dangerous characters
		const fileName = originalName.replace(/[/\\:*?"<>|]/g, '');

		// Remove dots except for extension
		const ext = path.extname(fileName).toLowerCase();
		const nameWithoutExt = path.basename(fileName, ext);

		// Remove all dots from name part
		const cleanName = nameWithoutExt.replace(/\./g, '');

		// Remove non-ASCII characters and normalize
		const sanitizedName = cleanName
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '') // Remove accents
			.replace(/[^\w\s-]/g, '') // Keep only alphanumeric, spaces, hyphens
			.replace(/\s+/g, '-') // Replace spaces with hyphens
			.replace(/-+/g, '-') // Replace multiple hyphens with single
			.replace(/^-|-$/g, '') // Remove leading/trailing hyphens
			.toLowerCase()
			.substring(0, 50); // Limit length

		return sanitizedName || 'file'; // Fallback name
	}

	private validateFile(file: Express.Multer.File): void {
		// Check file size
		if (file.size > this.maxFileSize) {
			throw new Error(`File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`);
		}

		// Check file extension
		const ext = path.extname(file.originalname).toLowerCase();
		if (!this.allowedExtensions.includes(ext)) {
			throw new Error(`File extension ${ext} is not allowed`);
		}

		// Check MIME type
		const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowedMimes.includes(file.mimetype)) {
			throw new Error(`MIME type ${file.mimetype} is not allowed`);
		}
	}

	private async generateUniqueFileName(originalName: string): Promise<string> {
		const sanitizedBaseName = this.sanitizeFileName(originalName);
		const ext = path.extname(originalName).toLowerCase();

		// Generate unique filename with hash
		const timestamp = Date.now();
		const randomBytes = crypto.randomBytes(8).toString('hex');
		const hash = crypto
			.createHash('md5')
			.update(`${sanitizedBaseName}-${timestamp}`)
			.digest('hex')
			.substring(0, 8);

		const fileName = `${timestamp}-${hash}-${randomBytes}${ext}`;

		// Ensure file doesn't exist (extra safety)
		const filePath = path.join(this.uploadDir, fileName);
		try {
			await fs.access(filePath);
			// File exists, generate new one
			return this.generateUniqueFileName(originalName);
		} catch {
			// File doesn't exist, good to use
			return fileName;
		}
	}

	private generateFileName(originalName: string): string {
		const ext = path.extname(originalName);
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2);
		return `${timestamp}-${random}${ext}`;
	}

	private generateResizedFileName(fileName: string, suffix: string): string {
		const ext = path.extname(fileName);
		const nameWithoutExt = path.basename(fileName, ext);
		return `${nameWithoutExt}-${suffix}${ext}`;
	}

	async updateRoomImageOrder(
		roomId: string,
		imageOrders: { id: string; sortOrder: number }[],
	): Promise<void> {
		for (const { id, sortOrder } of imageOrders) {
			await this.prisma.roomImage.update({
				where: { id },
				data: { sortOrder },
			});
		}
	}

	async setPrimaryRoomImage(roomId: string, imageId: string): Promise<void> {
		await this.prisma.roomImage.updateMany({
			where: { roomId },
			data: { isPrimary: false },
		});

		await this.prisma.roomImage.update({
			where: { id: imageId },
			data: { isPrimary: true },
		});
	}
}
