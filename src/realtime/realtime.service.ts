import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@/prisma/prisma.service';
import {
	ChatMessagePayload,
	NotifyEventPayload,
	REALTIME_EVENT,
	RegisterPayload,
	SocketUserId,
} from './realtime.types';

@Injectable()
export class RealtimeService {
	private readonly logger: Logger = new Logger(RealtimeService.name);
	private io?: Server;
	private readonly userIdToSockets: Map<SocketUserId, Set<string>> = new Map();
	private readonly socketIdToUserId: Map<string, SocketUserId> = new Map();
	private heartbeatInterval?: NodeJS.Timeout;
	private readonly connectionHealth: Map<string, { lastPongMs: number; isAlive: boolean }> =
		new Map();
	private static readonly HEARTBEAT_INTERVAL_MS: number = 30_000;
	private static readonly HEARTBEAT_TIMEOUT_MS: number = 60_000;
	// private static readonly HEARTBEAT_INTERVAL_MS: number = 300_000; // 5 minutes
	// private static readonly HEARTBEAT_TIMEOUT_MS: number = 600_000; //

	public constructor(private readonly prisma: PrismaService) {}

	public setServer(server: Server): void {
		this.io = server;
		this.setupHeartbeat();
	}

	public async registerConnection(socket: Socket, payload: RegisterPayload): Promise<void> {
		const { userId } = payload;
		if (!userId) {
			this.logger.warn(`Reject register for socket ${socket.id} due to missing userId`);
			return;
		}
		this.socketIdToUserId.set(socket.id, userId);
		const sockets = this.userIdToSockets.get(userId) ?? new Set<string>();
		sockets.add(socket.id);
		this.userIdToSockets.set(userId, sockets);
		this.logger.log(`Registered user ${userId} for socket ${socket.id}`);
		this.markAlive(socket.id);
		this.emitToUser(userId, REALTIME_EVENT.CONNECTED, { socketId: socket.id });

		// Mark user online and update lastActiveAt
		try {
			await this.prisma.user.update({
				where: { id: userId },
				data: { isOnline: true, lastActiveAt: new Date() },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.warn(`Failed updating user online status on register: ${message}`);
		}
	}

	public async unregisterConnection(socketId: string): Promise<void> {
		const userId = this.socketIdToUserId.get(socketId);
		if (!userId) {
			return;
		}
		this.socketIdToUserId.delete(socketId);
		const sockets = this.userIdToSockets.get(userId);
		if (sockets) {
			sockets.delete(socketId);
			if (sockets.size === 0) {
				this.userIdToSockets.delete(userId);
			}
		}
		this.connectionHealth.delete(socketId);
		this.emitToUser(userId, REALTIME_EVENT.DISCONNECTED, { socketId });

		// If no more sockets for this user, mark offline; otherwise keep online
		const remaining = this.userIdToSockets.get(userId)?.size ?? 0;
		try {
			await this.prisma.user.update({
				where: { id: userId },
				data: { isOnline: remaining > 0, lastActiveAt: new Date() },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.warn(`Failed updating user online status on disconnect: ${message}`);
		}
	}

	public emitNotify<T = unknown>(payload: NotifyEventPayload<T>): void {
		const { userId, event, data } = payload;
		this.emitToUser(userId, event || REALTIME_EVENT.NOTIFY, data);
	}

	public emitChatMessage(payload: ChatMessagePayload): void {
		const { toUserId } = payload;
		this.emitToUser(toUserId, REALTIME_EVENT.CHAT_MESSAGE, payload);
	}

	public broadcast(event: string, data: unknown): void {
		if (!this.io) {
			return;
		}
		this.io.emit(event, data);
	}

	public async handlePong(socket: Socket): Promise<void> {
		this.markAlive(socket.id);
		const userId = this.socketIdToUserId.get(socket.id);
		if (!userId) {
			return;
		}
		try {
			await this.prisma.user.update({
				where: { id: userId },
				data: { lastActiveAt: new Date(), isOnline: true },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.warn(`Failed updating lastActiveAt on pong: ${message}`);
		}
	}

	private emitToUser(userId: string, event: string, data: unknown): void {
		if (!this.io) {
			return;
		}
		const sockets = this.userIdToSockets.get(userId);
		if (!sockets || sockets.size === 0) {
			return;
		}
		sockets.forEach((socketId) => {
			this.io?.to(socketId).emit(event, data);
		});
	}

	private setupHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}
		this.heartbeatInterval = setInterval(() => {
			if (!this.io) {
				return;
			}
			// Emit ping to all connected clients
			this.io.emit(REALTIME_EVENT.HEARTBEAT_PING);
			this.checkConnectionHealth();
		}, RealtimeService.HEARTBEAT_INTERVAL_MS);
	}

	private checkConnectionHealth(): void {
		const now = Date.now();
		this.connectionHealth.forEach((health, socketId) => {
			if (now - health.lastPongMs > RealtimeService.HEARTBEAT_TIMEOUT_MS) {
				this.logger.warn(`Heartbeat timeout; disconnecting socket ${socketId}`);
				this.handleDeadConnection(socketId);
			}
		});
	}

	private handleDeadConnection(socketId: string): void {
		try {
			this.connectionHealth.delete(socketId);
			this.unregisterConnection(socketId);
			this.io?.sockets.sockets.get(socketId)?.disconnect(true);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(`Failed to handle dead connection ${socketId}: ${message}`);
		}
	}

	private markAlive(socketId: string): void {
		this.connectionHealth.set(socketId, { lastPongMs: Date.now(), isAlive: true });
	}
}
