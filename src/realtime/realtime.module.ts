import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
	imports: [],
	providers: [RealtimeService, RealtimeGateway],
	exports: [RealtimeService],
})
export class RealtimeModule {}
