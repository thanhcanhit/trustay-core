import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PDFGenerationService } from '../../common/services/pdf-generation.service';
import { PDFStorageService } from '../../common/services/pdf-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsController } from './contracts.controller';
import { ContractsNewService } from './contracts-new.service';

@Module({
	imports: [NotificationsModule, AuthModule],
	controllers: [ContractsController],
	providers: [ContractsNewService, PDFGenerationService, PDFStorageService, PrismaService],
	exports: [ContractsNewService, PDFGenerationService, PDFStorageService],
})
export class ContractsModule {}
