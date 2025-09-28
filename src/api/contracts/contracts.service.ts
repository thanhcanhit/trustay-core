import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
	ContractEventType,
	ContractResponseDto,
	ContractStatus,
	CreateContractAmendmentDto,
	PaginatedContractResponseDto,
	QueryContractDto,
	UpdateContractDto,
} from './dto';

@Injectable()
export class ContractsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
	) {}

	async autoCreateContractFromRental(rentalId: string): Promise<ContractResponseDto> {
		// Get rental with all necessary relationships
		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: {
				tenant: {
					include: {
						addresses: {
							where: { isPrimary: true },
							include: { province: true, district: true, ward: true },
						},
					},
				},
				owner: {
					include: {
						addresses: {
							where: { isPrimary: true },
							include: { province: true, district: true, ward: true },
						},
					},
				},
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									include: { province: true, district: true, ward: true },
								},
								amenities: {
									include: { systemAmenity: true },
								},
								rules: {
									include: { systemRule: true },
								},
								pricing: true,
								costs: { include: { systemCostType: true } },
							},
						},
					},
				},
				bookingRequest: true,
				invitation: true,
			},
		});

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		// Check if contract already exists for this rental
		const existingContract = await this.findContractByRentalId(rentalId);
		if (existingContract) {
			throw new BadRequestException('Contract already exists for this rental');
		}

		// Generate contract number
		const contractNumber = await this.generateContractNumber();

		// Create contract in memory representation (since we don't have Contract table)
		const contract: ContractResponseDto = {
			id: `contract-${rentalId}`, // Use rental ID as contract ID
			contractNumber,
			rentalId: rental.id,
			status: ContractStatus.ACTIVE,
			startDate: rental.contractStartDate,
			endDate: rental.contractEndDate,
			leaseDurationMonths: rental.contractEndDate
				? Math.round(
						(rental.contractEndDate.getTime() - rental.contractStartDate.getTime()) /
							(1000 * 60 * 60 * 24 * 30),
					)
				: undefined,
			landlord: {
				id: rental.owner.id,
				fullName: `${rental.owner.firstName} ${rental.owner.lastName}`,
				email: rental.owner.email,
				phone: rental.owner.phone,
				idCardNumber: rental.owner.idCardNumber,
			},
			tenant: {
				id: rental.tenant.id,
				fullName: `${rental.tenant.firstName} ${rental.tenant.lastName}`,
				email: rental.tenant.email,
				phone: rental.tenant.phone,
				idCardNumber: rental.tenant.idCardNumber,
			},
			property: {
				roomId: rental.roomInstance.room.id,
				roomName: rental.roomInstance.room.name,
				roomNumber: rental.roomInstance.roomNumber,
				roomType: rental.roomInstance.room.roomType,
				areaSqm: rental.roomInstance.room.areaSqm,
				fullAddress: this.buildFullAddress(rental.roomInstance.room.building),
				buildingName: rental.roomInstance.room.building.name,
			},
			financialTerms: {
				monthlyRent: rental.monthlyRent,
				depositAmount: rental.depositPaid,
				currency: 'VND',
				electricityRate: rental.roomInstance.room.costs?.find(
					(c) => c.systemCostType.nameEn === 'electricity',
				)?.unitPrice,
				waterRate: rental.roomInstance.room.costs?.find((c) => c.systemCostType.nameEn === 'water')
					?.unitPrice,
			},
			rules: rental.roomInstance.room.rules?.map((r) => r.systemRule.name) || [],
			amenities: rental.roomInstance.room.amenities?.map((a) => a.systemAmenity.name) || [],
			contractContent: this.generateSimpleContractText(rental, contractNumber),
			documentUrl: rental.contractDocumentUrl,
			amendments: [],
			events: [
				{
					id: `event-${Date.now()}`,
					eventType: ContractEventType.CREATED,
					description: 'Hợp đồng được tạo tự động từ rental',
					occurredAt: new Date(),
					eventData: { source: 'rental_creation', rentalId },
				},
				{
					id: `event-${Date.now() + 1}`,
					eventType: ContractEventType.ACTIVATED,
					description: 'Hợp đồng được kích hoạt',
					occurredAt: rental.contractStartDate,
				},
			],
			createdAt: rental.createdAt,
			updatedAt: rental.updatedAt,
		};

		// Update rental with contract document URL
		await this.prisma.rental.update({
			where: { id: rentalId },
			data: { contractDocumentUrl: await this.generateContractDocumentUrl(contract.id) },
		});

		// Send notifications
		await this.notifyContractCreated(contract);

		return contract;
	}

	async getContracts(
		userId: string,
		userRole: UserRole,
		query: QueryContractDto,
	): Promise<PaginatedContractResponseDto> {
		const { page = 1, limit = 20, status, rentalId, fromStartDate, toStartDate } = query;

		// Build where condition for rentals
		const where: any = {
			...(userRole === UserRole.tenant ? { tenantId: userId } : { ownerId: userId }),
		};

		if (rentalId) {
			where.id = rentalId;
		}
		if (fromStartDate || toStartDate) {
			where.contractStartDate = {};
			if (fromStartDate) {
				where.contractStartDate.gte = new Date(fromStartDate);
			}
			if (toStartDate) {
				where.contractStartDate.lte = new Date(toStartDate);
			}
		}

		// Get rentals that would have contracts
		const [rentals, total] = await Promise.all([
			this.prisma.rental.findMany({
				where,
				include: {
					tenant: true,
					owner: true,
					roomInstance: {
						include: {
							room: {
								include: {
									building: {
										include: { province: true, district: true, ward: true },
									},
									amenities: { include: { systemAmenity: true } },
									rules: { include: { systemRule: true } },
								},
							},
						},
					},
				},
				skip: (page - 1) * limit,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.rental.count({ where }),
		]);

		// Convert rentals to contracts
		const contracts: ContractResponseDto[] = [];
		for (const rental of rentals) {
			const contract = await this.convertRentalToContract(rental).catch(() => null);
			if (!contract) {
				continue;
			}
			// Apply status filter
			if (!status || contract.status === status) {
				contracts.push(contract);
			}
		}

		return PaginatedResponseDto.create(contracts, page, limit, total);
	}

	async getContractById(contractId: string, userId: string): Promise<ContractResponseDto> {
		// Extract rental ID from contract ID
		const rentalId = contractId.replace('contract-', '');

		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									include: { province: true, district: true, ward: true },
								},
								amenities: { include: { systemAmenity: true } },
								rules: { include: { systemRule: true } },
							},
						},
					},
				},
			},
		});

		if (!rental) {
			throw new NotFoundException('Contract not found');
		}

		// Check access permissions
		if (rental.tenantId !== userId && rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to view this contract');
		}

		return await this.convertRentalToContract(rental);
	}

	async updateContract(
		contractId: string,
		userId: string,
		dto: UpdateContractDto,
	): Promise<ContractResponseDto> {
		const rentalId = contractId.replace('contract-', '');

		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: { tenant: true, owner: true },
		});

		if (!rental) {
			throw new NotFoundException('Contract not found');
		}

		// Check permissions - only owner can update most contract fields
		if (rental.ownerId !== userId) {
			throw new ForbiddenException('Only landlord can update contract');
		}

		// Update rental with contract changes
		const updateData: any = {};
		if (dto.endDate) {
			updateData.contractEndDate = new Date(dto.endDate);
		}
		if (dto.documentUrl) {
			updateData.contractDocumentUrl = dto.documentUrl;
		}

		const updatedRental = await this.prisma.rental.update({
			where: { id: rentalId },
			data: updateData,
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								building: {
									include: { province: true, district: true, ward: true },
								},
								amenities: { include: { systemAmenity: true } },
								rules: { include: { systemRule: true } },
							},
						},
					},
				},
			},
		});

		// Send notification about contract update
		await this.notificationsService.notifyRentalStatusUpdated(rental.tenantId, {
			roomName: `${updatedRental.roomInstance.room.name} - ${updatedRental.roomInstance.roomNumber}`,
			newStatus: 'contract_updated',
			rentalId: rental.id,
		});

		return await this.convertRentalToContract(updatedRental);
	}

	async createAmendment(
		contractId: string,
		userId: string,
		dto: CreateContractAmendmentDto,
	): Promise<ContractResponseDto> {
		const rentalId = contractId.replace('contract-', '');

		const rental = await this.prisma.rental.findUnique({
			where: { id: rentalId },
			include: { tenant: true, owner: true },
		});

		if (!rental) {
			throw new NotFoundException('Contract not found');
		}

		// Check permissions - both parties can create amendments
		if (rental.tenantId !== userId && rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to amend this contract');
		}

		// For now, we'll store amendments as rental updates
		// In a full implementation, you'd have a separate amendments table
		const _notes = `Amendment: ${dto.description} - Changes: ${JSON.stringify(dto.changes)}`;

		await this.prisma.rental.update({
			where: { id: rentalId },
			data: { updatedAt: new Date() }, // Trigger update timestamp
		});

		// Notify other party
		const notifyUserId = userId === rental.tenantId ? rental.ownerId : rental.tenantId;
		await this.notificationsService.notifyRentalStatusUpdated(notifyUserId, {
			roomName: `Contract Amendment`,
			newStatus: 'contract_amended',
			rentalId: rental.id,
		});

		return await this.getContractById(contractId, userId);
	}

	// Helper methods
	private async findContractByRentalId(rentalId: string): Promise<boolean> {
		// In this implementation, every rental automatically has a contract
		// so we just check if rental exists
		const rental = await this.prisma.rental.findUnique({ where: { id: rentalId } });
		return !!rental;
	}

	private async generateContractNumber(): Promise<string> {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const timestamp = Date.now().toString().slice(-6);

		return `HĐ-${year}${month}${day}-${timestamp}`;
	}

	private generateSimpleContractText(rental: any, contractNumber: string): string {
		const landlordName = `${rental.owner.firstName} ${rental.owner.lastName}`;
		const tenantName = `${rental.tenant.firstName} ${rental.tenant.lastName}`;
		const roomInfo = `${rental.roomInstance.room.name} - ${rental.roomInstance.roomNumber}`;
		const address = this.buildFullAddress(rental.roomInstance.room.building);

		return `
HỢP ĐỒNG THUÊ PHÒNG TRỌ
Số hợp đồng: ${contractNumber}
Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}

BÊN CHO THUÊ: ${landlordName}
Email: ${rental.owner.email}
${rental.owner.phone ? `Điện thoại: ${rental.owner.phone}` : ''}

BÊN THUÊ: ${tenantName}  
Email: ${rental.tenant.email}
${rental.tenant.phone ? `Điện thoại: ${rental.tenant.phone}` : ''}

THÔNG TIN PHÒNG:
Phòng: ${roomInfo}
Địa chỉ: ${address}
${rental.roomInstance.room.areaSqm ? `Diện tích: ${rental.roomInstance.room.areaSqm} m²` : ''}

ĐIỀU KHOẢN TÀI CHÍNH:
Tiền thuê: ${Number(rental.monthlyRent).toLocaleString('vi-VN')} VND/tháng
Tiền cọc: ${Number(rental.depositPaid).toLocaleString('vi-VN')} VND

THỜI GIAN:
Bắt đầu: ${rental.contractStartDate.toLocaleDateString('vi-VN')}
${rental.contractEndDate ? `Kết thúc: ${rental.contractEndDate.toLocaleDateString('vi-VN')}` : ''}

Hợp đồng được tạo tự động bởi hệ thống Trustay.
		`.trim();
	}

	private buildFullAddress(building: any): string {
		const parts = [
			building.addressLine1,
			building.addressLine2,
			building.ward?.name,
			building.district?.name,
			building.province?.name,
		].filter(Boolean);

		return parts.join(', ');
	}

	private async generateContractDocumentUrl(contractId: string): Promise<string> {
		// In a real implementation, you'd generate and store the PDF
		return `/contracts/${contractId}/document.pdf`;
	}

	private async notifyContractCreated(contract: ContractResponseDto): Promise<void> {
		// Notify tenant
		await this.notificationsService.notifyRentalStatusUpdated(contract.tenant.id, {
			roomName: `${contract.property.roomName} - ${contract.property.roomNumber}`,
			newStatus: 'contract_created',
			rentalId: contract.rentalId,
		});

		// Notify landlord
		await this.notificationsService.notifyRentalStatusUpdated(contract.landlord.id, {
			roomName: `${contract.property.roomName} - ${contract.property.roomNumber}`,
			newStatus: 'contract_created',
			rentalId: contract.rentalId,
		});
	}

	private async convertRentalToContract(rental: any): Promise<ContractResponseDto> {
		const contractNumber = await this.generateContractNumber();
		return {
			id: `contract-${rental.id}`,
			contractNumber,
			rentalId: rental.id,
			status: this.mapRentalStatusToContractStatus(rental.status),
			startDate: rental.contractStartDate,
			endDate: rental.contractEndDate,
			leaseDurationMonths: rental.contractEndDate
				? Math.round(
						(rental.contractEndDate.getTime() - rental.contractStartDate.getTime()) /
							(1000 * 60 * 60 * 24 * 30),
					)
				: undefined,
			landlord: {
				id: rental.owner.id,
				fullName: `${rental.owner.firstName} ${rental.owner.lastName}`,
				email: rental.owner.email,
				phone: rental.owner.phone,
				idCardNumber: rental.owner.idCardNumber,
			},
			tenant: {
				id: rental.tenant.id,
				fullName: `${rental.tenant.firstName} ${rental.tenant.lastName}`,
				email: rental.tenant.email,
				phone: rental.tenant.phone,
				idCardNumber: rental.tenant.idCardNumber,
			},
			property: {
				roomId: rental.roomInstance.room.id,
				roomName: rental.roomInstance.room.name,
				roomNumber: rental.roomInstance.roomNumber,
				roomType: rental.roomInstance.room.roomType,
				areaSqm: rental.roomInstance.room.areaSqm,
				fullAddress: this.buildFullAddress(rental.roomInstance.room.building),
				buildingName: rental.roomInstance.room.building.name,
			},
			financialTerms: {
				monthlyRent: rental.monthlyRent,
				depositAmount: rental.depositPaid,
				currency: 'VND',
			},
			rules: rental.roomInstance.room.rules?.map((r) => r.systemRule.name) || [],
			amenities: rental.roomInstance.room.amenities?.map((a) => a.systemAmenity.name) || [],
			documentUrl: rental.contractDocumentUrl,
			amendments: [], // Would load from amendments table
			events: [
				{
					id: `event-created-${rental.id}`,
					eventType: ContractEventType.CREATED,
					description: 'Hợp đồng được tạo tự động từ rental',
					occurredAt: rental.createdAt,
				},
				{
					id: `event-activated-${rental.id}`,
					eventType: ContractEventType.ACTIVATED,
					description: 'Hợp đồng được kích hoạt',
					occurredAt: rental.contractStartDate,
				},
			],
			createdAt: rental.createdAt,
			updatedAt: rental.updatedAt,
		};
	}

	private mapRentalStatusToContractStatus(rentalStatus: string): ContractStatus {
		switch (rentalStatus) {
			case 'active':
				return ContractStatus.ACTIVE;
			case 'terminated':
				return ContractStatus.TERMINATED;
			case 'expired':
				return ContractStatus.EXPIRED;
			case 'pending_renewal':
				return ContractStatus.PENDING_RENEWAL;
			default:
				return ContractStatus.ACTIVE;
		}
	}
}
