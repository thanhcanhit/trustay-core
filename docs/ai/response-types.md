## AI Response Types (Markdown-first)

This document describes the unified response envelope returned by the AI service, aimed at consistent frontend rendering with a Markdown-first approach.

### Envelope
All responses follow the same envelope so frontend can switch by `kind` and `payload.mode`. There is a single Markdown field: `message`.

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

### Kinds
- CONTENT: textual content (Markdown) and optional inline stats
- DATA: structured data, combines LIST/TABLE and optional CHART
- CONTROL: conversation control (clarify/error)

### Payloads

```ts
// CONTENT
interface ContentPayload {
  mode: 'CONTENT';
  stats?: readonly { label: string; value: number; unit?: string }[];
}

// DATA (LIST | TABLE | CHART)
export type EntityType = 'room' | 'post';

export type TableCell = string | number | boolean | null;

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'url' | 'image';
}

export interface ListItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  entity?: EntityType;       // allows frontend to build app path when path is missing
  path?: string;             // app-relative path (preferred when present)
  externalUrl?: string;      // external link fallback
  extra?: Record<string, string | number | boolean>;
}

export interface DataPayload {
  mode: 'LIST' | 'TABLE' | 'CHART';
  list?: {
    items: readonly ListItem[];
    total: number;
  };
  table?: {
    columns: readonly TableColumn[];
    rows: readonly Record<string, TableCell>[]; // primitives only
    previewLimit?: number;   // rows included for preview (max 50)
  };
  chart?: {
    mimeType: 'image/png';
    url: string;            // QuickChart URL
    width: number;
    height: number;
    alt?: string;
  };
}

// CONTROL
export interface ControlPayload {
  mode: 'CLARIFY' | 'ERROR';
  questions?: readonly string[];  // CLARIFY suggestions
  code?: string;                   // error code
  details?: string;                // developer-friendly error info
}
```

### Frontend Mapping
- Always render `message` immediately for a good baseline.
- If enhancing with structured UI:
  - kind === DATA && payload.mode === 'LIST' → render list/cards. Use `item.path`. If missing, derive from `entity` + `id`, else fall back to `externalUrl`.
  - kind === DATA && payload.mode === 'TABLE' → render table using provided columns and rows. Respect `previewLimit` (max 50 rows).
  - kind === DATA && payload.mode === 'CHART' → render `<img src=payload.chart.url>`.
  - kind === CONTENT → show Markdown. If `stats` present, render KPI chips.
  - kind === CONTROL → show Markdown; for CLARIFY, optionally render quick questions.

### Paths and Entities
- Only the following entities support in-app paths:
  - room → `/rooms/:id`
  - post → `/posts/:id`
- Items will include `path` when possible. If `path` is missing but `entity` is `room` or `post` and `id` exists, frontend can derive an app-relative route.

### Markdown Contract
- All responses include `message` (no raw HTML). Images use absolute URLs.
- When a structured payload is present, `message` is a brief friendly intro (no duplicate table/list/chart rendering).

### Chart Rendering (QuickChart)
- The service uses QuickChart to generate chart URLs when the data shape is suitable and the user intent suggests visualization/statistics.
- Frontend can directly embed the image via `<img src>`.
- Reference: `https://quickchart.io`

Example URL form:
```
https://quickchart.io/chart?c={...encoded Chart.js config...}&w=800&h=400
```

### Examples

CONTENT
```json
{
  "kind": "CONTENT",
  "message": "Doanh thu tháng 10 tăng 12% so với tháng 9.",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": { "mode": "CONTENT", "stats": [{ "label": "MoM", "value": 12, "unit": "%" }] }
}
```

DATA (LIST rooms)
```json
{
  "kind": "DATA",
  "message": "Mình tìm được vài phòng phù hợp, bạn xem thử nhé:",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": {
    "mode": "LIST",
    "list": {
      "total": 2,
      "items": [
        { "id": "r1", "title": "Phòng A", "entity": "room", "path": "/rooms/r1" },
        { "id": "r2", "title": "Phòng B", "entity": "room", "path": "/rooms/r2" }
      ]
    }
  }
}
```

DATA (TABLE preview)
```json
{
  "kind": "DATA",
  "message": "Dưới đây là bản xem nhanh dữ liệu:",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": {
    "mode": "TABLE",
    "table": {
      "columns": [ { "key": "name", "label": "Name", "type": "string" }, { "key": "price", "label": "Price", "type": "number" } ],
      "rows": [ { "name": "A", "price": 10 }, { "name": "B", "price": 20 }, { "name": "C", "price": 30 } ],
      "previewLimit": 50
    }
  }
}
```

DATA (CHART via QuickChart URL)
```json
{
  "kind": "DATA",
  "message": "Mình đã vẽ biểu đồ để bạn xem nhanh xu hướng:",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": {
    "mode": "CHART",
    "chart": { "mimeType": "image/png", "url": "https://quickchart.io/chart?c=...&w=800&h=400", "width": 800, "height": 400, "alt": "Chart" }
  }
}
```

CONTROL (Clarify)
```json
{
  "kind": "CONTROL",
  "message": "Mình cần thêm chút thông tin để hỗ trợ chính xác: bạn muốn xem phòng khu vực nào?",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": { "mode": "CLARIFY", "questions": ["Quận/huyện?", "Khoảng giá?"] }
}
```


