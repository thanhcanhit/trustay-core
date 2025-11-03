# Tóm tắt Cách RAG Hoạt Động - Limit và Threshold

## Tổng quan

### Danh sách AI Agents và nhiệm vụ

| Agent Name | Logging Tag | Nhiệm vụ chính | Input | Output |
|------------|-------------|----------------|-------|--------|
| Orchestrator Agent | ORCHESTRATOR | Phân tích câu hỏi, gắn nhãn user role, phân loại request type, đọc business context (RAG), quyết định `readyForSql`, suy luận `ENTITY_HINT`/`FILTERS_HINT`/`MODE_HINT` | User query, recent messages, business context | `requestType`, `readyForSql`, `message`, `businessContext`, `intentModeHint`, `entityHint`, `filtersHint`, `missingParams` |
| SQL Generation Agent | SQL_AGENT | Quyết định tái sử dụng canonical SQL, lấy schema context (RAG), tạo SQL, thực thi read-only, serialize kết quả | User query, session hints, business context, AI config | `sql`, `results`, `count` |
| Response Generator | PARALLEL: RESPONSE_GENERATOR | Tạo câu trả lời tự nhiên có cấu trúc (LIST/TABLE/CHART) từ kết quả SQL và thông điệp | Orchestrator message, SQL result, AI config, desired mode | `responseText` (bao gồm message + structured markers) |
| Result Validator Agent | PARALLEL: VALIDATOR | Đánh giá hợp lệ của SQL và kết quả thực thi; gán `severity` và `reason` | User query, SQL, results, requestType, AI config | `isValid`, `severity`, `reason` |
| Knowledge Service | KNOWLEDGE | Cung cấp RAG: business context, schema context, canonical reuse, Q&A examples; lưu Q&A | Query, thresholds/limits, context | Context chunks, canonical decision, persisted Q&A |

### Quy ước log theo pipeline
- Banners:
  - START: `==================== START PIPELINE ====================`
  - END: `===================== END PIPELINE =====================`
- Mỗi step có cặp log `START | ...` và `END | ...` theo tag: `ORCHESTRATOR`, `SQL_AGENT`, `PARALLEL` (và chi tiết `RESPONSE_GENERATOR`/`VALIDATOR` trong message).

Hệ thống sử dụng Vector Database (RAG) để:
1. **Lấy business context** cho Orchestrator Agent
2. **Lấy schema context** cho SQL Generation Agent
3. **Tìm canonical SQL** đã được xác thực trước đó để tái sử dụng
4. **Lấy Q&A examples** để làm gợi ý cho SQL generation

---

## 1. Orchestrator Agent - Business Context

**Location:** `src/ai/agents/orchestrator-agent.ts:64-75`

```typescript
const ragContext = await this.knowledge.buildRagContext(query, {
  limit: 8,        // Lấy tối đa 8 chunks
  threshold: 0.6,  // Chỉ lấy chunks có similarity score >= 0.6
  includeBusiness: true,  // Chỉ lấy business context
});
```

**Limit hiện tại:**
- **limit: 8** - Lấy tối đa 8 chunks từ business context
- **threshold: 0.6** - Chỉ lấy chunks có similarity >= 60%

**Mục đích:** 
- Cung cấp ngữ cảnh nghiệp vụ để Orchestrator Agent hiểu rõ hệ thống
- Giúp phân tích ý định người dùng chính xác hơn

---

## 2. SQL Generation Agent - Schema Context

**Location:** `src/ai/agents/sql-generation-agent.ts:84-92`

```typescript
const schemaResults = await this.knowledgeService.retrieveSchemaContext(query, {
  limit: 8,       // Lấy tối đa 8 schema chunks
  threshold: 0.6, // Chỉ lấy schema có similarity >= 0.6
});
```

**Limit hiện tại:**
- **limit: 8** - Lấy tối đa 8 schema chunks
- **threshold: 0.6** - Chỉ lấy schema có similarity >= 60%

