# AI Multi-Agent Flow Specification

## Tổng quan

Hệ thống AI của Trustay sử dụng kiến trúc **4 Agent** để xử lý các câu hỏi của người dùng và tạo SQL queries để truy vấn database. Mỗi agent có nhiệm vụ riêng biệt và tương tác với nhau theo một flow tuần tự.

## Flow Diagram

```
User Query
    ↓
┌─────────────────────────────────────────────────────────┐
│ Bước 1: Session Management                              │
│ - Lấy hoặc tạo session chat                             │
│ - Lưu system prompt tiếng Việt                         │
│ - Lưu câu hỏi của người dùng                           │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Agent 1: Orchestrator Agent (Nhà điều phối)             │
│ - Đánh nhãn user role: [GUEST]/[TENANT]/[LANDLORD]      │
│ - Phân loại request type: QUERY/GREETING/CLARIFICATION  │
│ - Đọc business context từ RAG (buildRagContext)        │
│ - Quyết định readyForSql                                │
│ - Gợi ý mode: LIST/TABLE/CHART                          │
└─────────────────────────────────────────────────────────┘
    ↓
    ├─→ QUERY + readyForSql = true?
    │       ↓
    │   ┌─────────────────────────────────────────────────┐
    │   │ Agent 2: SQL Generation Agent                   │
    │   │ - Nhận businessContext từ Agent 1              │
    │   │ - Kiểm tra canonical reuse (decideCanonical)   │
    │   │ - RAG retrieval: schema + QA context           │
    │   │ - Tạo SQL query với business context           │
    │   │ - Thực thi SQL (read-only)                      │
    │   │ - Trả về kết quả đã serialize                  │
    │   └─────────────────────────────────────────────────┘
    │       ↓
    │   ┌─────────────────────────────────────────────────┐
    │   │ Agent 3: Response Generator                     │
    │   │ - Build structured data (LIST/TABLE/CHART)      │
    │   │ - Tạo message thân thiện bằng tiếng Việt        │
    │   │ - Format: message ---END LIST:[] TABLE:{} CHART:{} │
    │   │ - Parse response text                          │
    │   └─────────────────────────────────────────────────┘
    │       ↓
    │   ┌─────────────────────────────────────────────────┐
    │   │ Agent 4: Result Validator                       │
    │   │ - So sánh yêu cầu vs SQL                        │
    │   │ - Kiểm tra kết quả có hợp lý không             │
    │   │ - Trả về isValid + reason                      │
    │   └─────────────────────────────────────────────────┘
    │       ↓
    │   ┌─────────────────────────────────────────────────┐
    │   │ Persist to Knowledge Store (chỉ nếu isValid)    │
    │   │ - Lưu Q&A để học hỏi và tái sử dụng            │
    │   └─────────────────────────────────────────────────┘
    │       ↓
    │   Return ChatResponse với parsed message + payload
    │
    ├─→ CLARIFICATION?
    │       ↓
    │   Return CONTROL response (yêu cầu làm rõ)
    │
    └─→ GREETING/GENERAL_CHAT?
            ↓
        Return CONTENT response (trò chuyện thông thường)
```

## Chi tiết từng Agent

### Agent 1: Orchestrator Agent

**File**: `src/ai/agents/orchestrator-agent.ts`

**Nhiệm vụ chính**:
- Đánh nhãn user role (GUEST/TENANT/LANDLORD) từ Prisma
- Phân loại request type (QUERY/GREETING/CLARIFICATION/GENERAL_CHAT)
- Đọc business context từ RAG (`knowledge.buildRagContext` với `includeBusiness: true`)
- Quyết định `readyForSql`
- Gợi ý output mode (LIST/TABLE/CHART)

**Input**:
- `query: string` - Câu hỏi của người dùng
- `session: ChatSession` - Session chat với conversation history
- `aiConfig` - AI configuration (model, temperature, maxTokens)

**Output**: `OrchestratorAgentResponse`
```typescript
{
  message: string;              // Message với label [TENANT]/[LANDLORD]/[GUEST]
  requestType: RequestType;      // QUERY/GREETING/CLARIFICATION/GENERAL_CHAT
  userRole: UserRole;            // GUEST/TENANT/LANDLORD
  userId?: string;               // User ID nếu authenticated
  businessContext?: string;       // RAG business context
  readyForSql: boolean;          // Có đủ thông tin để tạo SQL?
  intentModeHint?: 'LIST' | 'TABLE' | 'CHART';
  entityHint?: 'room' | 'post' | 'room_seeking_post';
  filtersHint?: string;
}
```

