## AI Structured Response Plan

### 1) Goals
- Provide deterministic, consistent end-user responses with clear types.
- Support multiple response kinds: text, list (links/images), table, and optional chart (via URL).
- Ensure all end-user facing text is Markdown-formatted by default (Markdown-first contract) using a single field `message`.

### 2) Current State (as-is)
- Multi-agent flow already exists in `AiService`:
  - ConversationalAgent assesses `readyForSql`.
  - SqlGenerationAgent generates and executes SQL.
  - ResponseGenerator composes final text.
- Output was free-form and included legacy fields (`sql`, `results`, `count`, `validation`, `error`) not needed by the frontend.

### 3) Final Output Schema (Unified Envelope)
- All responses conform to:

```ts
interface ChatEnvelope {
  kind: 'CONTENT' | 'DATA' | 'CONTROL';
  message: string;             // Primary Markdown to render
  timestamp: string;           // ISO string
  sessionId: string;
  meta?: Record<string, string | number | boolean>;
  payload?: ContentPayload | DataPayload | ControlPayload;
}
```

- CONTENT payload:
```ts
interface ContentPayload {
  mode: 'CONTENT';
  stats?: readonly { label: string; value: number; unit?: string }[];
}
```

- DATA payload (LIST | TABLE | CHART):
```ts
export type EntityType = 'room' | 'post';

export interface ListItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  entity?: EntityType;
  path?: string;            // preferred when present
  externalUrl?: string;
  extra?: Record<string, string | number | boolean>;
}

export type TableCell = string | number | boolean | null;

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'url' | 'image';
}

export interface DataPayload {
  mode: 'LIST' | 'TABLE' | 'CHART';
  list?: { items: readonly ListItem[]; total: number };
  table?: { columns: readonly TableColumn[]; rows: readonly Record<string, TableCell>[]; previewLimit?: number };
  chart?: { mimeType: 'image/png'; url: string; width: number; height: number; alt?: string };
}
```

- CONTROL payload:
```ts
export interface ControlPayload {
  mode: 'CLARIFY' | 'ERROR';
  questions?: readonly string[];
  code?: string;
  details?: string;
}
```

### 4) Design Principles
- Single Markdown field `message` (no separate `markdown`).
- No legacy fields in API responses (`sql`, `results`, `count`, `validation`, `error`).
- List items for `room`/`post` include `path` when possible; otherwise `entity` + `id` allow deriving the route.
- Tables include only important, renderable primitive fields (no nested objects), capped to 50 rows; columns capped to 8 with priority keys.
- Charts use QuickChart URLs (Top 10 values) and are generated only when the intent suggests visualization/statistics.

### 5) Intent & Mode Resolution
- Mode is resolved before SQL execution via intent keywords:
  - LIST for search/browse intents (e.g., rooms/posts, location filters).
  - CHART only when the query explicitly suggests visualization/statistics.
  - Otherwise TABLE.

### 6) Session Storage
- Store only `message` strings (Markdown) in `ChatSession.messages` for assistant messages to reduce memory and avoid duplication.

### 7) Frontend Contract (High-level)
- Render `message` immediately.
- For `kind: 'DATA'`:
  - `mode: 'LIST'`: render list/cards using `path` when present.
  - `mode: 'TABLE'`: render table from `columns` + `rows` (primitive cells only); respect `previewLimit`.
  - `mode: 'CHART'`: render `<img src=payload.chart.url>`.
- For `kind: 'CONTROL'`: render `message`; optionally show quick `questions` for CLARIFY.

### 8) Localization
- All user-facing text is Vietnamese (labels and intros). Column headers are localized via `toVietnameseLabel`.

### 9) Limits
- Charts: top 10 values.
- Table preview: max 50 rows, max 8 columns (priority keys first).

### 10) Rollout & Compatibility
- Backend no longer returns `sql`, `results`, `count`, `validation`, or `error`.
- Frontend should read `message` for Markdown and switch UI based on `kind` and `payload.mode`.

### 11) Examples (short)

CONTENT
```json
{ "kind": "CONTENT", "message": "Xin chào 👋", "timestamp": "...", "sessionId": "...", "payload": { "mode": "CONTENT" } }
```

DATA/LIST (rooms)
```json
{ "kind": "DATA", "message": "Mình tìm được vài phòng phù hợp, bạn xem thử nhé:", "timestamp": "...", "sessionId": "...", "payload": { "mode": "LIST", "list": { "total": 2, "items": [ { "id": "r1", "title": "Phòng A", "entity": "room", "path": "/rooms/r1" }, { "id": "r2", "title": "Phòng B", "entity": "room", "path": "/rooms/r2" } ] } } }
```

DATA/TABLE (preview)
```json
{ "kind": "DATA", "message": "Dưới đây là bản xem nhanh dữ liệu:", "timestamp": "...", "sessionId": "...", "payload": { "mode": "TABLE", "table": { "columns": [ { "key": "name", "label": "Tên", "type": "string" } ], "rows": [ { "name": "A" } ], "previewLimit": 50 } } }
```

DATA/CHART (QuickChart)
```json
{ "kind": "DATA", "message": "Mình đã vẽ biểu đồ để bạn xem nhanh xu hướng:", "timestamp": "...", "sessionId": "...", "payload": { "mode": "CHART", "chart": { "mimeType": "image/png", "url": "https://quickchart.io/chart?c=...&w=800&h=400", "width": 800, "height": 400, "alt": "Chart" } } }
```

CONTROL/CLARIFY
```json
{ "kind": "CONTROL", "message": "Mình cần thêm chút thông tin để hỗ trợ chính xác: bạn muốn xem phòng khu vực nào?", "timestamp": "...", "sessionId": "...", "payload": { "mode": "CLARIFY", "questions": ["Quận/huyện?", "Khoảng giá?"] } }
```


