import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DistrictService {
	constructor(private readonly prisma: PrismaService) {}

	async findByProvince(provinceId: number) {
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
	}
}
