## AI Structured Response Plan

### 1) Goals
- Provide deterministic, consistent end-user responses with clear types.
- Support multiple response kinds: text, list (links/images), statistics, table, and optional chart (base64 image).
- Keep API backward compatible while enabling typed rendering on the frontend.
- Ensure all end-user facing text is Markdown-formatted by default (Markdown-first contract).

### 2) Current State (as-is)
- Multi-agent flow already exists in `AiService`:
  - ConversationalAgent assesses `readyForSql`.
  - SqlGenerationAgent generates and executes SQL.
  - ResponseGenerator composes final text.
- Output is mostly free-form text with `message`, `results`, `count`, but lacks a stable shape to distinguish list/stats/table.

### 3) Proposed Output Schema
Introduce a discriminated union for `ChatResponse` with `kind` to guarantee a stable contract:

```ts
// Key idea (types live in src/ai/types/chat.types.ts)
export type ChatResponse =
  | TextChatResponse
  | ListChatResponse
  | StatsChatResponse
  | TableChatResponse
  | ChartChatResponse; // optional

interface BaseChatResponse {
  sessionId: string;
  message: string;
  timestamp: string;
  sql?: string;
  error?: string;
  validation?: {
    isValid: boolean;
    needsClarification?: boolean;
    needsIntroduction?: boolean;
  };
  count?: number;
  results?: unknown[];
  /**
   * Optional, pre-rendered Markdown for immediate UI rendering.
   * Always safe text (no HTML) for CSP compliance; frontend can enhance.
   */
  markdown?: string;
}

interface TextChatResponse extends BaseChatResponse {
  kind: 'TEXT';
}

interface ListItem {
  title: string;
  url?: string;
  imageUrl?: string;
  description?: string;
  extra?: Record<string, string | number | boolean>;
}

interface ListChatResponse extends BaseChatResponse {
  kind: 'LIST';
  payload: { items: readonly ListItem[]; total: number };
}

interface StatsItem { label: string; value: number; unit?: string }

interface StatsChatResponse extends BaseChatResponse {
  kind: 'STATS';
  payload: { summary: readonly StatsItem[] };
}

type TableCell = string | number | boolean | null;

interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'url' | 'image';
}

interface TableChatResponse extends BaseChatResponse {
  kind: 'TABLE';
  payload: {
    columns: readonly TableColumn[];
    rows: readonly Record<string, TableCell>[];
    previewLimit?: number;
  };
}

interface ChartImage {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64: string; // no data: prefix
  width: number;
  height: number;
  alt?: string;
}

interface ChartChatResponse extends BaseChatResponse {
  kind: 'CHART';
  payload: { image: ChartImage; meta?: { title?: string; type?: 'bar' | 'line' | 'pie' | 'doughnut' } };
}
```

Notes:
- `kind` dictates downstream UI rendering.
- `message` remains as a natural-language explanation.
- `results` and `sql` kept for debugging/advanced UI use.
- `markdown` provides a ready-to-render Markdown block (frontend can ignore and synthesize its own from payload if preferred).

### 3.1) Markdown-first Contract and Templates
- Every response must include a Markdown `message` and, when applicable, a `markdown` block rendering the core payload.
- No raw HTML in Markdown. Keep CSP-friendly, image embeds use data URIs or remote URLs.
- Examples:

TEXT
```
# Summary

{message}
```

LIST
```
# Results ({total})

{items}

// item format
- [Title](url)  
  {optional image: ![alt](imageUrl)}  
  {optional description}
```

STATS
```
# Key Metrics

| Metric | Value |
|---|---:|
| {label} | {value}{unit} |
```

TABLE (preview up to `previewLimit` rows)
```
# Data Preview (first N rows)

| {Column 1} | {Column 2} | ... |
|---|---|---|
| row1col1 | row1col2 | ... |
```

CHART
```
# Chart

![{alt or title}](data:{mimeType};base64,{base64})
```

