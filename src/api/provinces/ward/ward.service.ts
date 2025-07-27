import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WardService {
	constructor(private readonly prisma: PrismaService) {}

	async findByDistrict(districtId: number) {
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
	}
}
