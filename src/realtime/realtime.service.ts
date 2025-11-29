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
		if (!socket || !socket.id) {
			this.logger.warn('Cannot register invalid socket');
			return;
		}

		const { userId } = payload;
		if (!userId) {
			this.logger.warn(`Reject register for socket ${socket.id} due to missing userId`);
			return;
		}
		this.socketIdToUserId.set(socket.id, userId);
		const sockets = this.userIdToSockets.get(userId) ?? new Set<string>();
		sockets.add(socket.id);
		this.userIdToSockets.set(userId, sockets);
		this.logger.log(
			`Registered user ${userId} for socket ${socket.id} (total sockets: ${sockets.size})`,
		);
		this.markAlive(socket.id);
		this.emitToUser(userId, REALTIME_EVENT.CONNECTED, { socketId: socket.id });

		// Mark user online and update lastActiveAt
		const userExists = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (!userExists) {
			return;
		}
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
			this.logger.debug(`Unregistering unregistered socket: ${socketId}`);
			// Still clean up connection health
			this.connectionHealth.delete(socketId);
			return;
		}

		this.logger.debug(`Unregistering socket ${socketId} for user ${userId}`);
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
		const userExists = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (!userExists) {
			return;
		}
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
		const eventName = event || REALTIME_EVENT.NOTIFY;
		this.logger.log(
			`Emitting notify to user ${userId} with event ${eventName} and data: ${JSON.stringify(data)}`,
		);
		this.emitToUser(userId, eventName, data);
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
		if (!socket || !socket.id) {
			return;
		}
		this.markAlive(socket.id);
		const userId = this.socketIdToUserId.get(socket.id);
		if (!userId) {
			return;
		}

		const userExists = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (!userExists) {
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
			this.logger.warn(`Cannot emit to user ${userId}: no io server attached`);
			return;
		}
		const sockets = this.userIdToSockets.get(userId);
		if (!sockets || sockets.size === 0) {
			// Only log as debug for normal cases, warn for unexpected cases
			if (event === REALTIME_EVENT.DISCONNECTED) {
				this.logger.debug(
					`User ${userId} not found for disconnect event (user may have already disconnected)`,
				);
			} else {
				this.logger.warn(
					`Cannot emit to user ${userId}: no sockets found (registered users: ${Array.from(this.userIdToSockets.keys()).join(', ')})`,
				);
			}
			return;
		}
		this.logger.log(
			`Emitting event ${event} to user ${userId} via ${sockets.size} socket(s): ${Array.from(sockets).join(', ')}`,
		);
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
		if (!socketId) {
			this.logger.warn('Attempted to mark alive with invalid socketId');
			return;
		}
		this.connectionHealth.set(socketId, { lastPongMs: Date.now(), isAlive: true });
	}

	/**
	 * Diagnostics helpers for testing and monitoring
	 */
	public getStatus(): {
		ioAttached: boolean;
		connectedSockets: number;
		usersOnline: number;
		mappings: {
			userIdToSockets: Record<string, string[]>;
			socketIdToUserId: Record<string, string>;
		};
	} {
		const userIdToSocketsObj: Record<string, string[]> = {};
		this.userIdToSockets.forEach((set, userId) => {
			userIdToSocketsObj[userId] = Array.from(set);
		});
		const socketIdToUserIdObj: Record<string, string> = {};
		this.socketIdToUserId.forEach((uid, sid) => {
			socketIdToUserIdObj[sid] = uid;
		});
		return {
			ioAttached: Boolean(this.io),
			connectedSockets: this.io ? this.io.sockets.sockets.size : 0,
			usersOnline: this.userIdToSockets.size,
			mappings: {
				userIdToSockets: userIdToSocketsObj,
				socketIdToUserId: socketIdToUserIdObj,
			},
		};
	}

	public getUserSockets(userId: string): string[] {
		const sockets = this.userIdToSockets.get(userId);
		return sockets ? Array.from(sockets) : [];
	}

	public isUserOnline(userId: string): boolean {
		return (this.userIdToSockets.get(userId)?.size ?? 0) > 0;
	}
}
