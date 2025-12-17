# Frontend Conversation API Documentation

Tài liệu này mô tả cách Frontend tích hợp với Conversation API của Trustay-AI để quản lý hội thoại chat với AI.

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Response Types](#response-types)
5. [Flow sử dụng](#flow-sử-dụng)
6. [Examples](#examples)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Tổng quan

Conversation API cho phép Frontend:
- Tạo và quản lý nhiều cuộc hội thoại độc lập
- Lưu trữ lịch sử chat persistent
- Tự động tạo tiêu đề cho cuộc hội thoại
- Tối ưu context với rolling summary cho hội thoại dài

**Base URL**: `/api/ai/conversations`

**Authentication**: Optional (JWT Bearer token nếu user đã đăng nhập)

---

## Authentication

### Authenticated Users
- Gửi JWT token trong header: `Authorization: Bearer <token>`
- Mỗi user có thể có nhiều conversations riêng biệt
- Conversations được lưu theo `userId`

### Anonymous Users
- Không cần token
- Conversations được lưu theo IP address
- **Lưu ý**: Anonymous conversations sẽ bị mất khi IP thay đổi

---

## API Endpoints

### 1. List Conversations

Lấy danh sách tất cả conversations của user hiện tại.

```http
GET /api/ai/conversations?limit=50
```

**Query Parameters:**
- `limit` (optional): Số lượng conversations tối đa (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Tìm phòng Gò Vấp",
        "summary": "User đang tìm phòng trọ ở Gò Vấp với giá dưới 3 triệu",
        "lastMessageAt": "2024-01-15T10:30:00.000Z",
        "messageCount": 5,
        "createdAt": "2024-01-15T09:00:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

**Lưu ý**: Nếu user chưa đăng nhập, sẽ trả về `items: []`.

---

### 2. Create Conversation

Tạo một conversation mới. Có thể tạo với message đầu tiên hoặc chỉ tạo conversation rỗng.

```http
POST /api/ai/conversations
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Tìm phòng Gò Vấp",           // Optional: Custom title
  "initialMessage": "Tìm phòng trọ giá rẻ ở quận 1"  // Optional: First message
}
```

**Response (không có initialMessage):**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-123",
      "title": "New Chat",
      "summary": null,
      "messageCount": 0,
      "lastMessageAt": null,
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**Response (có initialMessage):**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "New Chat",
      "messageCount": 2  // System message + User message
    },
    "response": {
      "kind": "DATA",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-15T10:00:05.123Z",
      "message": "Tôi đã tìm thấy 5 phòng trọ phù hợp với yêu cầu của bạn...",
      "payload": {
        "mode": "TABLE",
        "sql": "SELECT * FROM rooms WHERE district = 'Quận 1' AND price <= 3000000",
        "results": [...],
        "columns": [...]
      }
    }
  }
}
```

---

### 3. Get Conversation Details

Lấy thông tin chi tiết của một conversation bao gồm tất cả messages.

```http
GET /api/ai/conversations/:conversationId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-123",
    "title": "Tìm phòng Gò Vấp",
    "summary": "User đang tìm phòng trọ ở Gò Vấp",
    "messageCount": 5,
    "lastMessageAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T09:00:00.000Z",
    "messages": [
      {
        "id": "msg-1",
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "role": "system",
        "content": "Bạn là trợ lý AI của Trustay...",
        "metadata": null,
        "sequenceNumber": 1,
        "createdAt": "2024-01-15T09:00:00.000Z"
      },
      {
        "id": "msg-2",
        "role": "user",
        "content": "Tìm phòng trọ giá rẻ ở quận 1",
        "metadata": null,
        "sequenceNumber": 2,
        "createdAt": "2024-01-15T09:00:05.000Z"
      },
      {
        "id": "msg-3",
        "role": "assistant",
        "content": "Tôi đã tìm thấy 5 phòng trọ...",
        "metadata": {
          "kind": "DATA",
          "payload": {
            "mode": "TABLE",
            "sql": "SELECT * FROM rooms WHERE...",
            "results": [...]
          },
          "sql": "SELECT * FROM rooms WHERE...",
          "canonicalQuestion": "Tìm phòng trọ giá rẻ ở quận 1"
        },
        "sequenceNumber": 3,
        "createdAt": "2024-01-15T09:00:10.000Z"
      }
    ]
  }
}
```

---

### 4. Send Message

Gửi một message trong conversation và nhận phản hồi từ AI.

```http
POST /api/ai/conversations/:conversationId/messages
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Tăng giá lên 5 triệu",
  "currentPage": "/rooms/tuyenquan-go-vap-phong-ap1443"  // Optional: For context
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "kind": "DATA",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:05.123Z",
    "message": "Tôi đã cập nhật tìm kiếm với giá tối đa 5 triệu...",
    "payload": {
      "mode": "TABLE",
      "sql": "SELECT * FROM rooms WHERE district = 'Quận 1' AND price <= 5000000",
      "results": [
        {
          "id": "room-1",
          "title": "Phòng trọ đẹp quận 1",
          "price": 4500000,
          "district": "Quận 1"
        }
      ],
      "columns": [
        { "key": "id", "label": "ID" },
        { "key": "title", "label": "Tiêu đề" },
        { "key": "price", "label": "Giá" }
      ]
    }
  }
}
```

---

### 5. Get Messages

Lấy danh sách messages từ một conversation.

```http
GET /api/ai/conversations/:conversationId/messages?limit=100
```

**Query Parameters:**
- `limit` (optional): Số lượng messages tối đa (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "msg-1",
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "role": "user",
        "content": "Tìm phòng trọ giá rẻ",
        "metadata": null,
        "sequenceNumber": 1,
        "createdAt": "2024-01-15T09:00:05.000Z"
      }
    ],
    "total": 1
  }
}
```