### 4) Response Routing Heuristics
- LIST: Row has `title|name` and `url|link|href` and/or `image|imageUrl|thumbnail`.
- STATS: Row resembles aggregates (columns include `count|sum|avg|total|min|max`) or most values are numeric.
- TABLE: Default for tabular data when no other kind matches.
- CHART (optional): When data has suitable shape (e.g., label + numeric series). Server renders base64 using `chartjs-node-canvas`.

### 5) Implementation Plan
1. Types
   - Update `src/ai/types/chat.types.ts` to add the discriminated union and related payload types (List/Stats/Table/Chart).
   - Maintain existing types (`ChatMessage`, `ChatSession`).

2. Response Generator
   - Update `src/ai/agents/response-generator.ts` `generateFinalResponse(...)` to:
     - Inspect `sqlResult.results` and choose `kind`.
     - Normalize output per selected `kind` and populate `payload`.
     - Always produce Markdown in `message`, and additionally set `markdown` with a formatted block for LIST/STATS/TABLE/CHART.
     - Fallback to `TEXT` with "No data found" when empty.
   - Utilities:
     - Infer table columns and normalize rows (types: string/number/boolean/date/url/image).
     - Convert media-like rows into `ListItem[]`.
     - Extract aggregates into `StatsItem[]`.

3. AiService Integration
   - In `src/ai/ai.service.ts` within the `readyForSql` block:
     - Replace final free-form return with the structured `ChatResponse` from `ResponseGenerator`.
     - Keep session message storage as `finalResponse.message` (Markdown text only) to avoid bloating session memory.

4. Optional Chart Rendering
   - Add `src/ai/utils/chart-renderer.ts` with `chartjs-node-canvas` to produce PNG base64 images.
   - Return `kind: 'CHART'` when appropriate (feature-flag or heuristic based).
   - Consider rate limiting and size limits for images (width/height, row caps).

### 6) Backward Compatibility
- Preserve existing properties (`message`, `timestamp`, `results`, `count`, `sql`, `validation`).
- Add `kind` and `payload` without breaking current consumers; frontend can progressively enhance rendering based on `kind`.

### 7) Frontend Rendering Contract (high-level)
- TEXT: render markdown/plain text.
- LIST: render cards or list with optional image and link.
- STATS: render statistic chips or KPI tiles.
- TABLE: render data table with provided columns and rows; use `type` to select cell renderer (url/image/boolean/date).
- CHART: render `<img src="data:${mime};base64,${base64}" />` with `alt`.

### 8) Validation & Testing
- Unit tests for `ResponseGenerator`:
  - Routes correctly to LIST/STATS/TABLE/TEXT/CHART given sample inputs.
  - Column inference and row normalization correctness.
  - Edge cases: empty results, mixed types, null values.
  - Markdown generation matches templates; no HTML injected; tables render within row caps.
- Contract tests for `AiService.chatWithAI` ensuring returned `ChatResponse.kind` matches expected for given fixture data.

### 9) Security & Privacy
- Ensure chart rendering avoids executing untrusted code; use server-side lib only.
- Limit base64 size; enforce timeouts and memory limits.
- Do not expose sensitive data in `payload.extra`.

### 10) Performance Considerations
- Cap rows in payloads (`previewLimit` for tables, e.g., 50 rows).
- Avoid storing large payloads in chat session memory; store only `message` into session history.
- Lazy render charts where possible; default to TABLE when large datasets.

### 11) Rollout Plan
- Phase 1: Types + ResponseGenerator + AiService integration (without CHART).
- Phase 2: Frontend rendering for LIST/STATS/TABLE.
- Phase 3: Optional CHART with feature flag.

### 12) Open Questions
- Should chart generation be always-on or opt-in via user prompt/param?
- Do we need pagination/streaming for large tables?
- What is the maximum acceptable payload size for API responses?

### 13) Acceptance Criteria
- API returns `kind` for all SQL-backed responses.
- LIST/STATS/TABLE responses validate against the new TypeScript types.
- Unit tests cover routing and normalization with >90% branch coverage in `ResponseGenerator`.
- No breaking changes to existing consumers; frontend can render text-only as before.


