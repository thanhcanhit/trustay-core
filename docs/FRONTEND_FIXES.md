# Frontend Fixes Guide

Hướng dẫn sửa các lỗi compilation trong Frontend code.

## 1. Fix React Hooks Rules Violation

**File:** `src/components/ai/ai-sidebar.tsx:76`

**Lỗi:**
```
React Hook "useAIAssistantStore" is called conditionally
```

**Sửa:**
```typescript
// ❌ SAI - Hook được gọi trong điều kiện
const MyComponent = () => {
  if (someCondition) {
    const store = useAIAssistantStore(); // ❌ Lỗi
  }
}

// ✅ ĐÚNG - Hook luôn được gọi ở top level
const MyComponent = () => {
  const store = useAIAssistantStore(); // ✅ Luôn gọi ở top level
  
  if (someCondition) {
    // Sử dụng store ở đây
    store.doSomething();
  }
}
```

## 2. Fix TypeScript `any` Types

**Files:**
- `src/components/ai/ai-sidebar.tsx:223`
- `src/stores/conversation.store.ts:179`

**Sửa:**

### File: `ai-sidebar.tsx`
```typescript
// ❌ SAI
const handleSomething = (data: any) => {
  // ...
}

// ✅ ĐÚNG - Import types từ Backend hoặc định nghĩa type
import type { ChatResponse, ConversationMessage } from '@/types/conversation';

const handleSomething = (data: ChatResponse | ConversationMessage) => {
  // ...
}
```

### File: `conversation.store.ts`
```typescript
// ❌ SAI
const processData = (data: any) => {
  // ...
}

// ✅ ĐÚNG
import type { ConversationMessage, ChatResponse } from '@/types/conversation';

const processData = (data: ConversationMessage | ChatResponse) => {
  // ...
}
```

## 3. Remove Unused Imports/Variables

### File: `src/actions/conversation.action.ts`
```typescript
// ❌ Xóa dòng này nếu không dùng
import { ChatResponse } from '@/types/conversation';

// Hoặc sử dụng nó
import type { ChatResponse } from '@/types/conversation';

const action = async (): Promise<ChatResponse> => {
  // Sử dụng ChatResponse
}
```

### File: `src/components/ai/ai-sidebar.tsx`
```typescript
// ❌ Xóa các import không dùng
import { ChevronLeft, ConversationMessage } from '...';

// ✅ Chỉ import những gì cần
import { /* chỉ import những gì dùng */ } from '...';

// ❌ Xóa biến không dùng
const createConversation = ...; // Xóa nếu không dùng

// Hoặc sử dụng nó
const handleCreate = async () => {
  await createConversation({ title: 'New Chat' });
};
```

### File: `src/components/ai/conversation-item.tsx`
```typescript
// ❌ Xóa import không dùng
import { MoreVertical } from 'lucide-react';

// ❌ Xóa state không dùng
const [showMenu, setShowMenu] = useState(false);

// Hoặc sử dụng chúng
const [showMenu, setShowMenu] = useState(false);

const handleClick = () => {
  setShowMenu(!showMenu);
};

{showMenu && <MoreVertical />}
```

### File: `src/components/ai/conversation-list.tsx`
```typescript
// ❌ Xóa imports không dùng
import { useEffect, cn } from '...';

// ❌ Xóa prop không dùng
const ConversationList = ({ onClear }: Props) => {
  // Nếu không dùng onClear, xóa khỏi Props interface
}

// ✅ Hoặc sử dụng chúng
const ConversationList = ({ onClear }: Props) => {
  useEffect(() => {
    // Sử dụng useEffect
  }, []);

  return (
    <div className={cn('...')}>
      <button onClick={onClear}>Clear</button>
    </div>
  );
}
```

### File: `src/stores/conversation.store.ts`
```typescript
// ❌ Xóa parameter không dùng
const someFunction = (_images: string[]) => {
  // Nếu không dùng _images, có thể xóa hoặc prefix với _
}

// ✅ Hoặc sử dụng nó
const someFunction = (images: string[]) => {
  images.forEach(img => {
    // Sử dụng images
  });
}
```

