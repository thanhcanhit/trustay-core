import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PDFResult } from './pdf-generation.service';

export interface StorageConfig {
	localPath: string;
	s3Bucket?: string;
	s3Region?: string;
	awsAccessKeyId?: string;
	awsSecretAccessKey?: string;
	retentionYears: number;
	encryptionKey?: string;
}

export interface StoredPDF {
	url: string;
	hash: string;
	size: number;
	storedAt: Date;
	expiresAt?: Date;
	metadata: {
		contractNumber: string;
		generatedAt: Date;
		pageCount: number;
		retentionYears: number;
	};
}

/**
 * PDF Storage Service
 * Handles secure storage and retrieval of contract PDFs
 * Compliant with Vietnamese law (10-year retention requirement)
 */
@Injectable()
export class PDFStorageService {
	private readonly logger = new Logger(PDFStorageService.name);
	private readonly config: StorageConfig;

	constructor() {
		this.config = {
			localPath: process.env.PDF_STORAGE_PATH || './uploads/contracts',
			s3Bucket: process.env.S3_BUCKET,
			s3Region: process.env.AWS_REGION || 'ap-southeast-1',
			awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
			awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			retentionYears: 10, // Vietnamese law requirement
			encryptionKey: process.env.PDF_ENCRYPTION_KEY,
		};
	}

	/**
	 * Store PDF with security and retention
	 */
	async storePDF(
		pdfResult: PDFResult,
		contractNumber: string,
		options: {
			encrypt?: boolean;
			generateSignedUrl?: boolean;
			signedUrlExpiry?: number; // hours
		} = {},
	): Promise<StoredPDF> {
		try {
			// Ensure storage directory exists
			await this.ensureStorageDirectory();

			// Encrypt PDF if requested
			let finalBuffer = pdfResult.buffer;
			if (options.encrypt && this.config.encryptionKey) {
				finalBuffer = this.encryptBuffer(pdfResult.buffer);
			}

			// Generate storage path
			const storagePath = this.generateStoragePath(contractNumber, pdfResult.hash);

			// Store locally
			const localPath = path.join(this.config.localPath, storagePath);
			const directory = path.dirname(localPath);
			await fs.promises.mkdir(directory, { recursive: true });
			await fs.promises.writeFile(localPath, finalBuffer);

			// Store in S3 if configured
			let s3Url: string | undefined;
			if (this.config.s3Bucket) {
				s3Url = await this.storeInS3(finalBuffer, storagePath, contractNumber, pdfResult);
			}

			// Generate access URL
			const accessUrl = s3Url || this.generateLocalUrl(storagePath);

			// Calculate retention expiry
			const retentionDate = new Date();
			retentionDate.setFullYear(retentionDate.getFullYear() + this.config.retentionYears);

			const storedPDF: StoredPDF = {
				url: accessUrl,
				hash: pdfResult.hash,
				size: pdfResult.size,
				storedAt: new Date(),
				expiresAt: options.generateSignedUrl
					? new Date(Date.now() + (options.signedUrlExpiry || 168) * 60 * 60 * 1000)
					: // 7 days default
						retentionDate,
				metadata: {
					contractNumber,
					generatedAt: pdfResult.metadata.generatedAt,
					pageCount: pdfResult.metadata.pageCount,
					retentionYears: this.config.retentionYears,
				},
			};

			this.logger.log(
				`Stored PDF for contract ${contractNumber}: ${pdfResult.size} bytes, hash: ${pdfResult.hash}`,
			);

			return storedPDF;
		} catch (error) {
			this.logger.error(`Failed to store PDF for contract ${contractNumber}:`, error);
			throw new Error(`PDF storage failed: ${error.message}`);
		}
	}

	/**
	 * Retrieve PDF by contract number and hash
	 */
	async retrievePDF(contractNumber: string, hash: string): Promise<Buffer> {
		try {
			const storagePath = this.generateStoragePath(contractNumber, hash);
			const localPath = path.join(this.config.localPath, storagePath);

			// Check if file exists locally
			if (await this.fileExists(localPath)) {
				const buffer = await fs.promises.readFile(localPath);

				// Decrypt if needed
				if (this.isEncrypted(buffer)) {
					return this.decryptBuffer(buffer);
				}

				return buffer;
			}

			// Try S3 if local file not found
			if (this.config.s3Bucket) {
				return await this.retrieveFromS3(storagePath);
			}

			throw new Error(`PDF not found for contract ${contractNumber}`);
		} catch (error) {
			this.logger.error(`Failed to retrieve PDF for contract ${contractNumber}:`, error);
			throw new Error(`PDF retrieval failed: ${error.message}`);
		}
	}

	/**
	 * Generate signed URL for secure access
	 */
	async generateSignedURL(
		contractNumber: string,
		hash: string,
		expiryHours: number = 24,
	): Promise<string> {
		try {
			const storagePath = this.generateStoragePath(contractNumber, hash);

			if (this.config.s3Bucket) {
				return await this.generateS3SignedURL(storagePath, expiryHours);
			}

			// For local storage, generate a temporary access token
			return this.generateLocalSignedURL(storagePath, expiryHours);
		} catch (error) {
			this.logger.error(`Failed to generate signed URL for contract ${contractNumber}:`, error);
			throw new Error(`Signed URL generation failed: ${error.message}`);
		}
	}

	/**
	 * Verify PDF integrity
	 */
	async verifyPDFIntegrity(contractNumber: string, expectedHash: string): Promise<boolean> {
		try {
			const buffer = await this.retrievePDF(contractNumber, expectedHash);
			const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
			return actualHash === expectedHash;
		} catch (error) {
			this.logger.error(`Failed to verify PDF integrity for contract ${contractNumber}:`, error);
			return false;
		}
	}

