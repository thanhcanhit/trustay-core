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

		// Debug: Listen for ALL events
		client.onAny((eventName, ...args) => {
			this.logger.log(`Raw event received: ${eventName} with args: ${JSON.stringify(args)}`);
		});

		// Manual register handler as backup
		client.on('realtime/register', async (payload) => {
			this.logger.log(`Manual register handler - payload: ${JSON.stringify(payload)}`);
			if (payload && payload.userId) {
				await this.realtimeService.registerConnection(client, payload);
			} else {
				this.logger.error(`Invalid manual register payload: ${JSON.stringify(payload)}`);
			}
		});
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
		this.logger.log(`Register event from ${client.id} with payload: ${JSON.stringify(payload)}`);

		// Debug: Check if payload is properly received
		if (!payload || typeof payload !== 'object') {
			this.logger.error(`Invalid payload received: ${typeof payload} - ${JSON.stringify(payload)}`);
			return;
		}

		if (!payload.userId) {
			this.logger.error(`Missing userId in payload: ${JSON.stringify(payload)}`);
			return;
		}

		await this.realtimeService.registerConnection(client, payload);
	}

	@SubscribeMessage(REALTIME_EVENT.HEARTBEAT_PONG)
	public async handlePong(_payload: unknown, client: Socket): Promise<void> {
		this.logger.log(`PONG received from ${client.id}`);
		await this.realtimeService.handlePong(client);
	}
}
