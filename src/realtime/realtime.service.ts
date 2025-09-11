import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
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

	public setServer(server: Server): void {
		this.io = server;
	}

	public registerConnection(socket: Socket, payload: RegisterPayload): void {
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
		this.emitToUser(userId, REALTIME_EVENT.CONNECTED, { socketId: socket.id });
	}

	public unregisterConnection(socketId: string): void {
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
		this.emitToUser(userId, REALTIME_EVENT.DISCONNECTED, { socketId });
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
}
