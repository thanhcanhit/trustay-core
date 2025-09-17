export type SocketUserId = string;

export interface RegisterPayload {
	userId: string;
}

export interface NotifyEventPayload<T = unknown> {
	userId: string;
	event: string;
	data: T;
}

export interface NotifyEnvelope<T = unknown> {
	type: string;
	data: T;
}

export interface ChatMessagePayload<TMessage = unknown> {
	fromUserId: string;
	toUserId: string;
	conversationId: string;
	message: TMessage;
	messageId?: string;
	sentAt?: string;
}

export const REALTIME_EVENT = {
	REGISTER: 'realtime/register',
	CONNECTED: 'realtime/connected',
	DISCONNECTED: 'realtime/disconnected',
	NOTIFY: 'notify/event',
	CHAT_MESSAGE: 'chat/message',
	HEARTBEAT_PING: 'realtime/ping',
	HEARTBEAT_PONG: 'realtime/pong',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];

export interface SendNotifyDto<T = unknown> {
	userId: string;
	event?: string;
	data: T;
}

export interface SendChatDto<TMessage = unknown> {
	toUserId: string;
	fromUserId: string;
	conversationId: string;
	message: TMessage;
	messageId?: string;
}

export interface BroadcastDto<T = unknown> {
	event: string;
	data: T;
}
