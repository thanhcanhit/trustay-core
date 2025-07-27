import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AddressService {
	constructor(private readonly prisma: PrismaService) {}

	async search(query: string) {
		if (!query || query.trim().length < 2) {
			throw new BadRequestException('Search query must be at least 2 characters long');
		}

		const searchTerm = query.trim();

		// Search in parallel for better performance
		const [provinces, districts, wards] = await Promise.all([
			// Search provinces
			this.prisma.province.findMany({
				where: {
					OR: [
						{ name: { contains: searchTerm, mode: 'insensitive' } },
						{ nameEn: { contains: searchTerm, mode: 'insensitive' } },
						{ code: { contains: searchTerm, mode: 'insensitive' } },
					],
				},
				select: {
					id: true,
					code: true,
					name: true,
					nameEn: true,
				},
				take: 10,
				orderBy: {
					name: 'asc',
				},
			}),

			// Search districts
			this.prisma.district.findMany({
				where: {
					OR: [
						{ name: { contains: searchTerm, mode: 'insensitive' } },
						{ nameEn: { contains: searchTerm, mode: 'insensitive' } },
						{ code: { contains: searchTerm, mode: 'insensitive' } },
					],
				},
				select: {
					id: true,
					code: true,
					name: true,
					nameEn: true,
					provinceId: true,
					province: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
				take: 20,
				orderBy: {
					name: 'asc',
				},
			}),

			// Search wards
			this.prisma.ward.findMany({
				where: {
					OR: [
						{ name: { contains: searchTerm, mode: 'insensitive' } },
						{ nameEn: { contains: searchTerm, mode: 'insensitive' } },
						{ code: { contains: searchTerm, mode: 'insensitive' } },
					],
				},
				select: {
					id: true,
					code: true,
					name: true,
					nameEn: true,
					level: true,
					districtId: true,
					district: {
						select: {
							id: true,
							name: true,
							code: true,
							province: {
								select: {
									id: true,
									name: true,
									code: true,
								},
							},
						},
					},
				},
				take: 30,
				orderBy: {
					name: 'asc',
				},
			}),
		]);

		return {
			query: searchTerm,
			results: {
				provinces,
				districts,
				wards,
			},
			total: provinces.length + districts.length + wards.length,
		};
	}
}
