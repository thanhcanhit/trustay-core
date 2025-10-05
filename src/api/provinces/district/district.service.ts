import { Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '../../../cache/constants';
import { CacheService } from '../../../cache/services/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DistrictService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cacheService: CacheService,
	) {}

	async findByProvince(provinceId: number) {
		const cacheKey = `${CACHE_KEYS.DISTRICTS}:province:${provinceId}`;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const districts = await this.prisma.district.findMany({
					where: {
						provinceId: provinceId,
					},
					orderBy: {
						name: 'asc',
					},
					select: {
						id: true,
						code: true,
						name: true,
						nameEn: true,
						provinceId: true,
					},
				});

				return districts;
			},
			CACHE_TTL.LOCATION_DATA,
		);
	}

	async findOne(id: number) {
		const district = await this.prisma.district.findUnique({
			where: { id },
			select: {
				id: true,
				code: true,
				name: true,
				nameEn: true,
				provinceId: true,
			},
		});

		if (!district) {
			throw new NotFoundException(`District with ID ${id} not found`);
		}

		return district;
	}
}
