import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpStatus,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	Param,
	Post,
	Request,
	Res,
	UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PDFGenerationService } from '../../common/services/pdf-generation.service';
import { PDFStorageService } from '../../common/services/pdf-storage.service';
import { transformToPDFContract } from '../../common/utils/contract-data-transformer.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface GeneratePDFRequest {
	contractId: string;
	includeSignatures?: boolean;
	options?: {
		format?: 'A4' | 'A3' | 'Letter';
		margin?: {
			top: string;
			bottom: string;
			left: string;
			right: string;
		};
		printBackground?: boolean;
	};
}

export interface GeneratePDFResponse {
	success: boolean;
	pdfUrl?: string;
	hash?: string;
	size?: number;
	downloadUrl?: string;
	expiresAt?: Date;
	error?: string;
}

/**
 * Contracts Controller
 * Handles PDF generation and contract management
 */
@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
	private readonly logger = new Logger(ContractsController.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly pdfGenerationService: PDFGenerationService,
		private readonly pdfStorageService: PDFStorageService,
	) {}

	/**
	 * Generate PDF for a contract
	 */
	@Post(':contractId/pdf')
	async generateContractPDF(
		@Param('contractId') contractId: string,
		@Body() request: GeneratePDFRequest,
		@Request() req: any,
		@Res() res: Response,
	): Promise<void> {
		try {
			this.logger.log(`Generating PDF for contract ${contractId}`);

			// Get contract data from database
			const dbContract = await this.getContractWithRelations(contractId);
			if (!dbContract) {
				throw new NotFoundException('Contract not found');
			}

			// Check permissions
			await this.checkContractPermissions(dbContract, req.user.id);

			// Transform to PDF format
			const pdfContractData = transformToPDFContract(dbContract);

			// Generate PDF
			const pdfResult =
				request.includeSignatures &&
				pdfContractData.signatures &&
				pdfContractData.signedAt &&
				pdfContractData.signatures.landlord &&
				pdfContractData.signatures.tenant
					? await this.pdfGenerationService.generateSignedContractPDF(
							{
								...pdfContractData,
								signedAt: pdfContractData.signedAt,
								signatures: {
									landlord: pdfContractData.signatures.landlord,
									tenant: pdfContractData.signatures.tenant,
								},
							},
							request.options,
						)
					: await this.pdfGenerationService.generateContractPDF(pdfContractData, request.options);

			// Store PDF
			const storedPDF = await this.pdfStorageService.storePDF(
				pdfResult,
				pdfContractData.contractNumber,
				{
					encrypt: true,
					generateSignedUrl: true,
					signedUrlExpiry: 168, // 7 days
				},
			);

			// Update contract with PDF info
			await this.prisma.contract.update({
				where: { id: contractId },
				data: {
					pdfUrl: storedPDF.url,
					pdfHash: storedPDF.hash,
					pdfSize: storedPDF.size,
				},
			});

			// Create audit log
			await this.createAuditLog(
				contractId,
				req.user.id,
				'pdf_generated',
				{
					hash: storedPDF.hash,
					size: storedPDF.size,
					url: storedPDF.url,
				},
				req,
			);

			const response: GeneratePDFResponse = {
				success: true,
				pdfUrl: storedPDF.url,
				hash: storedPDF.hash,
				size: storedPDF.size,
				downloadUrl: storedPDF.url,
				expiresAt: storedPDF.expiresAt,
			};

			res.status(HttpStatus.OK).json(response);
		} catch (error) {
			this.logger.error(`Failed to generate PDF for contract ${contractId}:`, error);

			if (error instanceof NotFoundException) {
				throw error;
			}

			const response: GeneratePDFResponse = {
				success: false,
				error: error.message || 'Failed to generate PDF',
			};

			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
		}
	}

	/**
	 * Download PDF by contract ID
	 */
	@Get(':contractId/pdf')
	async downloadContractPDF(
		@Param('contractId') contractId: string,
		@Request() req: any,
		@Res() res: Response,
	): Promise<void> {
		try {
			// Get contract
			const contract = await this.prisma.contract.findUnique({
				where: { id: contractId },
				select: {
					id: true,
					contractCode: true,
					pdfUrl: true,
					pdfHash: true,
					landlordId: true,
					tenantId: true,
				},
			});

			if (!contract) {
				throw new NotFoundException('Contract not found');
			}

			// Check permissions
			if (contract.landlordId !== req.user.id && contract.tenantId !== req.user.id) {
				throw new BadRequestException('Access denied');
			}

			if (!contract.pdfUrl || !contract.pdfHash) {
				throw new NotFoundException('PDF not found for this contract');
			}

			// Retrieve PDF
			const pdfBuffer = await this.pdfStorageService.retrievePDF(
				contract.contractCode,
				contract.pdfHash,
			);

			// Verify integrity
			const isValid = await this.pdfStorageService.verifyPDFIntegrity(
				contract.contractCode,
				contract.pdfHash,
			);

			if (!isValid) {
				throw new InternalServerErrorException('PDF integrity verification failed');
			}

			// Create audit log
			await this.createAuditLog(
				contractId,
				req.user.id,
				'pdf_downloaded',
				{
					hash: contract.pdfHash,
				},
				req,
			);

			// Set response headers
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader(
				'Content-Disposition',
				`attachment; filename="HD-${contract.contractCode}.pdf"`,
			);
			res.setHeader('Content-Length', pdfBuffer.length);
			res.setHeader('Cache-Control', 'private, max-age=3600');

			// Send PDF
			res.send(pdfBuffer);
		} catch (error) {
			this.logger.error(`Failed to download PDF for contract ${contractId}:`, error);

			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}

			throw new InternalServerErrorException('Failed to download PDF');
		}
	}

	/**
	 * Get PDF preview/thumbnail
	 */
	@Get(':contractId/pdf/preview')
	async getContractPreview(
		@Param('contractId') contractId: string,
		@Request() req: any,
		@Res() res: Response,
	): Promise<void> {
		try {
			// Get contract data
			const dbContract = await this.getContractWithRelations(contractId);
			if (!dbContract) {
				throw new NotFoundException('Contract not found');
			}

			// Check permissions
			await this.checkContractPermissions(dbContract, req.user.id);

			// Transform to PDF format
			const pdfContractData = transformToPDFContract(dbContract);

			// Generate preview
			const previewBuffer =
				await this.pdfGenerationService.generateContractPreview(pdfContractData);

			// Set response headers
			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Content-Disposition', `inline; filename="preview-${contractId}.png"`);
			res.setHeader('Content-Length', previewBuffer.length);
			res.setHeader('Cache-Control', 'private, max-age=3600');

			// Send preview
			res.send(previewBuffer);
		} catch (error) {
			this.logger.error(`Failed to generate preview for contract ${contractId}:`, error);
			throw new InternalServerErrorException('Failed to generate preview');
		}
	}

	/**
	 * Verify PDF integrity
	 */
	@Get(':contractId/pdf/verify')
	async verifyPDFIntegrity(
		@Param('contractId') contractId: string,
		@Request() req: any,
	): Promise<{ valid: boolean; hash: string; lastVerified: Date }> {
		try {
			const contract = await this.prisma.contract.findUnique({
				where: { id: contractId },
				select: {
					contractCode: true,
					pdfHash: true,
					landlordId: true,
					tenantId: true,
				},
			});

			if (!contract) {
				throw new NotFoundException('Contract not found');
			}

			// Check permissions
			if (contract.landlordId !== req.user.id && contract.tenantId !== req.user.id) {
				throw new BadRequestException('Access denied');
			}

			if (!contract.pdfHash) {
				throw new NotFoundException('PDF not found for this contract');
			}

			// Verify integrity
			const isValid = await this.pdfStorageService.verifyPDFIntegrity(
				contract.contractCode,
				contract.pdfHash,
			);

			return {
				valid: isValid,
				hash: contract.pdfHash,
				lastVerified: new Date(),
			};
		} catch (error) {
			this.logger.error(`Failed to verify PDF for contract ${contractId}:`, error);
			throw new InternalServerErrorException('Failed to verify PDF');
		}
	}

	/**
	 * Get contract with all relations
	 */
	private async getContractWithRelations(contractId: string) {
		return this.prisma.contract.findUnique({
			where: { id: contractId },
			include: {
				landlord: {
					include: {
						addresses: {
							include: {
								ward: true,
								district: true,
								province: true,
							},
						},
					},
				},
				tenant: {
					include: {
						addresses: {
							include: {
								ward: true,
								district: true,
								province: true,
							},
						},
					},
				},
				roomInstance: {
					include: {
						room: {
							include: {
								amenities: {
									include: {
										systemAmenity: true,
									},
								},
								costs: {
									include: {
										systemCostType: true,
									},
								},
								building: {
									include: {
										ward: true,
										district: true,
										province: true,
									},
								},
							},
						},
					},
				},
				signatures: true,
			},
		});
	}

	/**
	 * Check contract permissions
	 */
	private async checkContractPermissions(contract: any, userId: string): Promise<void> {
		if (contract.landlordId !== userId && contract.tenantId !== userId) {
			throw new BadRequestException('Access denied to this contract');
		}
	}

	/**
	 * Create audit log
	 */
	private async createAuditLog(
		contractId: string,
		userId: string,
		action: string,
		actionDetails: any,
		req: any,
	): Promise<void> {
		try {
			await this.prisma.contractAuditLog.create({
				data: {
					contractId,
					userId,
					action,
					actionDetails,
					ipAddress: req.ip || 'unknown',
					userAgent: req.get('user-agent') || 'unknown',
					sessionId: req.sessionID,
				},
			});
		} catch (error) {
			this.logger.warn(`Failed to create audit log: ${error.message}`);
		}
	}
}