**Dependencies**:
- `PrismaService` - Lấy user role từ database
- `KnowledgeService` - Lấy business context từ RAG

---

### Agent 2: SQL Generation Agent

**File**: `src/ai/agents/sql-generation-agent.ts`

**Nhiệm vụ chính**:
- Nhận `businessContext` từ Orchestrator Agent
- Kiểm tra canonical SQL reuse (hard threshold 0.92, soft 0.8)
- RAG retrieval: schema context + QA examples (nếu có hint)
- Tạo SQL query với business context và user role
- Thực thi SQL an toàn (read-only)
- Retry logic (max 5 attempts) với error handling

**Input**:
- `query: string`
- `session: ChatSession`
- `prisma: PrismaService`
- `aiConfig`
- `businessContext?: string` - Từ Orchestrator Agent

**Output**: `SqlGenerationResult`
```typescript
{
  sql: string;                   // SQL query đã tạo
  results: any;                  // Kết quả query đã serialize
  count: number;                 // Số lượng kết quả
  attempts?: number;             // Số lần thử
  userId?: string;
  userRole?: string;
}
```

**Dependencies**:
- `KnowledgeService` - RAG retrieval và canonical reuse

---

### Agent 3: Response Generator

**File**: `src/ai/agents/response-generator.ts`

**Nhiệm vụ chính**:
- Build structured data từ SQL results (LIST/TABLE/CHART)
- Tạo message thân thiện bằng tiếng Việt
- Format output theo pattern: `message ---END LIST:[] TABLE:{} CHART:{}`
- Fallback nếu AI không trả về đúng format

**Input**:
- `conversationalMessage: string` - Từ Orchestrator Agent
- `sqlResult: SqlGenerationResult`
- `session: ChatSession`
- `aiConfig`
- `desiredMode?: 'LIST' | 'TABLE' | 'CHART'`

**Output**: `string` - Response text với format:
```
Đây là 5 phòng mới nhất ở gò vấp...
---END
LIST: [{"id":"123","title":"...","path":"/rooms/123"}]
TABLE: null
CHART: null
```

**Processing**:
1. Build structured data từ SQL results
2. Tạo prompt với structured data
3. Generate response từ AI
4. Ensure `---END` format (fallback nếu thiếu)
5. Return formatted string

---

### Agent 4: Result Validator

**File**: `src/ai/agents/result-validator-agent.ts`

**Nhiệm vụ chính**:
- So sánh yêu cầu ban đầu với SQL đã sinh ra
- Kiểm tra kết quả có hợp lý không (ví dụ: quận 1 vs quận 2)
- Kiểm tra loại dữ liệu có đúng không (thống kê vs danh sách)
- Chỉ persist vào knowledge store nếu `isValid === true`

**Input**:
- `query: string` - Câu hỏi ban đầu
- `sql: string` - SQL đã tạo
- `results: unknown` - Kết quả SQL
- `expectedType: RequestType` - Từ Orchestrator
- `aiConfig`

**Output**: `ResultValidationResponse`
```typescript
{
  isValid: boolean;      // SQL và kết quả có đúng với yêu cầu?
  reason?: string;       // Lý do nếu invalid
}
```

**Validation Rules**:
- SQL có match với yêu cầu ban đầu không?
- Filter/điều kiện có phù hợp không? (ví dụ: "quận 1" mà SQL query "quận 2" → invalid)
- Kết quả có đúng loại dữ liệu không? (thống kê vs danh sách chi tiết)

---

## Response Format

### Response Structure

```typescript
interface ChatResponse {
  kind: 'DATA' | 'CONTENT' | 'CONTROL';
  sessionId: string;
  timestamp: string;
  message: string;                    // Text trước ---END delimiter
  payload?: DataPayload | ContentPayload | ControlPayload;
}
```

### Data Payload

```typescript
interface DataPayload {
  mode: 'LIST' | 'TABLE' | 'CHART';
  list?: {
    items: ListItem[];                // Với path để render link
    total: number;
  };
  table?: {
    columns: TableColumn[];
    rows: Record<string, TableCell>[];
    previewLimit?: number;
  };
  chart?: {
    mimeType: 'image/png';
    url: string;                     // QuickChart URL
    width: number;
    height: number;
    alt?: string;
  };
}
```

