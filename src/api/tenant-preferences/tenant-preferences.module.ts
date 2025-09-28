import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantPreferencesController } from './tenant-preferences.controller';
import { TenantPreferencesService } from './tenant-preferences.service';

@Module({
	imports: [PrismaModule],
	controllers: [TenantPreferencesController],
	providers: [TenantPreferencesService],
	exports: [TenantPreferencesService],
})
export class TenantPreferencesModule {}