**Lưu ý**: Messages được sắp xếp theo `sequenceNumber` DESC (mới nhất trước).

---

### 6. Update Conversation Title

Cập nhật tiêu đề của conversation.

```http
PATCH /api/ai/conversations/:conversationId/title
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Tìm phòng mới"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Tìm phòng mới"
  }
}
```

---

### 7. Delete Conversation

Xóa một conversation và tất cả messages của nó.

```http
DELETE /api/ai/conversations/:conversationId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### 8. Clear Messages

Xóa tất cả messages trong conversation nhưng giữ lại conversation.

```http
POST /api/ai/conversations/:conversationId/clear
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Response Types

### ChatResponse Structure

Tất cả responses từ AI đều có cấu trúc `ChatResponse`:

```typescript
interface ChatResponse {
  kind: 'DATA' | 'CONTENT' | 'CONTROL';
  sessionId: string;
  timestamp: string; // ISO 8601 format
  message: string;   // Human-readable message
  payload?: {
    mode?: 'TABLE' | 'LIST' | 'CHART' | 'INSIGHT' | 'CONTENT';
    sql?: string;
    results?: any[];
    columns?: Array<{ key: string; label: string }>;
    // ... other fields depending on kind
  };
}
```

### Response Kinds

#### 1. `DATA` - SQL Query Results
Khi AI trả về kết quả từ database:

```json
{
  "kind": "DATA",
  "message": "Tôi đã tìm thấy 5 phòng trọ...",
  "payload": {
    "mode": "TABLE",
    "sql": "SELECT * FROM rooms WHERE...",
    "results": [...],
    "columns": [...]
  }
}
```

**Modes:**
- `TABLE`: Hiển thị dạng bảng
- `LIST`: Hiển thị dạng danh sách
- `CHART`: Dữ liệu cho biểu đồ
- `INSIGHT`: Phân tích insights

#### 2. `CONTENT` - General Chat
Khi AI trả lời câu hỏi thông thường:

```json
{
  "kind": "CONTENT",
  "message": "Xin chào! Tôi có thể giúp gì cho bạn?",
  "payload": {
    "mode": "CONTENT"
  }
}
```

#### 3. `CONTROL` - System Messages
Các message điều khiển từ hệ thống:

