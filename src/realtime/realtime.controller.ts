import { Body, Controller, Get, Post } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { BroadcastDto, SendChatDto, SendNotifyDto } from './realtime.types';

@Controller('admin/realtime')
export class RealtimeController {
	public constructor(private readonly realtimeService: RealtimeService) {}

	@Get('status')
	public getStatus() {
		return this.realtimeService.getStatus();
	}

	@Post('notify')
	public sendNotify(@Body() body: SendNotifyDto) {
		const { userId, event, data } = body;
		this.realtimeService.emitNotify({ userId, event: event || undefined, data });
		return { ok: true };
	}

	@Post('chat')
	public sendChat(@Body() body: SendChatDto) {
		this.realtimeService.emitChatMessage(body);
		return { ok: true };
	}

	@Post('broadcast')
	public broadcast(@Body() body: BroadcastDto) {
		this.realtimeService.broadcast(body.event, body.data);
		return { ok: true };
	}
}
