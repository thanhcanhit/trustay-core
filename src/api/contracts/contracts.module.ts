import { Module } from '@nestjs/common';
import { PDFGenerationService } from '../../common/services/pdf-generation.service';
import { PDFStorageService } from '../../common/services/pdf-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsController } from './contracts.controller';

@Module({
	controllers: [ContractsController],
	providers: [PDFGenerationService, PDFStorageService, PrismaService],
	exports: [PDFGenerationService, PDFStorageService],
})
export class ContractsModule {}
