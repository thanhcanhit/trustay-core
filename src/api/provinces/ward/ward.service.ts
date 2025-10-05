import { Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '../../../cache/constants';
import { CacheService } from '../../../cache/services/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WardService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cacheService: CacheService,
	) {}

	async findByDistrict(districtId: number) {
		const cacheKey = `${CACHE_KEYS.WARDS}:district:${districtId}`;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const wards = await this.prisma.ward.findMany({
					where: {
						districtId: districtId,
					},
					orderBy: {
						name: 'asc',
					},
					select: {
						id: true,
						code: true,
						name: true,
						nameEn: true,
						level: true,
						districtId: true,
					},
				});

				return wards;
			},
			CACHE_TTL.LOCATION_DATA,
		);
	}

	async findOne(id: number) {
		const ward = await this.prisma.ward.findUnique({
			where: { id },
			select: {
				id: true,
				code: true,
				name: true,
				nameEn: true,
				level: true,
				districtId: true,
			},
		});

		if (!ward) {
			throw new NotFoundException(`Ward with ID ${id} not found`);
		}

		return ward;
	}
}
