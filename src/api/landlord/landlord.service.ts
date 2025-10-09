import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
	ListRoomsQueryDto,
	ListTenantsQueryDto,
	RoomWithOccupantsDto,
	TenantListItemDto,
} from './dto';

@Injectable()
export class LandlordService {
	constructor(private readonly prisma: PrismaService) {}

	async listTenants(
		landlordId: string,
		query: ListTenantsQueryDto,
	): Promise<{
		data: TenantListItemDto[];
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}> {
		const { page = 1, limit = 20, search, buildingId, roomId } = query;
		const skip = (page - 1) * limit;

		const where: Prisma.RentalWhereInput = {
			ownerId: landlordId,
			status: { in: ['active', 'pending_renewal'] },
			...(buildingId || roomId
				? {
						roomInstance: {
							room: {
								...(roomId ? { id: roomId } : {}),
								building: { ownerId: landlordId, ...(buildingId ? { id: buildingId } : {}) },
							},
						},
					}
				: {}),
			...(search
				? {
						OR: [
							{ tenant: { firstName: { contains: search, mode: 'insensitive' } } },
							{ tenant: { lastName: { contains: search, mode: 'insensitive' } } },
							{ tenant: { email: { contains: search, mode: 'insensitive' } } },
							{ tenant: { phone: { contains: search, mode: 'insensitive' } } },
						],
					}
				: {}),
		};

		const [rentals, total] = await Promise.all([
			this.prisma.rental.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
				include: {
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							avatarUrl: true,
						},
					},
					roomInstance: {
						include: {
							room: {
								include: {
									building: { select: { id: true, name: true } },
									roomInstances: {
										select: { id: true },
									},
								},
							},
						},
					},
				},
			}),
			this.prisma.rental.count({ where }),
		]);

		const data: TenantListItemDto[] = rentals.map((r) => ({
			tenantId: r.tenant.id,
			firstName: r.tenant.firstName ?? undefined,
			lastName: r.tenant.lastName ?? undefined,
			email: r.tenant.email ?? undefined,
			phone: r.tenant.phone ?? undefined,
			avatarUrl: r.tenant.avatarUrl ?? undefined,
			room: {
				roomId: r.roomInstance.room.id,
				roomName: r.roomInstance.room.name ?? undefined,
				roomNumber: r.roomInstance.roomNumber,
				buildingId: r.roomInstance.room.building.id,
				buildingName: r.roomInstance.room.building.name,
				occupancy: r.roomInstance.room.roomInstances.length,
			},
			rentalId: r.id,
			rentalStatus: r.status,
			contractStartDate: r.contractStartDate,
			contractEndDate: r.contractEndDate ?? undefined,
		}));

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async listRooms(
		landlordId: string,
		query: ListRoomsQueryDto,
	): Promise<{
		data: RoomWithOccupantsDto[];
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}> {
		const { page = 1, limit = 20, buildingId, search } = query;
		const skip = (page - 1) * limit;

		const where: Prisma.RoomWhereInput = {
			building: { ownerId: landlordId, ...(buildingId ? { id: buildingId } : {}) },
			...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
		};

		const [rooms, total] = await Promise.all([
			this.prisma.room.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
				include: {
					building: { select: { id: true, name: true } },
					roomInstances: {
						include: {
							rentals: {
								where: { status: { in: ['active', 'pending_renewal'] } },
								include: {
									tenant: {
										select: {
											id: true,
											firstName: true,
											lastName: true,
											email: true,
											phone: true,
											avatarUrl: true,
										},
									},
								},
							},
						},
					},
				},
			}),
			this.prisma.room.count({ where }),
		]);

		const data: RoomWithOccupantsDto[] = rooms.map((room) => {
			const instances = room.roomInstances;
			const occupants = instances
				.flatMap((ri) => ri.rentals)
				.filter((r) => r.tenant)
				.map((r) => ({
					tenantId: r.tenant.id,
					firstName: r.tenant.firstName ?? undefined,
					lastName: r.tenant.lastName ?? undefined,
					email: r.tenant.email ?? undefined,
					phone: r.tenant.phone ?? undefined,
					avatarUrl: r.tenant.avatarUrl ?? undefined,
					rentalId: r.id,
				}));

			return {
				roomId: room.id,
				roomName: room.name ?? undefined,
				buildingId: room.building.id,
				buildingName: room.building.name,
				totalInstances: instances.length,
				occupiedInstances: instances.filter((ri) => ri.rentals.length > 0).length,
				occupants,
			};
		});

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}
}
