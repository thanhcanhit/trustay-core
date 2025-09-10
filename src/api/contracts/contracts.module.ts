import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
	imports: [PrismaModule, NotificationsModule],
	controllers: [ContractsController],
	providers: [ContractsService],
	exports: [ContractsService],
})
export class ContractsModule {}
