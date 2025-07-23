import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { LoggerModule } from '@/logger/logger.module';
import { PrismaService } from './prisma.service';

@Module({
	providers: [PrismaService],
	imports: [ConfigModule, LoggerModule],
	exports: [PrismaService],
})
export class PrismaModule {}
