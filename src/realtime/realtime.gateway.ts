import { Logger } from '@nestjs/common';
import {
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';
import { REALTIME_EVENT, RegisterPayload } from './realtime.types';

@WebSocketGateway({
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
	path: '/ws',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	public server!: Server;
	private readonly logger: Logger = new Logger(RealtimeGateway.name);

	public constructor(private readonly realtimeService: RealtimeService) {}

	public afterInit(): void {
		this.realtimeService.setServer(this.server);
	}

	public handleConnection(client: Socket): void {
		this.logger.log(`Socket connected: ${client.id}`);
	}

	public async handleDisconnect(client: Socket): Promise<void> {
		this.logger.log(`Socket disconnected: ${client.id}`);
		await this.realtimeService.unregisterConnection(client.id);
	}

	@SubscribeMessage(REALTIME_EVENT.REGISTER)
	public async handleRegister(
		@MessageBody() payload: RegisterPayload,
		client: Socket,
	): Promise<void> {
		await this.realtimeService.registerConnection(client, payload);
	}

	@SubscribeMessage(REALTIME_EVENT.HEARTBEAT_PONG)
	public async handlePong(_payload: unknown, client: Socket): Promise<void> {
		await this.realtimeService.handlePong(client);
	}
}
