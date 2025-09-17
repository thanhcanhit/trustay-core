import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
	imports: [PrismaModule],
	providers: [RealtimeService, RealtimeGateway],
	controllers: [RealtimeController],
	exports: [RealtimeService],
})
export class RealtimeModule {}
