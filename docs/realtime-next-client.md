## Realtime (Socket.IO) client for Next.js

This guide shows a clean, scalable client architecture using a Socket Handler that mounts feature Handlers (Chat/Notifications) and persists data in Zustand stores.

### 1) Install dependency

```bash
pnpm add socket.io-client
```

### 2) Environment config

Add an environment variable that points to your API origin (same host/port as the Nest app). The gateway is exposed at path `/ws`.

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3) Folder structure

```
app/
lib/
  realtime/
    socket.ts            # socket handler (register + heartbeat)
    handlers/
      chat-handler.ts     # feature handler: chat
      notification-handler.ts  # feature handler: notifications
stores/
  chat.store.ts
  notification.store.ts
hooks/
  useRealtime.ts
```

### 4) Socket Handler

File: `lib/realtime/socket.ts`

```ts
import { io, Socket } from 'socket.io-client';

export const REALTIME_EVENT = {
  REGISTER: 'realtime/register',
  CONNECTED: 'realtime/connected',
  DISCONNECTED: 'realtime/disconnected',
  NOTIFY: 'notify/event',
  CHAT_MESSAGE: 'chat/message',
  HEARTBEAT_PING: 'realtime/ping',
  HEARTBEAT_PONG: 'realtime/pong',
} as const;

export type RegisterPayload = { userId: string };

type MountableHandler = (socket: Socket) => void | (() => void);

let socket: Socket | null = null;

export function ensureSocket(userId: string) {
  if (socket?.connected) return socket as Socket;
  socket = io(process.env.NEXT_PUBLIC_API_URL as string, {
    path: '/ws',
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: true,
  });
  socket.on('connect', () => {
    socket?.emit(REALTIME_EVENT.REGISTER, { userId } satisfies RegisterPayload);
  });
  socket.on(REALTIME_EVENT.HEARTBEAT_PING, () => {
    socket?.emit(REALTIME_EVENT.HEARTBEAT_PONG);
  });
  return socket as Socket;
}

export function mountHandlers(userId: string, handlers: MountableHandler[]) {
  const s = ensureSocket(userId);
  const disposers = handlers
    .map((h) => h(s))
    .filter(Boolean) as (() => void)[];
  return () => {
    disposers.forEach((d) => d());
  };
}

export function closeSocket() {
  socket?.close();
  socket = null;
}
```

### 5) Feature handlers

File: `lib/realtime/handlers/notification-handler.ts`

```ts
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENT } from '../socket';
import { useNotificationStore } from '@/stores/notification.store';

export type NotifyEnvelope<T = unknown> = { type: string; data: T };

export function notificationHandler(socket: Socket) {
  const addNotification = useNotificationStore.getState().addNotification;
  const onNotify = (payload: NotifyEnvelope<any>) => addNotification(payload);
  socket.on(REALTIME_EVENT.NOTIFY, onNotify);
  return () => socket.off(REALTIME_EVENT.NOTIFY, onNotify);
}
```

File: `lib/realtime/handlers/chat-handler.ts`

```ts
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENT } from '../socket';
import { useChatStore } from '@/stores/chat.store';

export type ChatMessagePayload<TMessage = unknown> = {
  fromUserId: string;
  toUserId: string;
  conversationId: string;
  message: TMessage;
  messageId?: string;
  sentAt?: string;
};

export function chatHandler(socket: Socket) {
  const addIncoming = useChatStore.getState().addIncoming;
  const onChat = (payload: ChatMessagePayload<any>) => addIncoming(payload);
  socket.on(REALTIME_EVENT.CHAT_MESSAGE, onChat);
  return () => socket.off(REALTIME_EVENT.CHAT_MESSAGE, onChat);
}
```

### 6) Zustand stores

File: `stores/notification.store.ts`

```ts
import { create } from 'zustand';

export type NotificationItem = { id?: string; type: string; data: any; receivedAt: number };

type NotificationState = {
  items: NotificationItem[];
  unread: number;
  addNotification: (n: { type: string; data: any }) => void;
  markAllAsRead: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unread: 0,
  addNotification: (n) =>
    set((s) => ({ items: [{ ...n, receivedAt: Date.now() }, ...s.items], unread: s.unread + 1 })),
  markAllAsRead: () => set((s) => ({ ...s, unread: 0 })),
}));
```

File: `stores/chat.store.ts`

```ts
import { create } from 'zustand';

export type ChatMessage = {
  conversationId: string;
  messageId?: string;
  fromUserId: string;
  toUserId: string;
  content?: unknown;
  sentAt?: string;
};

type ChatState = {
  byConversation: Record<string, ChatMessage[]>;
  addIncoming: (payload: {
    conversationId: string;
    messageId?: string;
    fromUserId: string;
    toUserId: string;
    message: any;
    sentAt?: string;
  }) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  byConversation: {},
  addIncoming: (p) =>
    set((s) => {
      const list = s.byConversation[p.conversationId] ?? [];
      const next: ChatMessage = {
        conversationId: p.conversationId,
        messageId: p.messageId,
        fromUserId: p.fromUserId,
        toUserId: p.toUserId,
        content: p.message,
        sentAt: p.sentAt,
      };
      return { byConversation: { ...s.byConversation, [p.conversationId]: [next, ...list] } };
    }),
}));
```

### 7) React hook: mount handlers via Socket Handler

File: `hooks/useRealtime.ts`

```ts
import { useEffect } from 'react';
import { mountHandlers } from '@/lib/realtime/socket';
import { chatHandler } from '@/lib/realtime/handlers/chat-handler';
import { notificationHandler } from '@/lib/realtime/handlers/notification-handler';

export function useRealtime(userId: string) {
  useEffect(() => {
    if (!userId) return;
    const dispose = mountHandlers(userId, [notificationHandler, chatHandler]);
    return () => dispose();
  }, [userId]);
}
```

### 8) Using the hook in a component

```tsx
import { useRealtime } from '@/hooks/useRealtime';

export default function RealtimeProvider({ userId }: { userId: string }) {
  useRealtime(userId);
  return null;
}
```

### 9) Events and payloads from the backend

- Notifications
  - Event: `notify/event`
  - Payload: `{ type: string; data: any }` (see `NotificationType` in the API)
  - Triggered by backend via `NotificationsService` and used for all templated notifications

- Chat
  - Event: `chat/message`
  - Payload: `{ fromUserId, toUserId, conversationId, message, messageId?, sentAt? }`
  - Emitted on new messages and also via generic `notify/event` for convenience

- Heartbeat
  - Server → client: `realtime/ping`
  - Client → server: `realtime/pong`
  - If client does not emit `realtime/pong`, server disconnects the socket after ~60s of inactivity.

### 10) Common tips

- Use a singleton socket instance across the app to avoid duplicate connections.
- Always send `realtime/register` with the current `userId` on connect.
- Ensure the client responds to `realtime/ping` to keep the connection alive.
- The websocket server shares the same origin/port as the API and uses path `/ws`.