## 4. Fix Unused Error Variables

**Files:** Multiple files với unused `error` variables

**Sửa:**
```typescript
// ❌ SAI - Error không được sử dụng
try {
  await someAsyncOperation();
} catch (error) {
  // Không làm gì với error
}

// ✅ ĐÚNG - Sử dụng error hoặc prefix với _
try {
  await someAsyncOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Hoặc
  throw error;
}

// Hoặc nếu thực sự không cần:
try {
  await someAsyncOperation();
} catch {
  // Không cần error variable
}
```

## 5. Import Types từ Backend

Tạo file `src/types/conversation.ts` trong Frontend project:

```typescript
/**
 * Conversation Types
 * Import từ Backend API hoặc định nghĩa lại để match với Backend
 */

export interface ChatResponse {
  kind: 'CONTENT' | 'DATA' | 'CONTROL';
  sessionId: string;
  timestamp: string;
  message: string;
  payload?: ContentPayload | DataPayload | ControlPayload;
}

export interface ContentPayload {
  mode: 'CONTENT';
  stats?: readonly { label: string; value: number; unit?: string }[];
}

export interface DataPayload {
  mode: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT';
  list?: {
    items: readonly ListItem[];
    total: number;
  };
  table?: {
    columns: readonly TableColumn[];
    rows: readonly Record<string, TableCell>[];
    previewLimit?: number;
  };
  // ... other fields
}

export interface ControlPayload {
  mode: 'CLARIFY' | 'ERROR' | 'ROOM_PUBLISH';
  questions?: readonly string[];
  details?: string;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: {
    kind?: 'CONTENT' | 'DATA' | 'CONTROL';
    payload?: ContentPayload | DataPayload | ControlPayload;
    sql?: string;
    canonicalQuestion?: string;
  } | null;
  sequenceNumber: number;
  createdAt: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  summary: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
```

## Quick Fix Checklist

- [ ] Fix React Hook call ở `ai-sidebar.tsx:76` - Move hook to top level
- [ ] Replace `any` types với proper types ở `ai-sidebar.tsx:223`
- [ ] Replace `any` types với proper types ở `conversation.store.ts:179`
- [ ] Remove unused import `ChatResponse` từ `conversation.action.ts`
- [ ] Remove unused imports `ChevronLeft`, `ConversationMessage` từ `ai-sidebar.tsx`
- [ ] Remove hoặc sử dụng `createConversation` variable trong `ai-sidebar.tsx`
- [ ] Remove unused imports `MoreVertical` từ `conversation-item.tsx`
- [ ] Remove hoặc sử dụng `showMenu`, `setShowMenu` trong `conversation-item.tsx`
- [ ] Remove unused imports `useEffect`, `cn` từ `conversation-list.tsx`
- [ ] Remove hoặc sử dụng `onClear` prop trong `conversation-list.tsx`
- [ ] Remove hoặc sử dụng `_images` parameter trong `conversation.store.ts`
- [ ] Fix unused `error` variables trong tất cả catch blocks

## Example: Complete Fixed Component

```typescript
// src/components/ai/ai-sidebar.tsx
import { useState } from 'react';
import type { ChatResponse, ConversationMessage } from '@/types/conversation';
import { useAIAssistantStore } from '@/stores/ai-assistant.store';

export const AISidebar = () => {
  // ✅ Hook luôn ở top level
  const store = useAIAssistantStore();
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Sử dụng createConversation hoặc xóa nếu không cần
  const handleCreateConversation = async () => {
    setIsLoading(true);
    try {
      const conversation = await store.createConversation({
        title: 'New Chat'
      });
      // Handle success
    } catch (error) {
      // ✅ Sử dụng error
      console.error('Failed to create conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessage = async (message: string) => {
    try {
      // ✅ Proper typing
      const response: ChatResponse = await store.sendMessage(message);
      // Handle response
    } catch (error) {
      // ✅ Sử dụng error
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div>
      {/* Component content */}
    </div>
  );
};
```

Sau khi sửa xong, chạy lại build để kiểm tra:
```bash
npm run build
# hoặc
pnpm build
```


