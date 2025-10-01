import { Module } from '@nestjs/common';
import { PDFGenerationService } from '../../common/services/pdf-generation.service';
import { PDFStorageService } from '../../common/services/pdf-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractsNewService } from './contracts-new.service';

@Module({
	imports: [NotificationsModule],
	controllers: [ContractsController],
	providers: [
		ContractsService,
		ContractsNewService,
		PDFGenerationService,
		PDFStorageService,
		PrismaService,
	],
	exports: [ContractsService, ContractsNewService, PDFGenerationService, PDFStorageService],
})
export class ContractsModule {}
