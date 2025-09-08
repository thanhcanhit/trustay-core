import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, UserRole } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
	CreatePaymentDto,
	PaginatedPaymentResponseDto,
	PaymentResponseDto,
	QueryPaymentDto,
	UpdatePaymentDto,
} from './dto';

@Injectable()
export class PaymentsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationsService: NotificationsService,
	) {}

	async createPayment(payerId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
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

		// Check if user is tenant or owner of this rental
		if (rental.tenantId !== payerId && rental.ownerId !== payerId) {
			throw new ForbiddenException('Not authorized to create payment for this rental');
		}

		// If monthlyBillId is provided, verify it exists
		if (dto.monthlyBillId) {
			const bill = await this.prisma.monthlyBill.findUnique({
				where: { id: dto.monthlyBillId },
			});

			if (!bill) {
				throw new NotFoundException('Monthly bill not found');
			}

			if (bill.rentalId !== dto.rentalId) {
				throw new BadRequestException('Monthly bill does not belong to this rental');
			}
		}

		const payment = await this.prisma.payment.create({
			data: {
				rentalId: dto.rentalId,
				monthlyBillId: dto.monthlyBillId,
				payerId,
				paymentType: dto.paymentType,
				amount: dto.amount,
				currency: dto.currency || 'VND',
				paymentMethod: dto.paymentMethod,
				dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
				description: dto.description,
				transactionReference: dto.transactionReference,
			},
			include: {
				payer: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
				rental: {
					include: {
						roomInstance: {
							include: {
								room: {
									select: {
										name: true,
									},
								},
							},
						},
					},
				},
			},
		});

		// Send notification to landlord when tenant makes payment
		if (payerId === rental.tenantId) {
			await this.notificationsService.notifyPaymentReceived(rental.ownerId, {
				amount: Number(payment.amount),
				paymentType: payment.paymentType,
				roomName: `${payment.rental.roomInstance.room.name} - ${payment.rental.roomInstance.roomNumber}`,
				tenantName: `${payment.payer.firstName} ${payment.payer.lastName}`,
				paymentId: payment.id,
			});
		}

		return this.transformToResponseDto(payment);
	}

	async getPayments(
		userId: string,
		userRole: UserRole,
		query: QueryPaymentDto,
	): Promise<PaginatedPaymentResponseDto> {
		const { page = 1, limit = 20, rentalId, paymentType, paymentStatus, fromDate, toDate } = query;
		const skip = (page - 1) * limit;

		// Base where condition - user can only see payments for their own rentals
		const baseWhere: any = {
			rental: userRole === UserRole.tenant ? { tenantId: userId } : { ownerId: userId },
		};

		// Add optional filters
		if (rentalId) baseWhere.rentalId = rentalId;
		if (paymentType) baseWhere.paymentType = paymentType;
		if (paymentStatus) baseWhere.paymentStatus = paymentStatus;

		if (fromDate || toDate) {
			baseWhere.createdAt = {};
			if (fromDate) baseWhere.createdAt.gte = new Date(fromDate);
			if (toDate) baseWhere.createdAt.lte = new Date(toDate);
		}

		const [payments, total] = await Promise.all([
			this.prisma.payment.findMany({
				where: baseWhere,
				include: {
					payer: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
						},
					},
					rental: {
						include: {
							roomInstance: {
								include: {
									room: {
										select: {
											name: true,
										},
									},
								},
							},
						},
					},
				},
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.payment.count({ where: baseWhere }),
		]);

		const paymentDtos = payments.map((payment) => this.transformToResponseDto(payment));
		return PaginatedResponseDto.create(paymentDtos, page, limit, total);
	}

	async getPaymentById(paymentId: string, userId: string): Promise<PaymentResponseDto> {
		const payment = await this.prisma.payment.findUnique({
			where: { id: paymentId },
			include: {
				payer: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
				rental: {
					include: {
						roomInstance: {
							include: {
								room: {
									select: {
										name: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!payment) {
			throw new NotFoundException('Payment not found');
		}

		// Check if user has access to this payment
		if (payment.rental.tenantId !== userId && payment.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to view this payment');
		}

		return this.transformToResponseDto(payment);
	}

	async updatePayment(
		paymentId: string,
		userId: string,
		dto: UpdatePaymentDto,
	): Promise<PaymentResponseDto> {
		const existingPayment = await this.prisma.payment.findUnique({
			where: { id: paymentId },
			include: { rental: true },
		});

		if (!existingPayment) {
			throw new NotFoundException('Payment not found');
		}

		// Check if user has access to update this payment
		if (existingPayment.rental.tenantId !== userId && existingPayment.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to update this payment');
		}

		const updatedPayment = await this.prisma.payment.update({
			where: { id: paymentId },
			data: {
				...(dto.paymentType && { paymentType: dto.paymentType }),
				...(dto.amount && { amount: dto.amount }),
				...(dto.currency && { currency: dto.currency }),
				...(dto.paymentMethod && { paymentMethod: dto.paymentMethod }),
				...(dto.paymentStatus && { paymentStatus: dto.paymentStatus }),
				...(dto.paymentDate && { paymentDate: new Date(dto.paymentDate) }),
				...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
				...(dto.description && { description: dto.description }),
				...(dto.transactionReference && { transactionReference: dto.transactionReference }),
			},
			include: {
				payer: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
				rental: {
					include: {
						roomInstance: {
							include: {
								room: {
									select: {
										name: true,
									},
								},
							},
						},
					},
				},
			},
		});

		// If payment status changed to completed and it's from tenant, notify landlord
		if (
			dto.paymentStatus === PaymentStatus.completed &&
			existingPayment.paymentStatus !== PaymentStatus.completed
		) {
			if (userId === updatedPayment.rental.tenantId) {
				await this.notificationsService.notifyPaymentReceived(updatedPayment.rental.ownerId, {
					amount: Number(updatedPayment.amount),
					paymentType: updatedPayment.paymentType,
					roomName: `${updatedPayment.rental.roomInstance.room.name} - ${updatedPayment.rental.roomInstance.roomNumber}`,
					tenantName: `${updatedPayment.payer.firstName} ${updatedPayment.payer.lastName}`,
					paymentId: updatedPayment.id,
				});
			}
		}

		return this.transformToResponseDto(updatedPayment);
	}

	async deletePayment(paymentId: string, userId: string): Promise<void> {
		const payment = await this.prisma.payment.findUnique({
			where: { id: paymentId },
			include: { rental: true },
		});

		if (!payment) {
			throw new NotFoundException('Payment not found');
		}

		// Check if user has access to delete this payment
		if (payment.rental.tenantId !== userId && payment.rental.ownerId !== userId) {
			throw new ForbiddenException('Not authorized to delete this payment');
		}

		// Don't allow deletion of completed payments
		if (payment.paymentStatus === PaymentStatus.completed) {
			throw new BadRequestException('Cannot delete completed payments');
		}

		await this.prisma.payment.delete({
			where: { id: paymentId },
		});
	}

	private transformToResponseDto(payment: any): PaymentResponseDto {
		return {
			id: payment.id,
			rentalId: payment.rentalId,
			monthlyBillId: payment.monthlyBillId,
			payerId: payment.payerId,
			paymentType: payment.paymentType,
			amount: payment.amount,
			currency: payment.currency,
			paymentMethod: payment.paymentMethod,
			paymentStatus: payment.paymentStatus,
			paymentDate: payment.paymentDate,
			dueDate: payment.dueDate,
			description: payment.description,
			transactionReference: payment.transactionReference,
			createdAt: payment.createdAt,
			updatedAt: payment.updatedAt,
			payer: payment.payer
				? {
						id: payment.payer.id,
						firstName: payment.payer.firstName,
						lastName: payment.payer.lastName,
						email: payment.payer.email,
					}
				: undefined,
			rental: payment.rental
				? {
						id: payment.rental.id,
						monthlyRent: payment.rental.monthlyRent,
						roomInstance: {
							roomNumber: payment.rental.roomInstance.roomNumber,
							room: {
								name: payment.rental.roomInstance.room.name,
							},
						},
					}
				: undefined,
		};
	}
}
