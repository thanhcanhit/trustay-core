## AI Module – Frontend Handoff

This document describes how the frontend integrates with the AI module exposed by the backend (`ai.controller.ts` + `ai.service.ts`). It includes endpoints, request/response formats, session behavior, and examples.

### High-level Overview
- The AI module provides a multi-agent flow:
  - Conversational Agent: crafts natural responses and determines if SQL is needed.
  - SQL Generation Agent: generates and executes SQL via Prisma when appropriate.
  - Response Generator: merges conversational output with SQL results.
- Sessions are derived from `userId` (if authenticated) or client IP (if anonymous). Sessions are kept in-memory with auto-cleanup.

### Session & Limits
- Session ID: `user_<userId>` when logged in; otherwise `ip_<clientIp>`.
- Session timeout: 30 minutes idle.
- Max messages kept per session: 20 (system messages preserved).
- AI config (defaults; may be tuned server-side):
  - model: `gemini-2.0-flash`
  - temperature: `0.1`
  - maxTokens: `500`
  - SQL result limit: `100` rows

### Authentication
- Guard: `OptionalJwtAuthGuard`.
- All endpoints work for both authenticated and anonymous users.
- When authenticated, pass standard Bearer token. Anonymous usage relies on the client IP.

---

## Endpoints

### 1) POST /ai/chat
- Purpose: Chat with AI. Returns either a conversational answer or a combined answer with SQL execution results.
- Auth: Optional (Bearer).
- Query params:
  - `query` (string, required): the user’s question/prompt.

Example (fetch):
```ts
await fetch('/api/ai/chat?query=' + encodeURIComponent('Tìm phòng trọ giá rẻ ở quận 1'), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${token}`, // optional
  },
});
```

Success response:
```json
{
  "success": true,
  "data": {
    "sessionId": "user_56ea75bb-3175-49b2-a879-24895269c121",
    "message": "Tôi đã tìm thấy 5 phòng phù hợp...",
    "sql": "SELECT ...",               
    "results": [ { "...": "..." } ],  
    "count": 5,
    "timestamp": "2025-10-31T12:34:56.000Z",
    "validation": { "isValid": true }
  }
}
```

Conversational-only response (not enough info yet):
```json
{
  "success": true,
  "data": {
    "sessionId": "ip_127_0_0_1",
    "message": "Bạn muốn tìm phòng ở quận nào và mức giá tối đa?",
    "timestamp": "2025-10-31T12:34:56.000Z",
    "validation": {
      "isValid": false,
      "needsClarification": true,
      "needsIntroduction": false
    }
  }
}
```

Error response:
```json
{
  "success": false,
  "error": "Failed to process chat message",
  "message": "<internal error message>",
  "query": "<your query>"
}
```

Client expectations:
- Read `data.message` to render the assistant text.
- If `data.sql` exists, you can show an expandable SQL panel and tabular `data.results`.
- Use `data.validation` to decide whether to prompt users for more info.

---

### 2) GET /ai/chat/history
- Purpose: Retrieve the current session chat history for display.
- Auth: Optional (Bearer).

Example:
```ts
await fetch('/api/ai/chat/history', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${token}`,
  },
});
```

Success response:
```json
{
  "success": true,
  "data": {
    "sessionId": "ip_127_0_0_1",
    "messages": [
      { "id": "ip_127_0_0_1_0", "role": "user", "content": "...", "timestamp": "..." },
      { "id": "ip_127_0_0_1_1", "role": "assistant", "content": "...", "timestamp": "..." }
    ]
  }
}
```

---

### 3) DELETE /ai/chat/history
- Purpose: Clear the current session chat history.
- Auth: Optional (Bearer).

Example:
```ts
await fetch('/api/ai/chat/history', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${token}`,
  },
});
```

Success response:
```json
{
  "success": true,
  "data": { "success": true },
  "message": "Chat history cleared successfully"
}
```

---

### 4) POST /ai/text2sql (legacy)
- Purpose: Direct text-to-SQL generation + execution (no conversation context).
- Auth: Optional (Bearer).
- Body:
```json
{ "query": "Tìm phòng trọ giá dưới 3 triệu ở quận 1" }
```

Example:
```ts
await fetch('/api/ai/text2sql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ query: 'Tìm phòng trọ giá dưới 3 triệu ở quận 1' })
});
```

Success response:
```json
{
  "sql": "SELECT ...",
  "results": [ { "...": "..." } ]
}
```

Error response:
```json
{
  "error": "Failed to generate or execute SQL",
  "message": "<internal error message>",
  "query": "..."
}
```

---

## Types Returned (Frontend Contract)

`ChatResponse` (when success):
```ts
type ChatResponse = {
  sessionId: string;
  message: string;              // assistant message for UI
  sql?: string;                 // present when SQL path executed
  results?: Array<Record<string, unknown>>; // SQL results for table view
  count?: number;               // number of rows returned
  timestamp: string;            // ISO string
  validation?: {
    isValid: boolean;
    needsClarification?: boolean;
    needsIntroduction?: boolean;
  };
};
```

`HistoryResponse`:
```ts
type HistoryResponse = {
  sessionId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
};
```

## UI/UX Guidance
- Always render `data.message`.
- If `data.sql` exists, optionally show a collapsible "Details" with SQL and a grid for `data.results`.
- Use `validation` flags to prompt users for missing filters (e.g., location, budget).
- Keep the same request headers across requests to preserve the session binding (auth + IP).

## Error Handling
- On `success=false`, display `message` as a user-friendly error and optionally expose `error` in dev builds.
- Network errors should be retried with exponential backoff when appropriate.

## Notes
- Sessions are in-memory in the API instance. In multi-instance deployments, sticky sessions or a shared session store may be needed to keep continuity.
- SQL results are capped by backend configuration (`limit: 100`). Paginate at the UI level if needed by asking follow-up queries.


