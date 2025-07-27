import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DistrictController } from './district.controller';
import { DistrictService } from './district.service';

@Module({
	controllers: [DistrictController],
	providers: [DistrictService, PrismaService],
	exports: [DistrictService],
})
export class DistrictModule {}
