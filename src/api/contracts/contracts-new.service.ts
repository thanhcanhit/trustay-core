import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { ContractStatus, SignerRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';

@Injectable()
export class ContractsNewService {
	private readonly logger = new Logger(ContractsNewService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * MVP 1: Tạo hợp đồng mới
	 */
	async createContract(dto: CreateContractDto, userId: string) {
		// Verify quyền tạo hợp đồng (phải là landlord hoặc tenant trong hợp đồng)
		if (dto.landlordId !== userId && dto.tenantId !== userId) {
			throw new ForbiddenException('You are not authorized to create this contract');
		}

		// Verify roomInstance exists
		const roomInstance = await this.prisma.roomInstance.findUnique({
			where: { id: dto.roomInstanceId },
			include: { room: { include: { building: true } } },
		});

		if (!roomInstance) {
			throw new NotFoundException('Room instance not found');
		}

		// Nếu có rentalId, verify và validate
		if (dto.rentalId) {
			const rental = await this.prisma.rental.findUnique({
				where: { id: dto.rentalId },
				include: { contract: true },
			});

			if (!rental) {
				throw new NotFoundException('Rental not found');
			}

			// Check nếu rental đã có contract rồi
			if (rental.contract) {
				throw new BadRequestException(
					`Rental already has a contract (${rental.contract.contractCode})`,
				);
			}

			// Validate landlordId, tenantId, roomInstanceId phải khớp với Rental
			if (rental.tenantId !== dto.tenantId) {
				throw new BadRequestException('Tenant ID in contract does not match rental tenant');
			}

			if (rental.ownerId !== dto.landlordId) {
				throw new BadRequestException('Landlord ID in contract does not match rental owner');
			}

			if (rental.roomInstanceId !== dto.roomInstanceId) {
				throw new BadRequestException(
					'Room instance ID in contract does not match rental room instance',
				);
			}

			// Kiểm tra rental phải active
			if (rental.status !== 'active') {
				throw new BadRequestException(
					`Cannot create contract for rental with status: ${rental.status}`,
				);
			}
		}

		// Generate contract code
		const contractCode = await this.generateContractCode();

		// Create contract
		const contract = await this.prisma.contract.create({
			data: {
				contractCode,
				rentalId: dto.rentalId,
				landlordId: dto.landlordId,
				tenantId: dto.tenantId,
				roomInstanceId: dto.roomInstanceId,
				contractType: dto.contractType || 'monthly_rental',
				status: ContractStatus.draft,
				contractData: dto.contractData as any,
				startDate: new Date(dto.startDate),
				endDate: dto.endDate ? new Date(dto.endDate) : null,
				legalMetadata: {
					createdBy: userId,
					ipAddress: 'unknown',
					userAgent: 'unknown',
				},
			},
			include: {
				landlord: true,
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		// Create audit log
		await this.createAuditLog(contract.id, userId, 'created', {
			contractCode: contract.contractCode,
		});

		return this.formatContractResponse(contract);
	}

	/**
	 * Helper: Tạo Contract từ Rental (tự động điền thông tin từ rental)
	 */
	async createContractFromRental(
		rentalId: string,
		userId: string,
		additionalContractData?: Record<string, any>,
	) {
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: {
				contract: true,
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
			},
		});

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		// Check quyền (phải là landlord hoặc tenant)
		if (rental.ownerId !== userId && rental.tenantId !== userId) {
			throw new ForbiddenException('You are not authorized to create contract for this rental');
		}

		// Check nếu đã có contract rồi
		if (rental.contract) {
			throw new BadRequestException(
				`Rental already has a contract (${rental.contract.contractCode})`,
			);
		}

		// Check rental phải active
		if (rental.status !== 'active') {
			throw new BadRequestException(
				`Cannot create contract for rental with status: ${rental.status}`,
			);
		}

		// Tự động tạo contractData từ rental
		const contractData = {
			monthlyRent: rental.monthlyRent.toNumber(),
			depositAmount: rental.depositPaid.toNumber(),
			roomNumber: rental.roomInstance.roomNumber,
			roomName: rental.roomInstance.room.name,
			buildingName: rental.roomInstance.room.building.name,
			buildingAddress: rental.roomInstance.room.building.addressLine1,
			...additionalContractData, // Allow override/extend
		};

		// Tạo contract
		return this.createContract(
			{
				rentalId: rental.id,
				landlordId: rental.ownerId,
				tenantId: rental.tenantId,
				roomInstanceId: rental.roomInstanceId,
				contractType: 'monthly_rental',
				startDate: rental.contractStartDate.toISOString(),
				endDate: rental.contractEndDate?.toISOString(),
				contractData,
			},
			userId,
		);
	}

	/**
	 * MVP 2: Xem chi tiết hợp đồng
	 */
	async getContractById(contractId: string, userId: string) {
		const contract = await this.prisma.contract.findUnique({
			where: { id: contractId },
			include: {
				landlord: true,
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									include: {
										province: true,
										district: true,
										ward: true,
									},
								},
							},
						},
					},
				},
				signatures: true,
			},
		});

		if (!contract) {
			throw new NotFoundException('Contract not found');
		}

		// Check permissions
		if (contract.landlordId !== userId && contract.tenantId !== userId) {
			throw new ForbiddenException('Access denied');
		}

		return this.formatContractResponse(contract);
	}

	/**
	 * MVP 3: Danh sách hợp đồng của user
	 */
	async getContracts(userId: string, status?: ContractStatus) {
		const where: any = {
			OR: [{ landlordId: userId }, { tenantId: userId }],
		};

		if (status) {
			where.status = status;
		}

		const contracts = await this.prisma.contract.findMany({
			where,
			include: {
				landlord: true,
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				signatures: true,
			},
			orderBy: { createdAt: 'desc' },
		});

		return contracts.map((c) => this.formatContractResponse(c));
	}

	/**
	 * MVP 4: Ký hợp đồng
	 */
	async signContract(contractId: string, userId: string, dto: SignContractDto, req: any) {
		const contract = await this.prisma.contract.findUnique({
			where: { id: contractId },
			include: {
				signatures: true,
				landlord: true,
				tenant: true,
			},
		});

		if (!contract) {
			throw new NotFoundException('Contract not found');
		}

		// Check permissions
		if (contract.landlordId !== userId && contract.tenantId !== userId) {
			throw new ForbiddenException('Access denied');
		}

		// Determine signer role
		const signerRole: SignerRole =
			contract.landlordId === userId ? SignerRole.landlord : SignerRole.tenant;

		// Check if already signed
		const existingSignature = contract.signatures.find(
			(s) => s.signerId === userId && s.signerRole === signerRole,
		);

		if (existingSignature) {
			throw new BadRequestException('You have already signed this contract');
		}

		// TODO: Verify OTP (giả lập MVP - trong production cần verify thật)
		if (dto.otpCode !== '123456') {
			throw new BadRequestException('Invalid OTP code');
		}

		// Create signature hash
		const signatureHash = this.hashSignature(dto.signatureImage);

		// Save signature
		const signature = await this.prisma.contractSignature.create({
			data: {
				contractId: contract.id,
				signerId: userId,
				signerRole,
				signatureImage: dto.signatureImage,
				signatureHash,
				authenticationMethod: 'SMS_OTP',
				authenticationData: {
					otpVerified: true,
					otpCode: '******', // Không lưu OTP thật
					verifiedAt: new Date().toISOString(),
				},
				signatureMetadata: {
					ipAddress: req.ip || 'unknown',
					userAgent: req.get('user-agent') || 'unknown',
					timestamp: new Date().toISOString(),
				},
				signedAt: new Date(),
			},
		});

		// Update contract status
		const allSignatures = await this.prisma.contractSignature.findMany({
			where: { contractId: contract.id },
		});

		const hasLandlordSignature = allSignatures.some((s) => s.signerRole === SignerRole.landlord);
		const hasTenantSignature = allSignatures.some((s) => s.signerRole === SignerRole.tenant);

		let newStatus: ContractStatus = contract.status;
		if (hasLandlordSignature && hasTenantSignature) {
			newStatus = ContractStatus.fully_signed;
		} else if (hasLandlordSignature || hasTenantSignature) {
			newStatus = ContractStatus.partially_signed;
		}

		const updatedContract = await this.prisma.contract.update({
			where: { id: contract.id },
			data: {
				status: newStatus,
				signedAt: hasLandlordSignature && hasTenantSignature ? new Date() : null,
			},
			include: {
				landlord: true,
				tenant: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: true,
							},
						},
					},
				},
				signatures: true,
			},
		});

		// Create audit log
		await this.createAuditLog(contract.id, userId, 'signed', {
			signerRole,
			signatureId: signature.id,
			newStatus,
		});

		// Auto-generate PDF if fully signed
		if (newStatus === ContractStatus.fully_signed) {
			// TODO: Trigger PDF generation (có thể làm async)
			this.logger.log(`Contract ${contract.id} is fully signed - should generate PDF`);
		}

		return this.formatContractResponse(updatedContract);
	}

	/**
	 * MVP 5: Xem trạng thái hợp đồng
	 */
	async getContractStatus(contractId: string, userId: string) {
		const contract = await this.prisma.contract.findUnique({
			where: { id: contractId },
			include: {
				signatures: {
					include: {
						signer: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
					},
				},
				landlord: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
				tenant: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		if (!contract) {
			throw new NotFoundException('Contract not found');
		}

		// Check permissions
		if (contract.landlordId !== userId && contract.tenantId !== userId) {
			throw new ForbiddenException('Access denied');
		}

		const landlordSignature = contract.signatures.find((s) => s.signerRole === SignerRole.landlord);
		const tenantSignature = contract.signatures.find((s) => s.signerRole === SignerRole.tenant);

		return {
			contractId: contract.id,
			contractCode: contract.contractCode,
			status: contract.status,
			landlord: {
				id: contract.landlord.id,
				fullName: `${contract.landlord.firstName} ${contract.landlord.lastName}`,
				hasSigned: !!landlordSignature,
				signedAt: landlordSignature?.signedAt,
			},
			tenant: {
				id: contract.tenant.id,
				fullName: `${contract.tenant.firstName} ${contract.tenant.lastName}`,
				hasSigned: !!tenantSignature,
				signedAt: tenantSignature?.signedAt,
			},
			allSignatures: contract.signatures.map((s) => ({
				signerRole: s.signerRole,
				signerName: `${s.signer.firstName} ${s.signer.lastName}`,
				signedAt: s.signedAt,
			})),
			fullySignedAt: contract.signedAt,
			pdfUrl: contract.pdfUrl,
		};
	}

	// ============ Helper methods ============

	private async generateContractCode(): Promise<string> {
		const year = new Date().getFullYear();
		const count = await this.prisma.contract.count({
			where: {
				contractCode: {
					startsWith: `HD-${year}`,
				},
			},
		});

		const nextNumber = String(count + 1).padStart(6, '0');
		return `HD-${year}-${nextNumber}`;
	}

	private hashSignature(signatureImage: string): string {
		return crypto.createHash('sha256').update(signatureImage).digest('hex');
	}

	private async createAuditLog(
		contractId: string,
		userId: string,
		action: string,
		actionDetails: any,
	) {
		try {
			await this.prisma.contractAuditLog.create({
				data: {
					contractId,
					userId,
					action,
					actionDetails,
					ipAddress: 'unknown',
					userAgent: 'unknown',
				},
			});
		} catch (error) {
			this.logger.warn(`Failed to create audit log: ${error.message}`);
		}
	}

	private formatContractResponse(contract: any) {
		return {
			id: contract.id,
			contractCode: contract.contractCode,
			status: contract.status,
			contractType: contract.contractType,
			landlord: {
				id: contract.landlord.id,
				fullName: `${contract.landlord.firstName} ${contract.landlord.lastName}`,
				email: contract.landlord.email,
				phone: contract.landlord.phone,
			},
			tenant: {
				id: contract.tenant.id,
				fullName: `${contract.tenant.firstName} ${contract.tenant.lastName}`,
				email: contract.tenant.email,
				phone: contract.tenant.phone,
			},
			room: {
				roomNumber: contract.roomInstance.roomNumber,
				roomName: contract.roomInstance.room.name,
				buildingName: contract.roomInstance.room.building.name,
			},
			contractData: contract.contractData,
			startDate: contract.startDate,
			endDate: contract.endDate,
			signedAt: contract.signedAt,
			pdfUrl: contract.pdfUrl,
			signatures: contract.signatures?.map((s: any) => ({
				signerRole: s.signerRole,
				signedAt: s.signedAt,
			})),
			createdAt: contract.createdAt,
			updatedAt: contract.updatedAt,
		};
	}
}
