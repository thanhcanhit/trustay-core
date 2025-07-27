import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProvinceService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll() {
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
	}
}
