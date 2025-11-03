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
import { RentalsService } from '../rentals/rentals.service';
import {
	BillResponseDto,
	CreateBillDto,
	CreateBillForRoomDto,
	MeterDataDto,
	PaginatedBillResponseDto,
	PreviewBuildingBillDto,
	QueryBillDto,
	QueryBillsForLandlordDto,
	UpdateBillDto,
	UpdateBillWithMeterDataDto,
} from './dto';

@Injectable()
export class BillsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
		private readonly rentalsService: RentalsService,
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

		return await this.transformToResponseDto(bill);
	}

	async createBillForRoom(userId: string, dto: CreateBillForRoomDto): Promise<BillResponseDto> {
		// First, get room instance to find the rental
		const roomInstance = await this.prisma.roomInstance.findUnique({
			where: { id: dto.roomInstanceId },
			include: {
				rentals: {
					where: {
						status: 'active', // Only active rentals
					},
					include: {
						tenant: true,
						owner: true,
					},
				},
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
		});

		if (!roomInstance) {
			throw new NotFoundException('Room instance not found');
		}

		if (!roomInstance.rentals || roomInstance.rentals.length === 0) {
			throw new BadRequestException('Room instance is not associated with any active rental');
		}

		// Get the first active rental (should be only one)
		const rental = roomInstance.rentals[0];

		// Check if user is owner of this rental
		if (rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to create bill for this rental');
		}

		// Check if bill already exists for this period
		const existingBill = await this.prisma.bill.findUnique({
			where: {
				rentalId_billingPeriod: {
					rentalId: rental.id,
					billingPeriod: dto.billingPeriod,
				},
			},
		});

		if (existingBill) {
			throw new BadRequestException('Bill already exists for this period');
		}

		// Update meter readings for metered costs (lưu theo room instance)
		for (const meterReading of dto.meterReadings) {
			await (this.prisma as any).roomInstanceMeterReading.upsert({
				where: {
					roomInstanceId_roomCostId: {
						roomInstanceId: roomInstance.id,
						roomCostId: meterReading.roomCostId,
					},
				},
				update: {
					meterReading: meterReading.currentReading,
					lastMeterReading: meterReading.lastReading,
				},
				create: {
					roomInstanceId: roomInstance.id,
					roomCostId: meterReading.roomCostId,
					meterReading: meterReading.currentReading,
					lastMeterReading: meterReading.lastReading,
				},
			});
		}

		// Get updated room costs
		const updatedRoomCosts = await this.prisma.roomCost.findMany({
			where: {
				roomId: roomInstance.room.id,
				isActive: true,
			},
			include: {
				costTypeTemplate: true,
			},
		});

		// Get meter readings for this room instance
		const meterReadings = await (this.prisma as any).roomInstanceMeterReading.findMany({
			where: {
				roomInstanceId: roomInstance.id,
			},
		});

		// Map readings to costs
		const meterReadingsMap = new Map(meterReadings.map((mr) => [mr.roomCostId, mr]));

		// Merge readings into costs: ưu tiên RoomInstanceMeterReading, fallback về RoomCost
		const costsWithReadings = updatedRoomCosts.map((cost) => {
			const instanceReading = meterReadingsMap.get(cost.id) as any;
			return {
				...cost,
				meterReading: instanceReading?.meterReading ?? cost.meterReading,
				lastMeterReading: instanceReading?.lastMeterReading ?? cost.lastMeterReading,
			};
		});

		// Calculate proration factor
		const periodStart = new Date(dto.periodStart);
		const periodEnd = new Date(dto.periodEnd);
		const rentalStart = rental.contractStartDate;
		const rentalEnd = rental.contractEndDate;

		const effectiveRentalStart = rentalStart > periodStart ? rentalStart : periodStart;
		const effectiveRentalEnd = rentalEnd && rentalEnd < periodEnd ? rentalEnd : periodEnd;

		const totalDaysInPeriod =
			Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const rentalDaysInPeriod =
			Math.ceil(
				(effectiveRentalEnd.getTime() - effectiveRentalStart.getTime()) / (1000 * 60 * 60 * 24),
			) + 1;
		const prorationFactor = rentalDaysInPeriod / totalDaysInPeriod;

		// Get occupancy count: query from rental
		const occupancyCount = await this.rentalsService.getOccupancyCountByRoomInstance(
			roomInstance.id,
		);

		// Calculate bill items
		const billItems = await this.calculateBillItems(
			costsWithReadings,
			occupancyCount,
			prorationFactor,
			roomInstance.room.pricing,
		);

		// Calculate totals
		const subtotal = billItems.reduce((sum, item) => sum + Number(item.amount), 0);
		const totalAmount = subtotal;

		const bill = await this.prisma.bill.create({
			data: {
				rentalId: rental.id, // Auto-get from roomInstance
				roomInstanceId: dto.roomInstanceId,
				billingPeriod: dto.billingPeriod,
				billingMonth: dto.billingMonth,
				billingYear: dto.billingYear,
				periodStart,
				periodEnd,
				rentalStartDate: effectiveRentalStart,
				rentalEndDate: effectiveRentalEnd,
				occupancyCount: dto.occupancyCount,
				subtotal,
				discountAmount: 0,
				taxAmount: 0,
				totalAmount,
				remainingAmount: totalAmount,
				dueDate: periodEnd,
				notes: dto.notes,
				isAutoGenerated: false,
				requiresMeterData: false,
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
			roomName: `${roomInstance.room.name} - ${roomInstance.roomNumber}`,
			amount: Number(bill.totalAmount),
			billId: bill.id,
			dueDate: bill.dueDate,
			landlordName: `${rental.owner.firstName} ${rental.owner.lastName}`,
		});

		return await this.transformToResponseDto(bill);
	}

	/**
	 * Check if rental is active and overlaps with billing period
	 */
	private isRentalActiveForPeriod(
		rental: { status: string; contractStartDate: Date; contractEndDate: Date | null },
		periodStart: Date,
		periodEnd: Date,
	): boolean {
		if (rental.status !== 'active') {
			return false;
		}

		// Rental must have started before or on period end
		const rentalStarted = rental.contractStartDate <= periodEnd;

		// Rental must not have ended before period start (or have no end date)
		const rentalNotEnded = !rental.contractEndDate || rental.contractEndDate >= periodStart;

		return rentalStarted && rentalNotEnded;
	}

	async generateMonthlyBillsForBuilding(
		userId: string,
		dto: PreviewBuildingBillDto,
	): Promise<{ message: string; billsCreated: number; billsExisted: number }> {
		// Verify building exists and user has access
		const building = await this.prisma.building.findUnique({
			where: { id: dto.buildingId },
			include: {
				owner: true,
			},
		});

		if (!building) {
			throw new NotFoundException('Building not found');
		}

		// Check if user is owner of this building
		if (building.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to preview bills for this building');
		}

		// Calculate default period: start of previous month to current date
		const now = new Date();
		const periodEnd = dto.periodEnd
			? new Date(dto.periodEnd)
			: new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let periodStart: Date;
		if (dto.periodStart) {
			periodStart = new Date(dto.periodStart);
		} else {
			// Start of previous month
			const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			periodStart = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1);
		}

		// Calculate billing period if not provided
		let billingPeriod: string;
		let billingMonth: number;
		let billingYear: number;

		if (dto.billingPeriod) {
			billingPeriod = dto.billingPeriod;
			const [year, month] = dto.billingPeriod.split('-').map(Number);
			billingYear = dto.billingYear || year;
			billingMonth = dto.billingMonth || month;
		} else {
			// Use previous month for billing period
			const previousMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
			billingYear = previousMonth.getFullYear();
			billingMonth = previousMonth.getMonth() + 1;
			billingPeriod = `${billingYear}-${String(billingMonth).padStart(2, '0')}`;
		}

		// Get all active room instances in this building with their rentals
		// We'll filter for active rentals in the period after fetching
		const roomInstances = await this.prisma.roomInstance.findMany({
			where: {
				room: {
					buildingId: dto.buildingId,
				},
				isActive: true,
			},
			include: {
				rentals: {
					where: {
						status: 'active',
					},
					include: {
						tenant: true,
						owner: true,
					},
				},
				room: {
					include: {
						costs: {
							where: {
								isActive: true,
							},
							include: {
								costTypeTemplate: true,
							},
						},
						pricing: true,
					},
				},
			},
		});

		// Filter only room instances with active rentals that overlap with billing period
		const activeRoomInstances = roomInstances.filter((ri) => {
			if (!ri.rentals || ri.rentals.length === 0) {
				return false;
			}

			// Check if any rental is active and overlaps with period
			return ri.rentals.some((rental) =>
				this.isRentalActiveForPeriod(rental, periodStart, periodEnd),
			);
		});

		if (activeRoomInstances.length === 0) {
			return {
				message: 'No active rentals found for this billing period',
				billsCreated: 0,
				billsExisted: 0,
			};
		}

		// Create or get bills for each room instance
		let billsCreated = 0;
		let billsExisted = 0;

		for (const roomInstance of activeRoomInstances) {
			// Get active rental that overlaps with period
			const activeRental = roomInstance.rentals.find((rental) =>
				this.isRentalActiveForPeriod(rental, periodStart, periodEnd),
			);

			if (!activeRental) {
				continue;
			}

			// Check if bill already exists for this period (ensure only 1 bill per period)
			const existingBill = await this.prisma.bill.findUnique({
				where: {
					rentalId_billingPeriod: {
						rentalId: activeRental.id,
						billingPeriod: billingPeriod,
					},
				},
			});

			if (existingBill) {
				// Bill already exists, skip
				billsExisted++;
				continue;
			}

			// Calculate proration factor
			const rentalStart = activeRental.contractStartDate;
			const rentalEnd = activeRental.contractEndDate;

			const effectiveRentalStart = rentalStart > periodStart ? rentalStart : periodStart;
			const effectiveRentalEnd = rentalEnd && rentalEnd < periodEnd ? rentalEnd : periodEnd;

			const totalDaysInPeriod =
				Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
			const rentalDaysInPeriod =
				Math.ceil(
					(effectiveRentalEnd.getTime() - effectiveRentalStart.getTime()) / (1000 * 60 * 60 * 24),
				) + 1;
			const prorationFactor = rentalDaysInPeriod / totalDaysInPeriod;

			// Get meter readings for this room instance
			const meterReadings = await (this.prisma as any).roomInstanceMeterReading.findMany({
				where: {
					roomInstanceId: roomInstance.id,
				},
			});

			const meterReadingsMap = new Map(meterReadings.map((mr) => [mr.roomCostId, mr]));

			// Merge readings into costs: ưu tiên RoomInstanceMeterReading, fallback về RoomCost
			const costsWithReadings = roomInstance.room.costs.map((cost) => {
				const instanceReading = meterReadingsMap.get(cost.id) as any;
				return {
					...cost,
					meterReading: instanceReading?.meterReading ?? cost.meterReading,
					lastMeterReading: instanceReading?.lastMeterReading ?? cost.lastMeterReading,
				};
			});

			// Get room costs (only fixed and per_person, skip metered without readings)
			const roomCostsForCalculation = costsWithReadings.filter(
				(cost) =>
					cost.costType !== 'metered' ||
					(cost.meterReading !== null && cost.lastMeterReading !== null),
			);

			// Calculate bill items (default occupancy = 1)
			const billItems = await this.calculateBillItems(
				roomCostsForCalculation,
				1, // Default occupancy
				prorationFactor,
				roomInstance.room.pricing,
			);

			// Calculate totals
			const subtotal = billItems.reduce((sum, item) => sum + Number(item.amount), 0);
			const totalAmount = subtotal;

			// Check if metered costs exist
			const hasMeteredCosts = costsWithReadings.some((cost) => cost.costType === 'metered');

			// Check if metered costs exist without readings
			const hasMeteredCostsWithoutReadings = costsWithReadings.some(
				(cost) =>
					cost.costType === 'metered' &&
					(cost.meterReading === null || cost.lastMeterReading === null),
			);

			// Status logic:
			// - Nếu không có metered costs hoặc đã có đủ readings: status = pending (hoàn tất)
			// - Nếu có metered costs nhưng chưa có readings: status = draft (cần nhập data)
			const billStatus =
				hasMeteredCosts && hasMeteredCostsWithoutReadings ? BillStatus.draft : BillStatus.pending;

			// Create bill (ensure only 1 bill per period)
			const createdBill = await this.prisma.bill.create({
				data: {
					rentalId: activeRental.id,
					roomInstanceId: roomInstance.id,
					billingPeriod: billingPeriod,
					billingMonth: billingMonth,
					billingYear: billingYear,
					periodStart,
					periodEnd,
					rentalStartDate: effectiveRentalStart,
					rentalEndDate: effectiveRentalEnd,
					occupancyCount: 1, // Default, should be updated later
					subtotal,
					discountAmount: 0,
					taxAmount: 0,
					totalAmount,
					remainingAmount: totalAmount,
					dueDate: periodEnd,
					status: billStatus,
					notes: `Auto-generated bill for ${billingPeriod}`,
					isAutoGenerated: true,
					requiresMeterData: hasMeteredCostsWithoutReadings,
					billItems: {
						create: billItems,
					},
				},
				include: {
					rental: {
						include: {
							tenant: true,
							roomInstance: {
								include: {
									room: true,
								},
							},
						},
					},
				},
			});

			// Notify tenant if bill status is pending (no metered costs or all metered costs have readings)
			if (billStatus === BillStatus.pending) {
				try {
					await this.notificationsService.notifyBill(activeRental.tenantId, {
						month: billingMonth,
						year: billingYear,
						roomName: roomInstance.room.name,
						amount: Number(totalAmount),
						billId: createdBill.id,
						dueDate: periodEnd,
						landlordName:
							`${building.owner.firstName} ${building.owner.lastName}`.trim() || 'Chủ nhà',
					});
				} catch (error) {
					// Log error but don't fail the bill creation
					// eslint-disable-next-line no-console
					console.error('Failed to send bill notification:', error);
				}
			}

			billsCreated++;
		}

		return {
			message: `Successfully created ${billsCreated} bill(s) and found ${billsExisted} existing bill(s) for billing period ${billingPeriod}`,
			billsCreated,
			billsExisted,
		};
	}

	async getBillsForTenant(userId: string, query: QueryBillDto): Promise<PaginatedBillResponseDto> {
		// Tenant can only see their own bills
		return this.getBills(userId, UserRole.tenant, query);
	}

	async getBillsForLandlordByMonth(
		userId: string,
		query: QueryBillsForLandlordDto,
	): Promise<PaginatedBillResponseDto> {
		const {
			page = 1,
			limit = 20,
			buildingId,
			roomInstanceId,
			billingPeriod,
			billingMonth,
			billingYear,
			status,
			search,
			sortBy = 'roomName',
			sortOrder = 'asc',
		} = query;
		const skip = (page - 1) * limit;

		// Base where condition - landlord can only see bills for their own rentals
		const baseWhere: any = {
			rental: {
				ownerId: userId,
			},
		};

		// Add roomInstanceId filter if provided (highest priority - specific room)
		if (roomInstanceId) {
			baseWhere.roomInstanceId = roomInstanceId;
		}

		// Add building filter if provided (and no roomInstanceId)
		if (buildingId && !roomInstanceId) {
			baseWhere.rental.roomInstance = {
				room: {
					buildingId: buildingId,
				},
			};
		}

		// Add billing period filter
		if (billingPeriod) {
			baseWhere.billingPeriod = billingPeriod;
		} else if (billingMonth && billingYear) {
			const period = `${billingYear}-${String(billingMonth).padStart(2, '0')}`;
			baseWhere.billingPeriod = period;
		} else {
			// Default to current month
			const now = new Date();
			const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
			baseWhere.billingPeriod = currentPeriod;
		}

		// Add status filter
		if (status) {
			baseWhere.status = status;
		}

		// Add search filter (room name or room number)
		if (search) {
			const searchConditions = {
				OR: [
					{
						room: {
							name: { contains: search, mode: 'insensitive' },
						},
					},
					{
						roomNumber: { contains: search, mode: 'insensitive' },
					},
				],
			};

			if (baseWhere.rental.roomInstance) {
				// If building filter exists, combine with search using AND
				const existingRoomInstanceFilter = baseWhere.rental.roomInstance;
				baseWhere.rental.roomInstance = {
					AND: [existingRoomInstanceFilter, searchConditions],
				};
			} else {
				// No building filter, add search directly
				baseWhere.rental.roomInstance = searchConditions;
			}
		}

		// Build orderBy
		let orderBy: any = {};
		switch (sortBy) {
			case 'roomName':
				orderBy = {
					rental: {
						roomInstance: {
							room: {
								name: sortOrder,
							},
						},
					},
				};
				break;
			case 'status':
				orderBy = { status: sortOrder };
				break;
			case 'totalAmount':
				orderBy = { totalAmount: sortOrder };
				break;
			case 'createdAt':
				orderBy = { createdAt: sortOrder };
				break;
			case 'dueDate':
				orderBy = { dueDate: sortOrder };
				break;
			default:
				orderBy = {
					rental: {
						roomInstance: {
							room: {
								name: 'asc',
							},
						},
					},
				};
		}

		const [bills, total] = await Promise.all([
			this.prisma.bill.findMany({
				where: baseWhere,
				include: {
					rental: {
						include: {
							roomInstance: {
								include: {
									room: {
										include: {
											costs: {
												where: { isActive: true },
												include: {
													costTypeTemplate: true,
												},
											},
										},
									},
								},
							},
						},
					},
					billItems: true,
				},
				skip,
				take: limit,
				orderBy,
			}),
			this.prisma.bill.count({ where: baseWhere }),
		]);

		const billDtos = await Promise.all(bills.map((bill) => this.transformToResponseDto(bill)));
		return PaginatedResponseDto.create(billDtos, page, limit, total);
	}

	async updateBillWithMeterData(
		userId: string,
		dto: UpdateBillWithMeterDataDto,
	): Promise<BillResponseDto> {
		// Get existing bill
		const bill = await this.prisma.bill.findUnique({
			where: { id: dto.billId },
			include: {
				rental: {
					include: {
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
				},
				billItems: true,
			},
		});

		if (!bill) {
			throw new NotFoundException('Bill not found');
		}

		// Check if user is owner of this rental
		if (bill.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to update this bill');
		}

		// Don't allow updating paid bills
		if (bill.status === BillStatus.paid) {
			throw new BadRequestException('Cannot update paid bills');
		}

		// Update meter readings for metered costs (lưu theo room instance)
		for (const meterData of dto.meterData) {
			await (this.prisma as any).roomInstanceMeterReading.upsert({
				where: {
					roomInstanceId_roomCostId: {
						roomInstanceId: bill.roomInstanceId,
						roomCostId: meterData.roomCostId,
					},
				},
				update: {
					meterReading: meterData.currentReading,
					lastMeterReading: meterData.lastReading,
				},
				create: {
					roomInstanceId: bill.roomInstanceId,
					roomCostId: meterData.roomCostId,
					meterReading: meterData.currentReading,
					lastMeterReading: meterData.lastReading,
				},
			});
		}

		// Get updated room costs
		const updatedRoomCosts = await this.prisma.roomCost.findMany({
			where: {
				roomId: bill.rental.roomInstance.room.id,
				isActive: true,
			},
			include: {
				costTypeTemplate: true,
			},
		});

		// Get meter readings for this room instance
		const meterReadings = await (this.prisma as any).roomInstanceMeterReading.findMany({
			where: {
				roomInstanceId: bill.roomInstanceId,
			},
		});

		const meterReadingsMap = new Map(meterReadings.map((mr) => [mr.roomCostId, mr]));

		// Merge readings into costs: ưu tiên RoomInstanceMeterReading, fallback về RoomCost
		const costsWithReadings = updatedRoomCosts.map((cost) => {
			const instanceReading = meterReadingsMap.get(cost.id) as any;
			return {
				...cost,
				meterReading: instanceReading?.meterReading ?? cost.meterReading,
				lastMeterReading: instanceReading?.lastMeterReading ?? cost.lastMeterReading,
			};
		});

		// Get occupancy count: from DTO or query from rental
		let occupancyCount = dto.occupancyCount;
		if (!occupancyCount) {
			occupancyCount = await this.rentalsService.getOccupancyCountByRoomInstance(
				bill.roomInstanceId,
			);
		}

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

		// Recalculate bill items with updated occupancy and meter data
		const newBillItems = await this.calculateBillItems(
			costsWithReadings,
			occupancyCount,
			prorationFactor,
			bill.rental.roomInstance.room.pricing,
		);

		// Delete old bill items and create new ones
		await this.prisma.billItem.deleteMany({
			where: { billId: dto.billId },
		});

		// Calculate new totals
		const subtotal = newBillItems.reduce((sum, item) => sum + Number(item.amount), 0);
		const totalAmount = subtotal;

		// Check if room has metered costs
		const hasMeteredCosts = costsWithReadings.some((cost) => cost.costType === 'metered');

		// Check if all metered costs have readings
		const allMeteredCostsHaveReadings = costsWithReadings
			.filter((cost) => cost.costType === 'metered')
			.every((cost) => cost.meterReading !== null && cost.lastMeterReading !== null);

		// Update status:
		// - Nếu có metered costs và đã nhập đủ readings: draft -> pending
		// - Nếu không có metered costs: giữ nguyên status (đã là pending từ khi tạo)
		const newStatus =
			hasMeteredCosts && allMeteredCostsHaveReadings && bill.status === BillStatus.draft
				? BillStatus.pending
				: bill.status;

		// Check if status changed from draft to pending
		const statusChangedToPending =
			bill.status === BillStatus.draft && newStatus === BillStatus.pending;

		// Update bill
		const updatedBill = await this.prisma.bill.update({
			where: { id: dto.billId },
			data: {
				occupancyCount: occupancyCount,
				subtotal,
				totalAmount,
				remainingAmount: totalAmount - Number(bill.paidAmount),
				requiresMeterData: false,
				status: newStatus,
				billItems: {
					create: newBillItems,
				},
			},
			include: {
				rental: {
					include: {
						tenant: true,
						owner: true,
						roomInstance: {
							include: {
								room: {
									include: {
										costs: {
											where: { isActive: true },
											include: {
												costTypeTemplate: true,
											},
										},
									},
								},
							},
						},
					},
				},
				billItems: true,
			},
		});

		// Notify tenant if status changed to pending
		if (statusChangedToPending) {
			try {
				await this.notificationsService.notifyBill(updatedBill.rental.tenantId, {
					month: updatedBill.billingMonth,
					year: updatedBill.billingYear,
					roomName: updatedBill.rental.roomInstance.room.name,
					amount: Number(updatedBill.totalAmount),
					billId: updatedBill.id,
					dueDate: updatedBill.dueDate,
					landlordName:
						`${updatedBill.rental.owner.firstName} ${updatedBill.rental.owner.lastName}`.trim() ||
						'Chủ nhà',
				});
			} catch (error) {
				// Log error but don't fail the bill update
				// eslint-disable-next-line no-console
				console.error('Failed to send bill notification:', error);
			}
		}

		return this.transformToResponseDto(updatedBill);
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
			if (!cost.isActive) {
				continue;
			}

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
		_userRole: UserRole,
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
			rental: _userRole === UserRole.tenant ? { tenantId: userId } : { ownerId: userId },
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
									room: {
										include: {
											costs: {
												where: { isActive: true },
												include: {
													costTypeTemplate: true,
												},
											},
										},
									},
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

		const billDtos = await Promise.all(bills.map((bill) => this.transformToResponseDto(bill)));
		return PaginatedResponseDto.create(billDtos, page, limit, total);
	}

	async getBillById(billId: string, userId: string, _userRole: UserRole): Promise<BillResponseDto> {
		const bill = await this.prisma.bill.findUnique({
			where: { id: billId },
			include: {
				rental: {
					include: {
						roomInstance: {
							include: {
								room: {
									include: {
										costs: {
											where: { isActive: true },
											include: {
												costTypeTemplate: true,
											},
										},
									},
								},
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

		return await this.transformToResponseDto(bill);
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

		// Don't allow updating paid bills
		if (bill.status === BillStatus.paid) {
			throw new BadRequestException('Cannot update paid bills');
		}

		// Update meter readings in room costs (lưu theo room instance)
		for (const meter of meterData) {
			await (this.prisma as any).roomInstanceMeterReading.upsert({
				where: {
					roomInstanceId_roomCostId: {
						roomInstanceId: bill.roomInstanceId,
						roomCostId: meter.roomCostId,
					},
				},
				update: {
					meterReading: meter.currentReading,
					lastMeterReading: meter.lastReading,
				},
				create: {
					roomInstanceId: bill.roomInstanceId,
					roomCostId: meter.roomCostId,
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

		// Get meter readings for this room instance
		const meterReadings = await (this.prisma as any).roomInstanceMeterReading.findMany({
			where: {
				roomInstanceId: bill.roomInstanceId,
			},
		});

		const meterReadingsMap = new Map(meterReadings.map((mr) => [mr.roomCostId, mr]));

		// Merge readings into costs: ưu tiên RoomInstanceMeterReading, fallback về RoomCost
		const costsWithReadings = updatedRoomCosts.map((cost) => {
			const instanceReading = meterReadingsMap.get(cost.id) as any;
			return {
				...cost,
				meterReading: instanceReading?.meterReading ?? cost.meterReading,
				lastMeterReading: instanceReading?.lastMeterReading ?? cost.lastMeterReading,
			};
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
			costsWithReadings,
			bill.occupancyCount || 1,
			prorationFactor,
			bill.roomInstance.room.pricing,
		);

		// Delete old bill items and create new ones
		await this.prisma.billItem.deleteMany({
			where: { billId: billId },
		});

		const subtotal = newBillItems.reduce((sum, item) => sum + Number(item.amount), 0);
		const totalAmount = subtotal;

		// Check if room has metered costs
		const hasMeteredCosts = costsWithReadings.some((cost) => cost.costType === 'metered');

		// Check if all metered costs have readings
		const allMeteredCostsHaveReadings = costsWithReadings
			.filter((cost) => cost.costType === 'metered')
			.every((cost) => cost.meterReading !== null && cost.lastMeterReading !== null);

		// Update status:
		// - Nếu có metered costs và đã nhập đủ readings: draft -> pending
		// - Nếu không có metered costs: giữ nguyên status (đã là pending từ khi tạo)
		const newStatus =
			hasMeteredCosts && allMeteredCostsHaveReadings && bill.status === BillStatus.draft
				? BillStatus.pending
				: bill.status;

		// Check if status changed from draft to pending
		const statusChangedToPending =
			bill.status === BillStatus.draft && newStatus === BillStatus.pending;

		const updatedBill = await this.prisma.bill.update({
			where: { id: billId },
			data: {
				subtotal,
				totalAmount,
				remainingAmount: totalAmount - Number(bill.paidAmount),
				requiresMeterData: false,
				status: newStatus,
				billItems: {
					create: newBillItems,
				},
			},
			include: {
				rental: {
					include: {
						tenant: true,
						owner: true,
						roomInstance: {
							include: {
								room: {
									include: {
										costs: {
											where: { isActive: true },
											include: {
												costTypeTemplate: true,
											},
										},
									},
								},
							},
						},
					},
				},
				billItems: true,
			},
		});

		// Notify tenant if status changed to pending
		if (statusChangedToPending) {
			try {
				await this.notificationsService.notifyBill(updatedBill.rental.tenantId, {
					month: updatedBill.billingMonth,
					year: updatedBill.billingYear,
					roomName: updatedBill.rental.roomInstance.room.name,
					amount: Number(updatedBill.totalAmount),
					billId: updatedBill.id,
					dueDate: updatedBill.dueDate,
					landlordName:
						`${updatedBill.rental.owner.firstName} ${updatedBill.rental.owner.lastName}`.trim() ||
						'Chủ nhà',
				});
			} catch (error) {
				// Log error but don't fail the bill update
				// eslint-disable-next-line no-console
				console.error('Failed to send bill notification:', error);
			}
		}

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

	private convertDecimalToNumber(value: any): number {
		if (value === null || value === undefined) {
			return 0;
		}
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'object') {
			if ('toNumber' in value && typeof value.toNumber === 'function') {
				return value.toNumber();
			}
			if ('d' in value && Array.isArray(value.d) && 'e' in value && 's' in value) {
				const sign = value.s || 1;
				const digits = value.d || [];
				if (digits.length === 0) {
					return 0;
				}
				if (digits.length === 1 && typeof digits[0] === 'number') {
					return digits[0] * sign;
				}
				const numStr = digits.join('');
				const num = parseFloat(numStr) || 0;
				return num * sign;
			}
			if ('toString' in value && typeof value.toString === 'function') {
				try {
					const str = value.toString();
					const num = Number(str);
					return Number.isNaN(num) ? 0 : num;
				} catch {
					return 0;
				}
			}
		}
		const num = Number(value);
		return Number.isNaN(num) ? 0 : num;
	}

	private async transformToResponseDto(bill: any): Promise<BillResponseDto> {
		const room = bill.rental?.roomInstance?.room || bill.roomInstance?.room;
		const roomInstanceId = bill.rental?.roomInstance?.id || bill.roomInstanceId;
		const meteredCosts =
			room?.costs?.filter((cost: any) => cost.costType === 'metered' && cost.isActive) || [];

		// Get meter readings for this room instance
		const meterReadings = await (this.prisma as any).roomInstanceMeterReading.findMany({
			where: {
				roomInstanceId: roomInstanceId,
			},
		});

		const meterReadingsMap = new Map(meterReadings.map((mr) => [mr.roomCostId, mr]));

		// Merge readings into costs: ưu tiên RoomInstanceMeterReading, fallback về RoomCost
		const costsWithReadings = meteredCosts.map((cost: any) => {
			const instanceReading = meterReadingsMap.get(cost.id) as any;
			return {
				...cost,
				meterReading: instanceReading?.meterReading ?? cost.meterReading,
				lastMeterReading: instanceReading?.lastMeterReading ?? cost.lastMeterReading,
			};
		});

		let lastMonthBill: any = null;
		let lastMonthMeterReadings: any[] = [];
		if (bill.rentalId && bill.billingPeriod && roomInstanceId) {
			const [year, month] = bill.billingPeriod.split('-').map(Number);
			let prevMonth = month - 1;
			let prevYear = year;
			if (prevMonth <= 0) {
				prevMonth = 12;
				prevYear -= 1;
			}
			const prevBillingPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

			lastMonthBill = await this.prisma.bill.findUnique({
				where: {
					rentalId_billingPeriod: {
						rentalId: bill.rentalId,
						billingPeriod: prevBillingPeriod,
					},
				},
				include: {
					billItems: true,
				},
			});

			if (lastMonthBill) {
				lastMonthMeterReadings = await (this.prisma as any).roomInstanceMeterReading.findMany({
					where: {
						roomInstanceId: roomInstanceId,
					},
				});
			}
		}

		const lastMonthReadingsMap = new Map(lastMonthMeterReadings.map((mr) => [mr.roomCostId, mr]));

		const meteredCostsToInput = await Promise.all(
			costsWithReadings.map(async (cost: any) => {
				let lastMonthReading: number | null = null;

				if (lastMonthBill && lastMonthMeterReadings.length > 0) {
					const lastMonthReadingRecord = lastMonthReadingsMap.get(cost.id);

					if (lastMonthReadingRecord?.meterReading) {
						lastMonthReading = this.convertDecimalToNumber(lastMonthReadingRecord.meterReading);
					} else if (lastMonthBill.billItems?.length > 0) {
						const lastMonthBillItem = lastMonthBill.billItems.find(
							(item: any) =>
								item.itemType === cost.costTypeTemplate?.category &&
								item.itemName?.includes(cost.costTypeTemplate?.name || ''),
						);

						if (lastMonthBillItem?.quantity) {
							const lastMonthUsage = this.convertDecimalToNumber(lastMonthBillItem.quantity);
							const currentReading = cost.meterReading
								? this.convertDecimalToNumber(cost.meterReading)
								: null;
							if (currentReading !== null && currentReading >= lastMonthUsage) {
								lastMonthReading = currentReading - lastMonthUsage;
							}
						}
					}
				}

				if (lastMonthReading === null) {
					lastMonthReading = cost.lastMeterReading
						? this.convertDecimalToNumber(cost.lastMeterReading)
						: null;
				}

				return {
					roomCostId: cost.id,
					name: cost.costTypeTemplate?.name || 'Unknown',
					unit: cost.unit || '',
					unitPrice: this.convertDecimalToNumber(cost.unitPrice),
					currency: cost.currency || 'VND',
					currentReading: cost.meterReading ? this.convertDecimalToNumber(cost.meterReading) : null,
					lastReading: lastMonthReading,
					lastMonthReading: lastMonthReading,
					requiresInput: !cost.meterReading || lastMonthReading === null,
					notes: cost.notes || null,
				};
			}),
		);

		return {
			id: bill.id,
			rentalId: bill.rentalId,
			roomInstanceId: bill.roomInstanceId,
			billingPeriod: bill.billingPeriod,
			billingMonth: bill.billingMonth,
			billingYear: bill.billingYear,
			periodStart: bill.periodStart,
			periodEnd: bill.periodEnd,
			subtotal: this.convertDecimalToNumber(bill.subtotal),
			discountAmount: this.convertDecimalToNumber(bill.discountAmount),
			taxAmount: this.convertDecimalToNumber(bill.taxAmount),
			totalAmount: this.convertDecimalToNumber(bill.totalAmount),
			paidAmount: this.convertDecimalToNumber(bill.paidAmount),
			remainingAmount: this.convertDecimalToNumber(bill.remainingAmount),
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
				quantity: this.convertDecimalToNumber(item.quantity),
				unitPrice: this.convertDecimalToNumber(item.unitPrice),
				amount: this.convertDecimalToNumber(item.amount),
				currency: item.currency,
				notes: item.notes,
				createdAt: item.createdAt,
			})),
			rental: bill.rental
				? {
						id: bill.rental.id,
						monthlyRent: this.convertDecimalToNumber(bill.rental.monthlyRent),
						roomInstance: {
							roomNumber: bill.rental.roomInstance.roomNumber,
							room: {
								name: bill.rental.roomInstance.room.name,
							},
						},
					}
				: undefined,
			meteredCostsToInput: meteredCostsToInput.length > 0 ? meteredCostsToInput : [],
		};
	}
}