	/**
	 * Delete PDF (with audit trail)
	 */
	async deletePDF(contractNumber: string, hash: string, reason: string): Promise<void> {
		try {
			const storagePath = this.generateStoragePath(contractNumber, hash);
			const localPath = path.join(this.config.localPath, storagePath);

			// Delete local file
			if (await this.fileExists(localPath)) {
				await fs.promises.unlink(localPath);
			}

			// Delete from S3
			if (this.config.s3Bucket) {
				await this.deleteFromS3(storagePath);
			}

			this.logger.log(`Deleted PDF for contract ${contractNumber}, reason: ${reason}`);
		} catch (error) {
			this.logger.error(`Failed to delete PDF for contract ${contractNumber}:`, error);
			throw new Error(`PDF deletion failed: ${error.message}`);
		}
	}

	/**
	 * Get storage statistics
	 */
	async getStorageStats(): Promise<{
		totalFiles: number;
		totalSize: number;
		oldestFile: Date | null;
		newestFile: Date | null;
	}> {
		try {
			const files = await fs.promises.readdir(this.config.localPath, { withFileTypes: true });
			const pdfFiles = files.filter((file) => file.isFile() && file.name.endsWith('.pdf'));

			let totalSize = 0;
			let oldestFile: Date | null = null;
			let newestFile: Date | null = null;

			for (const file of pdfFiles) {
				const filePath = path.join(this.config.localPath, file.name);
				const stats = await fs.promises.stat(filePath);

				totalSize += stats.size;

				if (!oldestFile || stats.birthtime < oldestFile) {
					oldestFile = stats.birthtime;
				}

				if (!newestFile || stats.birthtime > newestFile) {
					newestFile = stats.birthtime;
				}
			}

			return {
				totalFiles: pdfFiles.length,
				totalSize,
				oldestFile,
				newestFile,
			};
		} catch (error) {
			this.logger.error('Failed to get storage stats:', error);
			return {
				totalFiles: 0,
				totalSize: 0,
				oldestFile: null,
				newestFile: null,
			};
		}
	}

	// Private helper methods

	private async ensureStorageDirectory(): Promise<void> {
		if (!(await this.directoryExists(this.config.localPath))) {
			await fs.promises.mkdir(this.config.localPath, { recursive: true });
		}
	}

	private async directoryExists(path: string): Promise<boolean> {
		try {
			const stats = await fs.promises.stat(path);
			return stats.isDirectory();
		} catch {
			return false;
		}
	}

	private async fileExists(path: string): Promise<boolean> {
		try {
			await fs.promises.access(path);
			return true;
		} catch {
			return false;
		}
	}

	private generateStoragePath(contractNumber: string, hash: string): string {
		const year = new Date().getFullYear();
		const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
		return `${year}/${month}/${contractNumber}/${hash}.pdf`;
	}

	private generateLocalUrl(storagePath: string): string {
		return `/api/contracts/pdf/${storagePath}`;
	}

	private generateLocalSignedURL(storagePath: string, expiryHours: number): string {
		// In a real implementation, generate a JWT token for temporary access
		const token = crypto.randomBytes(32).toString('hex');
		const expiry = Date.now() + expiryHours * 60 * 60 * 1000;
		return `/api/contracts/pdf/${storagePath}?token=${token}&expires=${expiry}`;
	}

	private encryptBuffer(buffer: Buffer): Buffer {
		if (!this.config.encryptionKey) {
			throw new Error('Encryption key not configured');
		}

		// Create a key from the encryption key
		const key = crypto.createHash('sha256').update(this.config.encryptionKey).digest();
		const iv = crypto.randomBytes(16);

		const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
		const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

		// Add encryption header with IV
		const header = Buffer.from('ENCRYPTED:', 'utf8');
		return Buffer.concat([header, iv, encrypted]);
	}

	private decryptBuffer(buffer: Buffer): Buffer {
		if (!this.config.encryptionKey) {
			throw new Error('Encryption key not configured');
		}

		if (!this.isEncrypted(buffer)) {
			return buffer;
		}

		// Extract IV and encrypted data
		const iv = buffer.slice(10, 26); // 16 bytes IV
		const encrypted = buffer.slice(26);

		// Create key from encryption key
		const key = crypto.createHash('sha256').update(this.config.encryptionKey).digest();

		const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
		return Buffer.concat([decipher.update(encrypted), decipher.final()]);
	}

	private isEncrypted(buffer: Buffer): boolean {
		return buffer.toString('utf8', 0, 10) === 'ENCRYPTED:';
	}

	// S3 methods (placeholder implementations)
	private async storeInS3(
		_buffer: Buffer,
		key: string,
		_contractNumber: string,
		_pdfResult: PDFResult,
	): Promise<string> {
		// In a real implementation, use AWS SDK
		this.logger.log(`Would store in S3: ${key}`);
		return `https://s3.${this.config.s3Region}.amazonaws.com/${this.config.s3Bucket}/${key}`;
	}

	private async retrieveFromS3(_key: string): Promise<Buffer> {
		// In a real implementation, use AWS SDK
		throw new Error('S3 retrieval not implemented');
	}

	private async deleteFromS3(key: string): Promise<void> {
		// In a real implementation, use AWS SDK
		this.logger.log(`Would delete from S3: ${key}`);
	}

	private async generateS3SignedURL(key: string, _expiryHours: number): Promise<string> {
		// In a real implementation, use AWS SDK
		this.logger.log(`Would generate S3 signed URL for: ${key}`);
		return `https://s3.${this.config.s3Region}.amazonaws.com/${this.config.s3Bucket}/${key}`;
	}
}
