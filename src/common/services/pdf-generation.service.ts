import { existsSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as puppeteer from 'puppeteer';
import { generateContractHTML } from '../templates/contract-template';
import { ContractData } from '../types/contract-metadata.types';

export interface PDFGenerationOptions {
	format?: 'A4' | 'A3' | 'Letter';
	margin?: {
		top: string;
		bottom: string;
		left: string;
		right: string;
	};
	printBackground?: boolean;
	displayHeaderFooter?: boolean;
	headerTemplate?: string;
	footerTemplate?: string;
}

export interface PDFResult {
	buffer: Buffer;
	hash: string;
	size: number;
	metadata: {
		generatedAt: Date;
		contractNumber: string;
		pageCount: number;
	};
}

/**
 * PDF Generation Service
 * Generates PDF contracts using Puppeteer with Vietnamese legal compliance
 */
@Injectable()
export class PDFGenerationService {
	private readonly logger = new Logger(PDFGenerationService.name);

	/**
	 * Generate PDF contract from contract data
	 */
	async generateContractPDF(
		contractData: ContractData & {
			contractNumber: string;
			createdAt: Date;
			signedAt?: Date;
			verificationCode: string;
			signatures?: {
				landlord?: string;
				tenant?: string;
			};
		},
		options: PDFGenerationOptions = {},
	): Promise<PDFResult> {
		const browser = await this.launchBrowser();

		try {
			const page = await browser.newPage();

			// Set viewport for consistent rendering
			await page.setViewport({
				width: 1200,
				height: 800,
				deviceScaleFactor: 1,
			});

			// Generate HTML content
			const html = generateContractHTML(contractData);

			// Set content and wait for all resources to load
			await page.setContent(html, {
				waitUntil: 'networkidle0',
				timeout: 30000,
			});

			// Wait for fonts and images to load
			await page.evaluateHandle('document.fonts.ready');

			// Generate PDF with options
			const pdfBuffer = await page.pdf({
				format: options.format || 'A4',
				printBackground: options.printBackground !== false,
				margin: options.margin || {
					top: '20mm',
					bottom: '20mm',
					left: '20mm',
					right: '20mm',
				},
				displayHeaderFooter: options.displayHeaderFooter || false,
				headerTemplate: options.headerTemplate || '',
				footerTemplate: options.footerTemplate || '',
				preferCSSPageSize: true,
				timeout: 30000,
			});

			// Calculate hash for integrity
			const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

			// Get page count
			const pageCount = await this.getPageCount(Buffer.from(pdfBuffer));

			this.logger.log(
				`Generated PDF for contract ${contractData.contractNumber}: ${pdfBuffer.length} bytes, ${pageCount} pages`,
			);

			return {
				buffer: Buffer.from(pdfBuffer),
				hash,
				size: pdfBuffer.length,
				metadata: {
					generatedAt: new Date(),
					contractNumber: contractData.contractNumber,
					pageCount,
				},
			};
		} catch (error) {
			this.logger.error('Failed to generate PDF:', error);
			throw new Error(`PDF generation failed: ${error.message}`);
		} finally {
			await browser.close();
		}
	}

	/**
	 * Generate PDF with signatures embedded
	 */
	async generateSignedContractPDF(
		contractData: ContractData & {
			contractNumber: string;
			createdAt: Date;
			signedAt: Date;
			verificationCode: string;
			signatures: {
				landlord: string;
				tenant: string;
			};
		},
		options: PDFGenerationOptions = {},
	): Promise<PDFResult> {
		// Add signature data to contract data
		const signedContractData = {
			...contractData,
			signatures: {
				landlord: contractData.signatures.landlord,
				tenant: contractData.signatures.tenant,
			},
		};

		return this.generateContractPDF(signedContractData, options);
	}

	/**
	 * Add signatures to existing PDF
	 */
	async addSignaturesToPDF(
		pdfBuffer: Buffer,
		signatures: Array<{
			image: string; // base64
			position: { x: number; y: number; width: number; height: number };
			page: number;
		}>,
	): Promise<Buffer> {
		const browser = await this.launchBrowser();

		try {
			const page = await browser.newPage();

			// Convert PDF to HTML with signatures
			const pdfBase64 = pdfBuffer.toString('base64');
			const html = `
        <html>
        <head>
          <style>
            body { margin: 0; padding: 0; }
            .pdf-container { position: relative; }
            .signature-overlay {
              position: absolute;
              z-index: 10;
            }
          </style>
        </head>
        <body>
          <div class="pdf-container">
            <embed src="data:application/pdf;base64,${pdfBase64}" 
                   type="application/pdf" width="100%" height="100%">
            ${signatures
							.map(
								(sig) => `
              <img src="${sig.image}" 
                   class="signature-overlay"
                   style="left: ${sig.position.x}px; 
                          top: ${sig.position.y}px;
                          width: ${sig.position.width}px;
                          height: ${sig.position.height}px;">
            `,
							)
							.join('')}
          </div>
        </body>
        </html>
      `;

			await page.setContent(html, { waitUntil: 'networkidle0' });

			const signedPdfBuffer = await page.pdf({
				format: 'A4',
				printBackground: true,
				margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
			});

			return Buffer.from(signedPdfBuffer);
		} finally {
			await browser.close();
		}
	}

	/**
	 * Verify PDF integrity using hash
	 */
	verifyPDFIntegrity(pdfBuffer: Buffer, expectedHash: string): boolean {
		const actualHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
		return actualHash === expectedHash;
	}

	/**
	 * Get PDF page count
	 */
	private async getPageCount(_pdfBuffer: Buffer): Promise<number> {
		// This is a simplified implementation
		// In a real scenario, you might use a PDF parsing library
		return 1; // Default to 1 page
	}

	/**
	 * Launch Puppeteer browser with optimized settings
	 */
	private resolveBrowserExecutable(): string | undefined {
		const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH;
		if (configuredPath && existsSync(configuredPath)) {
			return configuredPath;
		}

		if (configuredPath && !existsSync(configuredPath)) {
			this.logger.warn(`Configured PUPPETEER_EXECUTABLE_PATH not found: ${configuredPath}`);
		}

		const commonLinuxPaths = [
			'/usr/bin/chromium-browser',
			'/usr/bin/chromium',
			'/usr/bin/google-chrome',
		];
		for (const candidate of commonLinuxPaths) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		if (typeof puppeteer.executablePath === 'function') {
			try {
				const fallback = puppeteer.executablePath();
				if (fallback && existsSync(fallback)) {
					return fallback;
				}
			} catch (error) {
				this.logger.warn(
					`Failed to resolve Puppeteer executable path via Puppeteer API: ${String(error)}`,
				);
			}
		}

		return undefined;
	}

	private async launchBrowser(): Promise<puppeteer.Browser> {
		const executablePath = this.resolveBrowserExecutable();
		const launchOptions: puppeteer.LaunchOptions = {
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-accelerated-2d-canvas',
				'--no-first-run',
				'--no-zygote',
				'--disable-gpu',
				'--single-process',
				'--disable-features=site-per-process,SitePerProcess',
				'--disable-background-timer-throttling',
				'--disable-backgrounding-occluded-windows',
				'--disable-renderer-backgrounding',
			],
			timeout: 30000,
		};

		if (executablePath) {
			launchOptions.executablePath = executablePath;
		} else {
			this.logger.debug('Using bundled Chromium executable provided by Puppeteer');
		}

		return puppeteer.launch(launchOptions);
	}

	/**
	 * Generate contract preview (thumbnail)
	 */
	async generateContractPreview(
		contractData: ContractData & {
			contractNumber: string;
			createdAt: Date;
			signedAt?: Date;
			verificationCode: string;
		},
		_width: number = 200,
		_height: number = 280,
	): Promise<Buffer> {
		const browser = await this.launchBrowser();
		const overallTimeoutMs = 15000;
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Preview generation timed out')), overallTimeoutMs),
		);
		try {
			const work = (async () => {
				const page = await browser.newPage();
				page.setDefaultNavigationTimeout(12000);
				page.setDefaultTimeout(12000);
				page.on('error', (e) => this.logger.error(`Puppeteer page error: ${String(e)}`));
				page.on('pageerror', (e) => this.logger.error(`Puppeteer pageerror: ${String(e)}`));
				await page.setViewport({ width: 842, height: 595, deviceScaleFactor: 1 });

				const html = generateContractHTML(contractData);
				await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 12000 });
				// add Padding to the page
				await page.evaluateHandle('document.fonts && document.fonts.ready').catch(() => undefined);
				const screenshot = await page.screenshot({
					type: 'png',
					fullPage: true,
					optimizeForSpeed: true,
				});
				return Buffer.from(screenshot);
			})();
			return await Promise.race([work, timeoutPromise]);
		} catch (err) {
			this.logger.error(`Failed to generate contract preview: ${err?.message ?? 'Unknown error'}`);
			throw new Error(`Preview generation failed: ${err?.message ?? 'Unknown error'}`);
		} finally {
			await browser.close();
		}
	}

	/**
	 * Generate multiple contract pages if content is long
	 */
	async generateMultiPageContract(
		contractData: ContractData & {
			contractNumber: string;
			createdAt: Date;
			signedAt?: Date;
			verificationCode: string;
		},
		_options: PDFGenerationOptions = {},
	): Promise<PDFResult> {
		// For long contracts, we might need to split content
		// This is a placeholder for future multi-page support
		return this.generateContractPDF(contractData, _options);
	}
}