**Mục đích:**
- Cung cấp schema definition liên quan đến câu hỏi
- Giúp AI tạo SQL chính xác hơn với schema đúng

**Note:** Nếu không tìm thấy schema từ RAG, fallback về `getCompleteDatabaseSchema()` (full schema)

---

## 3. SQL Generation Agent - Canonical SQL Reuse

**Location:** `src/ai/agents/sql-generation-agent.ts:64-67`

```typescript
canonicalDecision = await this.knowledgeService.decideCanonicalReuse(query, {
  hard: 0.92,  // Nếu similarity >= 0.92 → REUSE (chạy SQL trực tiếp)
  soft: 0.8,   // Nếu 0.8 <= similarity < 0.92 → HINT (đưa vào prompt)
});
```

**Threshold hiện tại:**
- **hard: 0.92** - Reuse mode: Chạy SQL trực tiếp nếu similarity >= 92%
- **soft: 0.8** - Hint mode: Đưa SQL vào prompt nếu 80% <= similarity < 92%
- **< 0.8** - New mode: Tạo SQL mới

**Flow:**

```
1. Exact match check (normalized question)
   ↓ (nếu match → reuse với score = 1.0)
2. Vector similarity search (limit: 1, lấy top 1)
   ↓
3. So sánh với thresholds:
   - score >= 0.92 → REUSE (execute SQL trực tiếp)
   - 0.8 <= score < 0.92 → HINT (đưa vào prompt)
   - score < 0.8 → NEW (tạo SQL mới)
```

**Mục đích:**
- Tối ưu performance: Reuse SQL đã được validate trước đó
- Giảm sai sót: Dùng SQL đã chạy thành công
- Self-learning: Hệ thống học từ SQL đã được xác thực

---

## 4. SQL Generation Agent - Q&A Examples (Canonical Hint)

**Location:** `src/ai/agents/sql-generation-agent.ts:94-105`

```typescript
// Chỉ fetch Q&A examples khi canonicalDecision.mode === 'hint'
if (canonicalDecision?.mode === 'hint') {
  const qaResults = await this.knowledgeService.retrieveKnowledgeContext(query, {
    limit: 8,       // Lấy tối đa 8 Q&A chunks
    threshold: 0.6, // Chỉ lấy Q&A có similarity >= 0.6
  });
  const qaContext = qaResults
    .slice(0, 2)    // CHỈ LẤY TOP 2 (thêm limit)
    .map((r) => r.content)
    .join('\n');
}
```

**Limit hiện tại:**
- **limit: 8** - Lấy tối đa 8 Q&A chunks từ vector search
- **slice(0, 2)** - CHỈ LẤY TOP 2 để đưa vào prompt
- **threshold: 0.6** - Chỉ lấy Q&A có similarity >= 60%

**Điều kiện:**
- Chỉ fetch khi `canonicalDecision.mode === 'hint'` (similarity 0.8-0.92)
- Không fetch nếu `mode === 'reuse'` (đã có SQL để chạy trực tiếp)
- Không fetch nếu `mode === 'new'` (câu hỏi hoàn toàn mới)

**Mục đích:**
- Cung cấp examples tương tự để AI học cách tạo SQL
- Giảm prompt size (chỉ 2 examples thay vì 8)

---

## 5. Canonical SQL Hint trong Prompt

**Location:** `src/ai/agents/sql-generation-agent.ts:107-110`

```typescript
if (canonicalDecision?.mode === 'hint') {
  ragContext += `\nCANONICAL SQL HINT (score=${canonicalDecision.score.toFixed(2)}):\n`;
  ragContext += `Question: ${canonicalDecision.question}\nSQL:\n${canonicalDecision.sql}\n`;
}
```

**Content:**
- Question: Câu hỏi tương tự đã được xử lý trước đó
- SQL: SQL đã được validate và chạy thành công
- Score: Similarity score (0.8 - 0.92)