**CLARIFY** - Yêu cầu làm rõ:
```json
{
  "kind": "CONTROL",
  "message": "Bạn muốn tìm phòng ở quận nào?",
  "payload": {
    "mode": "CLARIFY",
    "questions": [
      "Bạn muốn tìm phòng ở quận nào? (ví dụ: Quận 1, Quận 7)"
    ]
  }
}
```

**ERROR** - Lỗi:
```json
{
  "kind": "CONTROL",
  "message": "Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn",
  "payload": {
    "mode": "ERROR",
    "details": "SQL generation failed"
  }
}
```

---

## Flow sử dụng

### Flow 1: Tạo conversation mới và chat

```typescript
// 1. Tạo conversation mới với message đầu tiên
const createResponse = await fetch('/api/ai/conversations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Nếu đã đăng nhập
  },
  body: JSON.stringify({
    initialMessage: 'Tìm phòng trọ giá rẻ ở quận 1'
  })
});

const { data } = await createResponse.json();
const conversationId = data.conversation.id;

// 2. Nếu có response từ initialMessage, hiển thị ngay
if (data.response) {
  displayMessage(data.response);
}

// 3. Gửi message tiếp theo
const sendResponse = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: 'Tăng giá lên 5 triệu',
    currentPage: window.location.pathname // Optional: để AI biết context
  })
});

const { data: chatData } = await sendResponse.json();
displayMessage(chatData);
```

### Flow 2: Load conversation cũ và tiếp tục chat

```typescript
// 1. Lấy danh sách conversations
const listResponse = await fetch('/api/ai/conversations?limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: listData } = await listResponse.json();
const conversations = listData.items;

// 2. Chọn một conversation
const selectedConversation = conversations[0];

// 3. Load messages của conversation đó
const messagesResponse = await fetch(
  `/api/ai/conversations/${selectedConversation.id}/messages?limit=100`
);
const { data: messagesData } = await messagesResponse.json();

// 4. Hiển thị messages
messagesData.items.forEach(msg => {
  displayMessage(msg);
});

// 5. Gửi message mới
const newMessageResponse = await fetch(
  `/api/ai/conversations/${selectedConversation.id}/messages`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'Tìm thêm phòng ở quận 7'
    })
  }
);
```

---

