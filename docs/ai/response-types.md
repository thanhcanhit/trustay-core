## AI Response Types (Markdown-first)

This document describes the unified response envelope returned by the AI service, aimed at consistent frontend rendering with a Markdown-first approach.

### Envelope
All responses follow the same envelope so frontend can switch by `kind` and `payload.mode` while always having Markdown ready to render.

```ts
interface ChatEnvelope {
  kind: 'CONTENT' | 'DATA' | 'CONTROL';
  markdown: string;            // Primary Markdown to render
  timestamp: string;           // ISO string
  sessionId: string;
  meta?: Record<string, string | number | boolean>;

  // Backward-compatible fields (optional)
  message?: string;
  sql?: string;
  results?: unknown;
  count?: number;
  validation?: {
    isValid: boolean;
    reason?: string;
    needsClarification?: boolean;
    needsIntroduction?: boolean;
    clarificationQuestion?: string;
  };
  error?: string;

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
type EntityType = 'room' | 'post';

type TableCell = string | number | boolean | null;

interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'url' | 'image';
}

interface ListItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  entity?: EntityType;       // lets frontend build app path when path is missing
  path?: string;             // app-relative path (preferred if present)
  externalUrl?: string;      // external link fallback
  extra?: Record<string, string | number | boolean>;
}

interface DataPayload {
  mode: 'LIST' | 'TABLE' | 'CHART';
  list?: {
    items: readonly ListItem[];
    total: number;
  };
  table?: {
    columns: readonly TableColumn[];
    rows: readonly Record<string, TableCell>[];
    previewLimit?: number;   // rows included for preview
  };
  chart?: {
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    base64?: string;         // not used with QuickChart URL
    url?: string;            // e.g., QuickChart URL
    width: number;
    height: number;
    alt?: string;
  };
}

// CONTROL
interface ControlPayload {
  mode: 'CLARIFY' | 'ERROR';
  questions?: readonly string[];  // CLARIFY suggestions
  code?: string;                   // error code
  details?: string;                // developer-friendly error info
}
```

### Frontend Mapping
- Always render `markdown` immediately for a good baseline.
- If enhancing with structured UI:
  - kind === DATA && payload.mode === 'LIST' → render list/cards. Prefer `item.path`, else derive from `entity` + `id`, else `externalUrl`.
  - kind === DATA && payload.mode === 'TABLE' → render table using provided columns and rows. Respect `previewLimit`.
  - kind === DATA && payload.mode === 'CHART' → render `<img src=payload.chart.url>`.
  - kind === CONTENT → show Markdown. If `stats` present, render KPI chips.
  - kind === CONTROL → show Markdown; for CLARIFY, optionally render quick questions.

### Paths and Entities
- Only the following entities support in-app paths:
  - room → `/rooms/:id`
  - post → `/posts/:id`
- Items should include `path` when possible; otherwise, include `entity` and `id` so frontend can build the route.

### Markdown Contract
- All responses include `markdown` (no raw HTML). Images use data URIs or absolute URLs.
- DATA responses also include a Markdown summary (list bullets or table preview) for graceful fallback.

### Chart Rendering (QuickChart)
- The service uses QuickChart to generate chart URLs when the data shape is suitable (one label-like and one numeric column).
- Frontend can directly embed via Markdown or `<img>`.
- Reference: [QuickChart](https://quickchart.io/)

Example URL form:
```
https://quickchart.io/chart?width=800&height=400&chart={...JSON Chart.js config...}
```

### Examples

CONTENT
```json
{
  "kind": "CONTENT",
  "markdown": "# Summary\n\nDoanh thu tháng 10 tăng 12% so với tháng 9.",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": { "mode": "CONTENT", "stats": [{ "label": "MoM", "value": 12, "unit": "%" }] }
}
```

DATA (LIST rooms)
```json
{
  "kind": "DATA",
  "markdown": "# Kết quả (2)\n\n- [Phòng A](/rooms/r1)\n- [Phòng B](/rooms/r2)",
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
  "markdown": "# Data Preview (3 rows)\n\n| Name | Price |\n| --- | --- |\n| A | 10 |\n| B | 20 |\n| C | 30 |",
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
  "markdown": "# Chart\n\n![Chart](https://quickchart.io/chart?width=800&height=400&chart=...)",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": {
    "mode": "CHART",
    "chart": { "mimeType": "image/png", "url": "https://quickchart.io/chart?width=800&height=400&chart=...", "width": 800, "height": 400, "alt": "Chart" }
  }
}
```

CONTROL (Clarify)
```json
{
  "kind": "CONTROL",
  "markdown": "# Clarification\n\nBạn muốn xem phòng khu vực nào?",
  "timestamp": "2025-10-31T10:20:00.000Z",
  "sessionId": "user_123",
  "payload": { "mode": "CLARIFY", "questions": ["Quận/huyện?", "Khoảng giá?"] }
}
```


