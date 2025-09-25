import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
	CreateRoommatePreferencesDto,
	CreateRoomPreferencesDto,
	RoommatePreferencesResponseDto,
	RoomPreferencesResponseDto,
	UpdateRoommatePreferencesDto,
	UpdateRoomPreferencesDto,
} from './dto';

@Injectable()
export class TenantPreferencesService {
	constructor(private readonly prisma: PrismaService) {}

	// Room Preferences
	async createOrUpdateRoomPreferences(
		tenantId: string,
		dto: CreateRoomPreferencesDto,
	): Promise<RoomPreferencesResponseDto> {
		const data = {
			...dto,
			availableFromDate: dto.availableFromDate ? new Date(dto.availableFromDate) : undefined,
		};

		const preferences = await this.prisma.tenantRoomPreferences.upsert({
			where: { tenantId },
			update: data,
			create: {
				...data,
				tenantId,
			},
		});

		return this.mapRoomPreferencesToResponseDto(preferences);
	}

	async getRoomPreferences(tenantId: string): Promise<RoomPreferencesResponseDto | null> {
		const preferences = await this.prisma.tenantRoomPreferences.findUnique({
			where: { tenantId },
		});

		return preferences ? this.mapRoomPreferencesToResponseDto(preferences) : null;
	}

	async updateRoomPreferences(
		tenantId: string,
		dto: UpdateRoomPreferencesDto,
	): Promise<RoomPreferencesResponseDto> {
		const existing = await this.prisma.tenantRoomPreferences.findUnique({
			where: { tenantId },
		});

		if (!existing) {
			throw new NotFoundException('Room preferences not found');
		}

		const data = {
			...dto,
			availableFromDate: dto.availableFromDate ? new Date(dto.availableFromDate) : undefined,
		};

		const updated = await this.prisma.tenantRoomPreferences.update({
			where: { tenantId },
			data,
		});

		return this.mapRoomPreferencesToResponseDto(updated);
	}

	async deleteRoomPreferences(tenantId: string): Promise<void> {
		const existing = await this.prisma.tenantRoomPreferences.findUnique({
			where: { tenantId },
		});

		if (!existing) {
			throw new NotFoundException('Room preferences not found');
		}

		await this.prisma.tenantRoomPreferences.delete({
			where: { tenantId },
		});
	}

	// Roommate Preferences
	async createOrUpdateRoommatePreferences(
		tenantId: string,
		dto: CreateRoommatePreferencesDto,
	): Promise<RoommatePreferencesResponseDto> {
		const preferences = await this.prisma.tenantRoommatePreferences.upsert({
			where: { tenantId },
			update: dto,
			create: {
				...dto,
				tenantId,
			},
		});

		return this.mapRoommatePreferencesToResponseDto(preferences);
	}

	async getRoommatePreferences(tenantId: string): Promise<RoommatePreferencesResponseDto | null> {
		const preferences = await this.prisma.tenantRoommatePreferences.findUnique({
			where: { tenantId },
		});

		return preferences ? this.mapRoommatePreferencesToResponseDto(preferences) : null;
	}

	async updateRoommatePreferences(
		tenantId: string,
		dto: UpdateRoommatePreferencesDto,
	): Promise<RoommatePreferencesResponseDto> {
		const existing = await this.prisma.tenantRoommatePreferences.findUnique({
			where: { tenantId },
		});

		if (!existing) {
			throw new NotFoundException('Roommate preferences not found');
		}

		const updated = await this.prisma.tenantRoommatePreferences.update({
			where: { tenantId },
			data: dto,
		});

		return this.mapRoommatePreferencesToResponseDto(updated);
	}

	async deleteRoommatePreferences(tenantId: string): Promise<void> {
		const existing = await this.prisma.tenantRoommatePreferences.findUnique({
			where: { tenantId },
		});

		if (!existing) {
			throw new NotFoundException('Roommate preferences not found');
		}

		await this.prisma.tenantRoommatePreferences.delete({
			where: { tenantId },
		});
	}

	// Get both preferences
	async getAllPreferences(tenantId: string): Promise<{
		roomPreferences: RoomPreferencesResponseDto | null;
		roommatePreferences: RoommatePreferencesResponseDto | null;
	}> {
		const [roomPreferences, roommatePreferences] = await Promise.all([
			this.getRoomPreferences(tenantId),
			this.getRoommatePreferences(tenantId),
		]);

		return {
			roomPreferences,
			roommatePreferences,
		};
	}

	// Helper methods for mapping
	private mapRoomPreferencesToResponseDto(preferences: any): RoomPreferencesResponseDto {
		return {
			id: preferences.id,
			tenantId: preferences.tenantId,
			preferredProvinceIds: preferences.preferredProvinceIds,
			preferredDistrictIds: preferences.preferredDistrictIds,
			minBudget: preferences.minBudget ? Number(preferences.minBudget) : undefined,
			maxBudget: Number(preferences.maxBudget),
			currency: preferences.currency,
			preferredRoomTypes: preferences.preferredRoomTypes,
			maxOccupancy: preferences.maxOccupancy,
			requiresAmenityIds: preferences.requiresAmenityIds,
			availableFromDate: preferences.availableFromDate?.toISOString(),
			minLeaseTerm: preferences.minLeaseTerm,
			isActive: preferences.isActive,
			createdAt: preferences.createdAt.toISOString(),
			updatedAt: preferences.updatedAt.toISOString(),
		};
	}

	private mapRoommatePreferencesToResponseDto(preferences: any): RoommatePreferencesResponseDto {
		return {
			id: preferences.id,
			tenantId: preferences.tenantId,
			preferredGender: preferences.preferredGender,
			preferredAgeMin: preferences.preferredAgeMin,
			preferredAgeMax: preferences.preferredAgeMax,
			allowsSmoking: preferences.allowsSmoking,
			allowsPets: preferences.allowsPets,
			allowsGuests: preferences.allowsGuests,
			cleanlinessLevel: preferences.cleanlinessLevel,
			socialInteractionLevel: preferences.socialInteractionLevel,
			dealBreakers: preferences.dealBreakers,
			isActive: preferences.isActive,
			createdAt: preferences.createdAt.toISOString(),
			updatedAt: preferences.updatedAt.toISOString(),
		};
	}
}