## Examples

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  createdAt: string;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Load conversations list
  const loadConversations = async () => {
    try {
      const response = await fetch('/api/ai/conversations?limit=50', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const { data } = await response.json();
      setConversations(data.items);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  // Create new conversation
  const createConversation = async (initialMessage?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          initialMessage
        })
      });
      const { data } = await response.json();
      const conversationId = data.conversation.id;
      setCurrentConversation(conversationId);
      
      // If initial message was sent, add response to messages
      if (data.response) {
        setMessages([
          {
            id: 'temp-user',
            role: 'user',
            content: initialMessage!,
            createdAt: new Date().toISOString()
          },
          {
            id: 'temp-assistant',
            role: 'assistant',
            content: data.response.message,
            metadata: data.response.payload,
            createdAt: data.response.timestamp
          }
        ]);
      }
      
      await loadConversations();
      return conversationId;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/ai/conversations/${conversationId}/messages?limit=100`
      );
      const { data } = await response.json();
      setMessages(data.items.reverse()); // Reverse để hiển thị từ cũ đến mới
      setCurrentConversation(conversationId);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (message: string, currentPage?: string) => {
    if (!currentConversation) {
      // Create new conversation if none exists
      await createConversation(message);
      return;
    }

    setLoading(true);
    try {
      // Add user message to UI immediately (optimistic update)
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);

      const response = await fetch(
        `/api/ai/conversations/${currentConversation}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            message,
            currentPage
          })
        }
      );

      const { data } = await response.json();
      
      // Replace temp message with real one and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== userMessage.id);
        return [
          ...filtered,
          {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: message,
            createdAt: new Date().toISOString()
          },
          {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: data.message,
            metadata: data.payload,
            createdAt: data.timestamp
          }
        ];
      });

      await loadConversations(); // Refresh conversation list
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    try {
      await fetch(`/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      await loadConversations();
      if (currentConversation === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    createConversation,
    loadMessages,
    sendMessage,
    deleteConversation
  };
}
```

---

## Error Handling

Tất cả API endpoints đều trả về format nhất quán:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common Error Codes

- **400 Bad Request**: Request body không hợp lệ
- **401 Unauthorized**: Token không hợp lệ hoặc hết hạn
- **403 Forbidden**: User không có quyền truy cập conversation này
- **404 Not Found**: Conversation không tồn tại
- **500 Internal Server Error**: Lỗi server

### Error Handling Example

```typescript
async function sendMessage(conversationId: string, message: string) {
  try {
    const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });

    const result = await response.json();

    if (!result.success) {
      // Handle error
      if (result.error === 'Conversation not found') {
        // Conversation đã bị xóa, tạo mới
        return await createConversation(message);
      }
      throw new Error(result.message || result.error);
    }

    return result.data;
  } catch (error) {
    console.error('Failed to send message:', error);
    // Show error to user
    showErrorNotification(error.message);
    throw error;
  }
}
```

---

## Best Practices

### 1. Optimistic Updates
Thêm user message vào UI ngay lập tức, sau đó cập nhật khi nhận response:

```typescript
// Add user message immediately
setMessages(prev => [...prev, userMessage]);

// Send to API
const response = await sendMessage(message);

// Update with real data
setMessages(prev => {
  const updated = [...prev];
  updated[updated.length - 1] = response.userMessage;
  updated.push(response.assistantMessage);
  return updated;
});
```

### 2. Loading States
Luôn hiển thị loading state khi đang gửi message:

```typescript
const [isSending, setIsSending] = useState(false);

const handleSend = async () => {
  setIsSending(true);
  try {
    await sendMessage(message);
  } finally {
    setIsSending(false);
  }
};
```

### 3. Error Recovery
Xử lý các trường hợp lỗi phổ biến:

```typescript
if (error.message.includes('Conversation not found')) {
  // Tạo conversation mới
  await createConversation(message);
} else if (error.message.includes('Unauthorized')) {
  // Redirect to login
  redirectToLogin();
} else {
  // Show generic error
  showError('Đã xảy ra lỗi. Vui lòng thử lại.');
}
```

### 4. Context Awareness
Luôn gửi `currentPage` để AI hiểu context:

```typescript
const currentPage = window.location.pathname; // e.g., "/rooms/abc-123"

await sendMessage(message, currentPage);
```

### 5. Message Ordering
Messages được trả về theo `sequenceNumber` DESC (mới nhất trước). Đảo ngược để hiển thị:

```typescript
const messages = response.data.items.reverse(); // Cũ nhất trước
```

### 6. Auto-title Handling
Tiêu đề conversation sẽ được tự động tạo sau message đầu tiên. Có thể listen để update UI:

```typescript
// Poll conversation title sau khi gửi message đầu tiên
useEffect(() => {
  if (conversation.messageCount === 2) {
    // Wait a bit for auto-title job
    setTimeout(async () => {
      const updated = await getConversation(conversation.id);
      setConversationTitle(updated.title);
    }, 2000);
  }
}, [conversation.messageCount]);
```

### 7. Pagination
Khi conversation dài, chỉ load recent messages:

```typescript
// Load last 50 messages
const messages = await getMessages(conversationId, 50);

// Load more khi scroll lên
const loadMore = async () => {
  const olderMessages = await getMessages(conversationId, 100, messages[0].sequenceNumber);
  setMessages(prev => [...olderMessages, ...prev]);
};
```

---

## Migration từ Old API

Nếu đang sử dụng old API (`/api/ai/chat`), migration sang new API:

### Old API (vẫn hoạt động)
```typescript
// Auto session management
const response = await fetch('/api/ai/chat?query=Tìm phòng trọ');
```

### New API (recommended)
```typescript
// Explicit conversation management
const conversation = await createConversation();
const response = await sendMessage(conversation.id, 'Tìm phòng trọ');
```

**Lợi ích của New API:**
- Quản lý nhiều conversations
- Lưu lịch sử persistent
- Tự động tạo tiêu đề
- Tối ưu context với summary

---

## Support

Nếu có vấn đề hoặc câu hỏi, vui lòng liên hệ team Backend hoặc tạo issue trên repository.



