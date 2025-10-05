import { Injectable } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '../../../cache/constants';
import { CacheService } from '../../../cache/services/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProvinceService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cacheService: CacheService,
	) {}

	async findAll() {
		return this.cacheService.wrap(
			CACHE_KEYS.PROVINCES,
			async () => {
				const provinces = await this.prisma.province.findMany({
					orderBy: {
						name: 'asc',
					},
					select: {
						id: true,
						code: true,
						name: true,
						nameEn: true,
					},
				});

				return provinces;
			},
			CACHE_TTL.LOCATION_DATA,
		);
	}
}