**Mục đích:**
- Gợi ý cho AI cách viết SQL tương tự
- Tăng độ chính xác khi similarity ở mức trung bình

---

## Tóm tắt Limit và Threshold

| Agent/Function | Limit | Threshold | Ghi chú |
|---------------|-------|-----------|---------|
| **Orchestrator - Business Context** | 8 chunks | 0.6 | Chỉ lấy business context |
| **SQL Generation - Schema Context** | 8 chunks | 0.6 | Fallback về full schema nếu không có |
| **SQL Generation - Canonical Reuse** | 1 (top 1) | hard: 0.92, soft: 0.8 | Reuse/Hint/New modes |
| **SQL Generation - Q&A Examples** | 8 chunks → slice(2) | 0.6 | Chỉ fetch khi mode === 'hint', chỉ dùng top 2 |

---

## Đề xuất Tối ưu

### 1. Schema Context
- **Hiện tại:** limit: 8, threshold: 0.6
- **Có thể:** Tăng limit lên 10-12 nếu schema phức tạp
- **Hoặc:** Giảm threshold xuống 0.5 nếu cần nhiều context hơn

### 2. Q&A Examples
- **Hiện tại:** limit: 8 → slice(2)
- **Đề xuất:** Giảm limit xuống 2 từ đầu để giảm vector search overhead
- **Hoặc:** Giữ nguyên nhưng thêm logic filter để chọn examples tốt nhất

### 3. Canonical Reuse Thresholds
- **Hiện tại:** hard: 0.92, soft: 0.8
- **Cân nhắc:** 
  - Giảm hard xuống 0.90 nếu muốn reuse nhiều hơn
  - Tăng soft lên 0.85 nếu muốn ít hint hơn, nhiều new hơn

---

## Flow Diagram

```
User Query
    ↓
┌─────────────────────────────────────┐
│ Orchestrator Agent                   │
│ - buildRagContext(query, {          │
│     limit: 8, threshold: 0.6,       │
│     includeBusiness: true            │
│   })                                 │
│ → Returns business context           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ SQL Generation Agent                 │
│ ┌─────────────────────────────────┐   │
│ │ decideCanonicalReuse(query, {   │   │
│ │   hard: 0.92, soft: 0.8        │   │
│ │ })                              │   │
│ │ → Returns: reuse/hint/new       │   │
│ └─────────────────────────────────┘   │
│                                         │
│ IF mode === 'reuse':                   │
│   → Execute canonical SQL directly     │
│                                         │
│ IF mode === 'hint' OR 'new':           │
│   ┌─────────────────────────────────┐ │
│   │ retrieveSchemaContext(query, {   │ │
│   │   limit: 8, threshold: 0.6      │ │
│   │ })                              │ │
│   │ → Returns 8 schema chunks       │ │
│   └─────────────────────────────────┘ │
│                                         │
│   IF mode === 'hint':                  │
│     ┌─────────────────────────────────┐│
│     │ retrieveKnowledgeContext(query, {││
│     │   limit: 8, threshold: 0.6     ││
│     │ }).slice(0, 2)                 ││
│     │ → Returns 2 Q&A examples      ││
│     │ + canonical SQL hint           ││
│     └─────────────────────────────────┘│
│                                         │
│   → Generate SQL với RAG context       │
└─────────────────────────────────────┘
```

---

## Kết luận

**Hiện tại RAG hoạt động tốt với:**
- ✅ Business context: 8 chunks, threshold 0.6
- ✅ Schema context: 8 chunks, threshold 0.6 (có fallback)
- ✅ Canonical reuse: 2-threshold system (0.92/0.8) hoạt động tốt
- ✅ Q&A examples: Chỉ fetch khi cần (hint mode), chỉ dùng top 2

**Có thể tối ưu thêm:**
- Giảm overhead: Fetch Q&A với limit: 2 thay vì 8 → slice(2)
- Điều chỉnh thresholds dựa trên metrics thực tế
- Thêm caching cho schema context nếu query pattern lặp lại



