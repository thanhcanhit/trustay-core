import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { BillStatus, UserRole } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
	BillResponseDto,
	CreateBillDto,
	GenerateBillDto,
	MeterDataDto,
	PaginatedBillResponseDto,
	QueryBillDto,
	UpdateBillDto,
} from './dto';

@Injectable()
export class BillsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
	) {}

	async createBill(userId: string, dto: CreateBillDto): Promise<BillResponseDto> {
		// Verify rental exists and user has access
		const rental = await this.prisma.rental.findUnique({
			where: { id: dto.rentalId },
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: true,
					},
				},
			},
		});

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		// Check if user is owner of this rental
		if (rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to create bill for this rental');
		}

		// Check if room instance belongs to this rental
		if (rental.roomInstanceId !== dto.roomInstanceId) {
			throw new BadRequestException('Room instance does not belong to this rental');
		}

		// Check if bill already exists for this period
		const existingBill = await this.prisma.bill.findUnique({
			where: {
				rentalId_billingPeriod: {
					rentalId: dto.rentalId,
					billingPeriod: dto.billingPeriod,
				},
			},
		});

		if (existingBill) {
			throw new BadRequestException('Bill already exists for this period');
		}

		const bill = await this.prisma.bill.create({
			data: {
				rentalId: dto.rentalId,
				roomInstanceId: dto.roomInstanceId,
				billingPeriod: dto.billingPeriod,
				billingMonth: dto.billingMonth,
				billingYear: dto.billingYear,
				periodStart: new Date(dto.periodStart),
				periodEnd: new Date(dto.periodEnd),
				subtotal: dto.subtotal,
				discountAmount: dto.discountAmount || 0,
				taxAmount: dto.taxAmount || 0,
				totalAmount: dto.totalAmount,
				remainingAmount: dto.totalAmount,
				dueDate: new Date(dto.dueDate),
				notes: dto.notes,
			},
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: true,
							},
						},
					},
				},
				billItems: true,
			},
		});

		// Send notification to tenant
		await this.notificationsService.notifyBill(rental.tenantId, {
			month: bill.billingMonth,
			year: bill.billingYear,
			roomName: `${rental.roomInstance.room.name} - ${rental.roomInstance.roomNumber}`,
			amount: Number(bill.totalAmount),
			billId: bill.id,
			dueDate: bill.dueDate,
			landlordName: `${rental.owner.firstName} ${rental.owner.lastName}`,
		});

		return this.transformToResponseDto(bill);
	}

	async generateBill(userId: string, dto: GenerateBillDto): Promise<BillResponseDto> {
		// Verify rental exists and user has access
		const rental = await this.prisma.rental.findUnique({
			where: { id: dto.rentalId },
			include: {
				tenant: true,
				owner: true,
				roomInstance: {
					include: {
						room: {
							include: {
								costs: {
									include: {
										costTypeTemplate: true,
									},
								},
								pricing: true,
							},
						},
					},
				},
			},
		});

		if (!rental) {
			throw new NotFoundException('Rental not found');
		}

		// Check if user is owner of this rental
		if (rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to generate bill for this rental');
		}

		// Check if room instance belongs to this rental
		if (rental.roomInstanceId !== dto.roomInstanceId) {
			throw new BadRequestException('Room instance does not belong to this rental');
		}

		// Check if bill already exists for this period
		const existingBill = await this.prisma.bill.findUnique({
			where: {
				rentalId_billingPeriod: {
					rentalId: dto.rentalId,
					billingPeriod: dto.billingPeriod,
				},
			},
		});

		if (existingBill) {
			throw new BadRequestException('Bill already exists for this period');
		}

		// Calculate rental period within billing period
		const periodStart = new Date(dto.periodStart);
		const periodEnd = new Date(dto.periodEnd);
		const rentalStart = dto.rentalStartDate
			? new Date(dto.rentalStartDate)
			: rental.contractStartDate;
		const rentalEnd = dto.rentalEndDate ? new Date(dto.rentalEndDate) : rental.contractEndDate;

		// Calculate effective rental period within billing period
		const effectiveRentalStart = rentalStart > periodStart ? rentalStart : periodStart;
		const effectiveRentalEnd = rentalEnd && rentalEnd < periodEnd ? rentalEnd : periodEnd;

		// Calculate proration factor (percentage of month)
		const totalDaysInPeriod =
			Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const rentalDaysInPeriod =
			Math.ceil(
				(effectiveRentalEnd.getTime() - effectiveRentalStart.getTime()) / (1000 * 60 * 60 * 24),
			) + 1;
		const prorationFactor = rentalDaysInPeriod / totalDaysInPeriod;

		// Check if there are metered costs that need manual input
		const meteredCosts = rental.roomInstance.room.costs.filter(
			(cost) =>
				cost.isActive &&
				cost.costType === 'metered' &&
				(cost.meterReading === null || cost.lastMeterReading === null),
		);

		// Calculate bill items based on room costs
		const billItems = await this.calculateBillItems(
			rental.roomInstance.room.costs,
			dto.occupancyCount || 1,
			prorationFactor,
			rental.roomInstance.room.pricing,
		);

		// Calculate totals
		const subtotal = billItems.reduce((sum, item) => sum + Number(item.amount), 0);
		const totalAmount = subtotal; // No discount or tax for now

		const bill = await this.prisma.bill.create({
			data: {
				rentalId: dto.rentalId,
				roomInstanceId: dto.roomInstanceId,
				billingPeriod: dto.billingPeriod,
				billingMonth: dto.billingMonth,
				billingYear: dto.billingYear,
				periodStart,
				periodEnd,
				rentalStartDate: effectiveRentalStart,
				rentalEndDate: effectiveRentalEnd,
				occupancyCount: dto.occupancyCount || 1,
				subtotal,
				discountAmount: 0,
				taxAmount: 0,
				totalAmount,
				remainingAmount: totalAmount,
				dueDate: periodEnd, // Due date is end of period
				notes: dto.notes,
				isAutoGenerated: true,
				requiresMeterData: meteredCosts.length > 0,
				billItems: {
					create: billItems,
				},
			},
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: true,
							},
						},
					},
				},
				billItems: true,
			},
		});

		// Send notification to tenant
		await this.notificationsService.notifyBill(rental.tenantId, {
			month: bill.billingMonth,
			year: bill.billingYear,
			roomName: `${rental.roomInstance.room.name} - ${rental.roomInstance.roomNumber}`,
			amount: Number(bill.totalAmount),
			billId: bill.id,
			dueDate: bill.dueDate,
			landlordName: `${rental.owner.firstName} ${rental.owner.lastName}`,
		});

		return this.transformToResponseDto(bill);
	}

	private async calculateBillItems(
		roomCosts: any[],
		occupancyCount: number,
		prorationFactor: number = 1,
		roomPricing?: any,
	): Promise<any[]> {
		const billItems = [];

		// Add rent as first item (prorated)
		if (roomPricing) {
			const rentAmount = Number(roomPricing.basePriceMonthly) * prorationFactor;
			if (rentAmount > 0) {
				billItems.push({
					itemType: 'rent',
					itemName: 'Tiền thuê phòng',
					description: `Tiền thuê phòng (${Math.round(prorationFactor * 100)}% tháng)`,
					quantity: 1,
					unitPrice: rentAmount,
					amount: rentAmount,
					currency: roomPricing.currency || 'VND',
					notes: `Prorated for ${Math.round(prorationFactor * 100)}% of billing period`,
				});
			}
		}

		// Process room costs
		for (const cost of roomCosts) {
			if (!cost.isActive) continue;

			let amount = 0;
			let quantity = 1;
			let itemName = cost.costTypeTemplate.name;
			let description = cost.notes;

			switch (cost.costType) {
				case 'fixed':
					// Fixed costs are prorated
					amount = Number(cost.fixedAmount || 0) * prorationFactor;
					description = `${cost.notes || ''} (${Math.round(prorationFactor * 100)}% tháng)`.trim();
					break;

				case 'per_person':
					// Per person costs are prorated and multiplied by occupancy
					amount = Number(cost.perPersonAmount || 0) * occupancyCount * prorationFactor;
					quantity = occupancyCount;
					itemName += ` (${occupancyCount} người)`;
					description = `${cost.notes || ''} (${Math.round(prorationFactor * 100)}% tháng)`.trim();
					break;

				case 'metered':
					// Metered costs need meter readings
					if (cost.meterReading !== null && cost.lastMeterReading !== null) {
						const currentReading = Number(cost.meterReading);
						const lastReading = Number(cost.lastMeterReading);
						const usage = Math.max(0, currentReading - lastReading);
						amount = usage * Number(cost.unitPrice || 0);
						quantity = usage;
						itemName += ` (${usage} ${cost.unit || 'đơn vị'})`;
						description = `${cost.notes || ''} - Sử dụng: ${usage} ${cost.unit || 'đơn vị'}`.trim();
					} else {
						// Skip metered costs without readings
						continue;
					}
					break;
			}

			if (amount > 0) {
				billItems.push({
					itemType: cost.costTypeTemplate.category,
					itemName,
					description,
					quantity,
					unitPrice: cost.costType === 'metered' ? cost.unitPrice : amount / quantity,
					amount,
					currency: cost.currency,
					notes: cost.notes,
				});
			}
		}

		return billItems;
	}

	async getBills(
		userId: string,
		userRole: UserRole,
		query: QueryBillDto,
	): Promise<PaginatedBillResponseDto> {
		const {
			page = 1,
			limit = 20,
			rentalId,
			roomInstanceId,
			status,
			fromDate,
			toDate,
			billingPeriod,
		} = query;
		const skip = (page - 1) * limit;

		// Base where condition - user can only see bills for their own rentals
		const baseWhere: any = {
			rental: userRole === UserRole.tenant ? { tenantId: userId } : { ownerId: userId },
		};

		// Add optional filters
		if (rentalId) {
			baseWhere.rentalId = rentalId;
		}
		if (roomInstanceId) {
			baseWhere.roomInstanceId = roomInstanceId;
		}
		if (status) {
			baseWhere.status = status;
		}
		if (billingPeriod) {
			baseWhere.billingPeriod = billingPeriod;
		}

		if (fromDate || toDate) {
			baseWhere.createdAt = {};
			if (fromDate) {
				baseWhere.createdAt.gte = new Date(fromDate);
			}
			if (toDate) {
				baseWhere.createdAt.lte = new Date(toDate);
			}
		}

		const [bills, total] = await Promise.all([
			this.prisma.bill.findMany({
				where: baseWhere,
				include: {
					rental: {
						include: {
							roomInstance: {
								include: {
									room: true,
								},
							},
						},
					},
					billItems: true,
				},
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.bill.count({ where: baseWhere }),
		]);

		const billDtos = bills.map((bill) => this.transformToResponseDto(bill));
		return PaginatedResponseDto.create(billDtos, page, limit, total);
	}

	async getBillById(billId: string, userId: string, userRole: UserRole): Promise<BillResponseDto> {
		const bill = await this.prisma.bill.findUnique({
			where: { id: billId },
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: true,
							},
						},
					},
				},
				billItems: true,
			},
		});

		if (!bill) {
			throw new NotFoundException('Bill not found');
		}

		// Check if user has access to this bill
		if (bill.rental.tenantId !== userId && bill.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to view this bill');
		}

		return this.transformToResponseDto(bill);
	}

	async updateBill(billId: string, userId: string, dto: UpdateBillDto): Promise<BillResponseDto> {
		const existingBill = await this.prisma.bill.findUnique({
			where: { id: billId },
			include: { rental: true },
		});

		if (!existingBill) {
			throw new NotFoundException('Bill not found');
		}

		// Check if user has access to update this bill
		if (existingBill.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to update this bill');
		}

		// Don't allow updating paid bills
		if (existingBill.status === BillStatus.paid) {
			throw new BadRequestException('Cannot update paid bills');
		}

		const updatedBill = await this.prisma.bill.update({
			where: { id: billId },
			data: {
				...(dto.status && { status: dto.status }),
				...(dto.discountAmount !== undefined && { discountAmount: dto.discountAmount }),
				...(dto.taxAmount !== undefined && { taxAmount: dto.taxAmount }),
				...(dto.totalAmount !== undefined && {
					totalAmount: dto.totalAmount,
					remainingAmount: dto.totalAmount - Number(existingBill.paidAmount),
				}),
				...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
				...(dto.notes !== undefined && { notes: dto.notes }),
			},
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: true,
							},
						},
					},
				},
				billItems: true,
			},
		});

		return this.transformToResponseDto(updatedBill);
	}

	async deleteBill(billId: string, userId: string): Promise<void> {
		const bill = await this.prisma.bill.findUnique({
			where: { id: billId },
			include: { rental: true },
		});

		if (!bill) {
			throw new NotFoundException('Bill not found');
		}

		// Check if user has access to delete this bill
		if (bill.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to delete this bill');
		}

		// Don't allow deletion of paid bills
		if (bill.status === BillStatus.paid) {
			throw new BadRequestException('Cannot delete paid bills');
		}

		await this.prisma.bill.delete({
			where: { id: billId },
		});
	}

	async updateMeterData(
		billId: string,
		userId: string,
		meterData: MeterDataDto[],
	): Promise<BillResponseDto> {
		const bill = await this.prisma.bill.findUnique({
			where: { id: billId },
			include: {
				rental: true,
				roomInstance: {
					include: {
						room: {
							include: {
								costs: {
									include: {
										costTypeTemplate: true,
									},
								},
								pricing: true,
							},
						},
					},
				},
			},
		});

		if (!bill) {
			throw new NotFoundException('Bill not found');
		}

		// Check if user has access to update meter data
		if (bill.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to update meter data for this bill');
		}

		// Update meter readings in room costs
		for (const meter of meterData) {
			await this.prisma.roomCost.update({
				where: { id: meter.roomCostId },
				data: {
					meterReading: meter.currentReading,
					lastMeterReading: meter.lastReading,
				},
			});
		}

		// Recalculate bill items with updated meter data
		const updatedRoomCosts = await this.prisma.roomCost.findMany({
			where: {
				roomId: bill.roomInstance.room.id,
				isActive: true,
			},
			include: {
				costTypeTemplate: true,
			},
		});

		// Calculate proration factor
		const periodStart = bill.periodStart;
		const periodEnd = bill.periodEnd;
		const rentalStart = bill.rentalStartDate || bill.rental.contractStartDate;
		const rentalEnd = bill.rentalEndDate || bill.rental.contractEndDate;

		const effectiveRentalStart = rentalStart > periodStart ? rentalStart : periodStart;
		const effectiveRentalEnd = rentalEnd && rentalEnd < periodEnd ? rentalEnd : periodEnd;

		const totalDaysInPeriod =
			Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const rentalDaysInPeriod =
			Math.ceil(
				(effectiveRentalEnd.getTime() - effectiveRentalStart.getTime()) / (1000 * 60 * 60 * 24),
			) + 1;
		const prorationFactor = rentalDaysInPeriod / totalDaysInPeriod;

		// Recalculate bill items
		const newBillItems = await this.calculateBillItems(
			updatedRoomCosts,
			bill.occupancyCount || 1,
			prorationFactor,
			bill.roomInstance.room.pricing,
		);

		// Delete old bill items and create new ones
		await this.prisma.billItem.deleteMany({
			where: { billId: billId },
		});

		const subtotal = newBillItems.reduce((sum, item) => sum + Number(item.amount), 0);

		const updatedBill = await this.prisma.bill.update({
			where: { id: billId },
			data: {
				subtotal,
				totalAmount: subtotal,
				remainingAmount: subtotal - Number(bill.paidAmount),
				requiresMeterData: false,
				billItems: {
					create: newBillItems,
				},
			},
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: true,
							},
						},
					},
				},
				billItems: true,
			},
		});

		return this.transformToResponseDto(updatedBill);
	}

	async markBillAsPaid(billId: string, userId: string): Promise<BillResponseDto> {
		const bill = await this.prisma.bill.findUnique({
			where: { id: billId },
			include: { rental: true },
		});

		if (!bill) {
			throw new NotFoundException('Bill not found');
		}

		// Check if user has access to mark this bill as paid
		if (bill.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to mark this bill as paid');
		}

		const updatedBill = await this.prisma.bill.update({
			where: { id: billId },
			data: {
				status: BillStatus.paid,
				paidAmount: bill.totalAmount,
				remainingAmount: 0,
				paidDate: new Date(),
			},
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: true,
							},
						},
					},
				},
				billItems: true,
			},
		});

		return this.transformToResponseDto(updatedBill);
	}

	private transformToResponseDto(bill: any): BillResponseDto {
		return {
			id: bill.id,
			rentalId: bill.rentalId,
			roomInstanceId: bill.roomInstanceId,
			billingPeriod: bill.billingPeriod,
			billingMonth: bill.billingMonth,
			billingYear: bill.billingYear,
			periodStart: bill.periodStart,
			periodEnd: bill.periodEnd,
			subtotal: bill.subtotal,
			discountAmount: bill.discountAmount,
			taxAmount: bill.taxAmount,
			totalAmount: bill.totalAmount,
			paidAmount: bill.paidAmount,
			remainingAmount: bill.remainingAmount,
			status: bill.status,
			dueDate: bill.dueDate,
			paidDate: bill.paidDate,
			notes: bill.notes,
			createdAt: bill.createdAt,
			updatedAt: bill.updatedAt,
			billItems: bill.billItems?.map((item: any) => ({
				id: item.id,
				itemType: item.itemType,
				itemName: item.itemName,
				description: item.description,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				amount: item.amount,
				currency: item.currency,
				notes: item.notes,
				createdAt: item.createdAt,
			})),
			rental: bill.rental
				? {
						id: bill.rental.id,
						monthlyRent: bill.rental.monthlyRent,
						roomInstance: {
							roomNumber: bill.rental.roomInstance.roomNumber,
							room: {
								name: bill.rental.roomInstance.room.name,
							},
						},
					}
				: undefined,
		};
	}
}
