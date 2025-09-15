import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
	imports: [PrismaModule],
	providers: [RealtimeService, RealtimeGateway],
	exports: [RealtimeService],
})
export class RealtimeModule {}
