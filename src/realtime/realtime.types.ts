export type SocketUserId = string;

export interface RegisterPayload {
	userId: string;
}

export interface NotifyEventPayload<T = unknown> {
	userId: string;
	event: string;
	data: T;
}

export interface ChatMessagePayload {
	fromUserId: string;
	toUserId: string;
	message: string;
	messageId?: string;
	sentAt?: string;
}

export const REALTIME_EVENT = {
	REGISTER: 'realtime/register',
	CONNECTED: 'realtime/connected',
	DISCONNECTED: 'realtime/disconnected',
	NOTIFY: 'notify/event',
	CHAT_MESSAGE: 'chat/message',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];
