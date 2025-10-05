import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpException,
	HttpStatus,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	Request,
	Res,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PDFGenerationService } from '../../common/services/pdf-generation.service';
import { PDFStorageService } from '../../common/services/pdf-storage.service';
import { transformToPDFContract } from '../../common/utils/contract-data-transformer.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsNewService } from './contracts-new.service';
import { ContractStatusResponseDto } from './dto/contract-status-response.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';

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
 * Handles contract management, signing, and PDF generation
 */
@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
	private readonly logger = new Logger(ContractsController.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly contractsNewService: ContractsNewService,
		private readonly pdfGenerationService: PDFGenerationService,
		private readonly pdfStorageService: PDFStorageService,
	) {}

	/**
	 * MVP API 1: Tạo hợp đồng mới (status: draft)
	 */
	@Post()
	@ApiOperation({
		summary: 'Create a new contract',
		description: 'Create a new rental contract between landlord and tenant',
	})
	@ApiResponse({
		status: 201,
		description: 'Contract created successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid request data',
	})
	@ApiResponse({
		status: 403,
		description: 'Not authorized to create this contract',
	})
	@ApiResponse({
		status: 404,
		description: 'Room instance not found',
	})
	async createContract(@Body() dto: CreateContractDto, @Req() req: any) {
		this.logger.log(`Creating contract by user ${req.user.id}`);
		return this.contractsNewService.createContract(dto, req.user.id);
	}

	/**
	 * Helper API: Tạo hợp đồng từ Rental (auto-fill thông tin)
	 */
	@Post('from-rental/:rentalId')
	@ApiOperation({
		summary: 'Create contract from rental',
		description:
			'Create a new contract automatically filled with rental information. You can optionally provide additional contract data to override defaults.',
	})
	@ApiParam({
		name: 'rentalId',
		description: 'Rental ID to create contract from',
	})
	@ApiResponse({
		status: 201,
		description: 'Contract created successfully from rental',
	})
	@ApiResponse({
		status: 400,
		description: 'Rental already has contract or invalid status',
	})
	@ApiResponse({
		status: 403,
		description: 'Not authorized to create contract for this rental',
	})
	@ApiResponse({
		status: 404,
		description: 'Rental not found',
	})
	async createContractFromRental(
		@Param('rentalId') rentalId: string,
		@Body() additionalData: Record<string, any>,
		@Req() req: any,
	) {
		this.logger.log(`Creating contract from rental ${rentalId} by user ${req.user.id}`);
		return this.contractsNewService.createContractFromRental(rentalId, req.user.id, additionalData);
	}

	/**
	 * MVP API 3: Lấy danh sách hợp đồng của user
	 */
	@Get()
	@ApiOperation({
		summary: 'Get user contracts',
		description: 'Get all contracts where user is landlord or tenant',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Filter by contract status',
		enum: ContractStatus,
	})
	@ApiResponse({
		status: 200,
		description: 'Contracts retrieved successfully',
	})
	async getContracts(@Req() req: any, @Query('status') status?: ContractStatus) {
		this.logger.log(`Getting contracts for user ${req.user.id}`);
		return this.contractsNewService.getContracts(req.user.id, status);
	}

	/**
	 * MVP API 2: Lấy chi tiết hợp đồng
	 */
	@Get(':id')
	@ApiOperation({
		summary: 'Get contract details',
		description: 'Get detailed information about a specific contract',
	})
	@ApiParam({
		name: 'id',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Contract details retrieved successfully',
	})
	@ApiResponse({
		status: 403,
		description: 'Access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract not found',
	})
	async getContractById(@Param('id') id: string, @Req() req: any) {
		this.logger.log(`Getting contract ${id} by user ${req.user.id}`);
		return this.contractsNewService.getContractById(id, req.user.id);
	}

	/**
	 * Send OTP for signing
	 */
	@Post(':id/send-otp')
	@ApiOperation({
		summary: 'Send signing OTP',
		description: 'Send an OTP to the signer phone for contract signature verification',
	})
	@ApiParam({ name: 'id', description: 'Contract ID' })
	@ApiResponse({ status: 200, description: 'OTP sent successfully' })
	@ApiResponse({ status: 400, description: 'Missing phone or invalid request' })
	@ApiResponse({ status: 403, description: 'Access denied' })
	@ApiResponse({ status: 404, description: 'Contract not found' })
	async sendSigningOtp(@Param('id') id: string, @Req() req: any) {
		this.logger.log(`Send signing OTP for contract ${id} by user ${req.user.id}`);
		return this.contractsNewService.sendSigningOtp(id, req.user.id);
	}

	/**
	 * MVP API 4: Ký hợp đồng (cả landlord và tenant dùng chung)
	 */
	@Post(':id/sign')
	@ApiOperation({
		summary: 'Sign contract',
		description:
			'Sign the contract with digital signature. Both landlord and tenant use this endpoint.',
	})
	@ApiParam({
		name: 'id',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Contract signed successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Already signed or invalid OTP',
	})
	@ApiResponse({
		status: 403,
		description: 'Access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract not found',
	})
	async signContract(@Param('id') id: string, @Body() dto: SignContractDto, @Req() req: any) {
		this.logger.log(`User ${req.user.id} signing contract ${id}`);
		return this.contractsNewService.signContract(id, req.user.id, dto, req);
	}

	/**
	 * MVP API 5: Xem trạng thái hợp đồng và chữ ký
	 */
	@Get(':id/status')
	@ApiOperation({
		summary: 'Get contract status',
		description: 'Check contract signing status - who has signed and who has not',
	})
	@ApiParam({
		name: 'id',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Contract status retrieved successfully',
		type: ContractStatusResponseDto,
	})
	@ApiResponse({
		status: 403,
		description: 'Access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract not found',
	})
	async getContractStatus(
		@Param('id') id: string,
		@Req() req: any,
	): Promise<ContractStatusResponseDto> {
		this.logger.log(`Getting status for contract ${id}`);
		return this.contractsNewService.getContractStatus(id, req.user.id);
	}

	/**
	 * Generate PDF for a contract
	 */
	@Post(':contractId/pdf')
	@ApiOperation({
		summary: 'Generate contract PDF',
		description: 'Generate and store PDF document for a contract',
	})
	@ApiParam({
		name: 'contractId',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'PDF generated successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid request or access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract not found',
	})
	@ApiResponse({
		status: 500,
		description: 'Failed to generate PDF',
	})
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
	@ApiOperation({
		summary: 'Download contract PDF',
		description: 'Download the generated PDF document for a contract',
	})
	@ApiParam({
		name: 'contractId',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'PDF downloaded successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract or PDF not found',
	})
	@ApiResponse({
		status: 500,
		description: 'Failed to download PDF or integrity verification failed',
	})
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
	@ApiOperation({
		summary: 'Get contract preview',
		description: 'Get a PNG preview/thumbnail of the contract',
	})
	@ApiParam({
		name: 'contractId',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Preview generated successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract not found',
	})
	@ApiResponse({
		status: 500,
		description: 'Failed to generate preview',
	})
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

			// Generate preview with timeout safeguard
			const generate = this.pdfGenerationService.generateContractPreview(pdfContractData);
			// Allow more time in containerized/prod environments where Chromium cold-start is slower
			const previewBuffer = await Promise.race<Buffer>([
				generate,
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Preview generation timed out')), 50000),
				),
			]);

			// Set response headers
			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Content-Disposition', `inline; filename="preview-${contractId}.png"`);
			res.setHeader('Content-Length', previewBuffer.length);
			res.setHeader('Cache-Control', 'private, max-age=3600');

			// Send preview
			res.send(previewBuffer);
		} catch (error) {
			// Preserve known HTTP exceptions
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			if (error?.message === 'Preview generation timed out') {
				throw new HttpException('Preview generation timed out', HttpStatus.GATEWAY_TIMEOUT);
			}
			this.logger.error(
				`Failed to generate preview for contract ${contractId}: ${error?.message ?? 'Unknown error'}`,
				error?.stack ?? error,
			);
			throw new InternalServerErrorException('Failed to generate preview');
		}
	}

	/**
	 * Verify PDF integrity
	 */
	@Get(':contractId/pdf/verify')
	@ApiOperation({
		summary: 'Verify PDF integrity',
		description: 'Verify the integrity of stored PDF using hash verification',
	})
	@ApiParam({
		name: 'contractId',
		description: 'Contract ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Verification completed',
	})
	@ApiResponse({
		status: 400,
		description: 'Access denied',
	})
	@ApiResponse({
		status: 404,
		description: 'Contract or PDF not found',
	})
	@ApiResponse({
		status: 500,
		description: 'Failed to verify PDF',
	})
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