### Response Text Format

```
[TENANT] Đây là 5 phòng mới nhất ở gò vấp, tôi thấy căn Phòng trọ Lan Anh là phù hợp nhất đó
---END
LIST: [{"id":"123","title":"Phòng trọ Lan Anh","path":"/rooms/123","entity":"room"}]
TABLE: null
CHART: null
```

## Session Management

**File**: `src/ai/ai.service.ts`

**Features**:
- Session ID dựa trên `userId` hoặc `clientIp`
- Timeout: 30 phút không hoạt động
- Max messages: 20 messages per session
- Auto cleanup: Mỗi 10 phút
- System prompt: Tự động thêm khi tạo session mới

## Knowledge Store Integration

**File**: `src/ai/knowledge/knowledge.service.ts`

**Features**:
- **RAG Context**: Schema + Business context + QA examples
- **Canonical Reuse**: Hard threshold (0.92) để reuse trực tiếp, soft (0.8) để hint
- **QA Persistence**: Chỉ lưu khi `isValid === true` (từ Result Validator)

## Error Handling

- **Orchestrator Agent**: Fallback về GENERAL_CHAT nếu lỗi
- **SQL Generation Agent**: Retry logic (max 5 attempts) với error context
- **Response Generator**: Fallback format nếu AI không trả về đúng
- **Result Validator**: Default `isValid = true` nếu validation fails (không block persistence)

## Type Definitions

### Enums

```typescript
enum RequestType {
  QUERY = 'QUERY',              // Cần tạo SQL
  GREETING = 'GREETING',        // Lời chào
  CLARIFICATION = 'CLARIFICATION', // Cần làm rõ
  GENERAL_CHAT = 'GENERAL_CHAT'    // Trò chuyện thông thường
}

enum UserRole {
  GUEST = 'GUEST',              // Chưa đăng nhập
  TENANT = 'TENANT',            // Người thuê phòng
  LANDLORD = 'LANDLORD'         // Chủ trọ
}
```

## File Structure

```
src/ai/
├── agents/
│   ├── orchestrator-agent.ts          # Agent 1
│   ├── sql-generation-agent.ts        # Agent 2
│   ├── response-generator.ts          # Agent 3
│   └── result-validator-agent.ts      # Agent 4
├── prompts/
│   ├── orchestrator-agent.prompt.ts
│   ├── sql-agent.prompt.ts
│   ├── response-generator.prompt.ts
│   └── result-validator-agent.prompt.ts
├── utils/
│   ├── response-parser.ts             # Parse ---END format
│   └── data-utils.ts                  # Build LIST/TABLE/CHART
├── knowledge/
│   └── knowledge.service.ts           # RAG + Canonical reuse
└── ai.service.ts                      # Main orchestrator
```

## Key Design Decisions

1. **Orchestrator-first**: Agent 1 đọc business context để hiểu nghiệp vụ trước
2. **Business context propagation**: Orchestrator → SQL Agent → Better SQL generation
3. **Structured output format**: `---END` delimiter để parse message và data
4. **Validation before persistence**: Chỉ lưu Q&A khi kết quả valid
5. **Canonical reuse**: Tái sử dụng SQL đã được xác nhận thay vì tạo mới
6. **User role awareness**: Labels [TENANT]/[LANDLORD]/[GUEST] trong messages
7. **Fallback safety**: Ensure format luôn đúng kể cả khi AI không follow instructions

## Usage Example

```typescript
// User query
const query = "Tìm phòng trọ giá rẻ ở quận 1";

// AI Service processes
const response = await aiService.chatWithAI(query, {
  userId: "user-123",
  clientIp: "192.168.1.1"
});

// Response structure
{
  kind: 'DATA',
  sessionId: 'user_user-123',
  timestamp: '2024-01-15T10:30:00Z',
  message: '[TENANT] Đây là 5 phòng giá rẻ ở quận 1...',
  payload: {
    mode: 'LIST',
    list: {
      items: [
        { id: '123', title: 'Phòng trọ ABC', path: '/rooms/123', entity: 'room' },
        ...
      ],
      total: 5
    }
  }
}
```

---

**Tác giả**: AI Team  
**Cập nhật**: 2024-01-15  
**Version**: 2.0 (4-Agent Architecture)

