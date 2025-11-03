# AI Utils Refactor Plan

## Mục tiêu
Loại bỏ các utils thừa thãi, quá tĩnh làm ảnh hưởng đến agent, và sử dụng thư viện cho SQL safety.

## Phân tích các utils

### ✅ Nên GIỮ (cần thiết, đơn giản, không ảnh hưởng agent)
1. **`data-utils.ts`** - Data transformation (toListItems, inferColumns, normalizeRows, selectImportantColumns, tryBuildChart)
   - Lý do: Cần thiết cho việc format data trước khi trả về frontend
   - Action: Giữ nguyên

2. **`chart.ts`** - QuickChart URL builder
   - Lý do: Đơn giản, cần thiết
   - Action: Giữ nguyên

3. **`entity-route.ts`** - Entity path builder
   - Lý do: Đơn giản, cần thiết
   - Action: Giữ nguyên

4. **`serializer.ts`** - BigInt serialization
   - Lý do: Cần thiết cho JSON compatibility
   - Action: Giữ nguyên

5. **`security-helper.ts`** - User access validation
   - Lý do: Cần thiết cho security, business logic quan trọng
   - Action: Giữ nguyên, có thể tinh chỉnh

6. **`prompt-builder.ts`** - Prompt construction
   - Lý do: Cần thiết cho SQL agent
   - Action: Giữ nguyên, có thể refactor để clean hơn

### ❌ Nên LOẠI BỎ (quá tĩnh, agent nên tự quyết định)
1. **`intent-utils.ts`** - `isChartIntent`, `resolveDesiredMode`
   - Lý do: Logic hardcode patterns mà agent đã có thể tự quyết định từ conversation
   - Vấn đề: Duplicate logic trong `ai.service.ts` (có methods riêng)
   - Action: **LOẠI BỎ**, để agent tự quyết định qua `conversationalResponse.intentModeHint`

2. **`query-validator.ts`** - `QueryValidator.validateQueryIntent`
   - Lý do: Pattern matching hardcode, agent đã hiểu intent từ conversation
   - Vấn đề: Không cần thiết, agent đã có `ConversationalAgent` để hiểu intent
   - Action: **LOẠI BỎ**, agent tự validate

### ⚠️ Nên DI CHUYỂN/TINH CHỈNH (hardcode, nên linh hoạt hơn)
1. **`business.ts`** - Business narrative document
   - Lý do: Hardcode business context, nên đưa vào knowledge base hoặc prompts
   - Action: **DI CHUYỂN** sang knowledge base hoặc prompt templates, không hardcode trong code

2. **`schema-provider.ts`** - Database schema hardcode
   - Lý do: Schema nên lấy từ Prisma schema generator hoặc vector store
   - Action: **REFACTOR** để lấy từ Prisma schema thực tế thay vì hardcode

3. **`sql-safety.ts`** - SQL safety validation
   - Lý do: Custom validation logic, có thể dùng thư viện
   - Action: **THAY THẾ** bằng `node-sql-parser` hoặc simplify logic

## Chi tiết refactor

### 1. Loại bỏ `intent-utils.ts`
- Xóa file `src/ai/utils/intent-utils.ts`
- Xóa imports trong `ai.service.ts`
- Xóa duplicate methods trong `ai.service.ts` (`isChartIntent`, `resolveDesiredMode`)
- Chỉ dùng `conversationalResponse.intentModeHint` từ agent

### 2. Loại bỏ `query-validator.ts`
- Xóa file `src/ai/utils/query-validator.ts`
- Xóa imports trong `sql-generation-agent.ts`
- Xóa calls `QueryValidator.validateQueryIntent()`
- Agent tự validate intent qua conversation

### 3. Di chuyển `business.ts`
- Option A: Đưa vào `prompts/prompt-templates.ts` như constant
- Option B: Đưa vào knowledge base và load qua RAG
- **Chọn Option A** (đơn giản hơn): Move sang `prompts/business-context.ts`

### 4. Refactor `schema-provider.ts`
- Tích hợp với Prisma schema introspection
- Hoặc load từ vector store (nếu có)
- **Tạm thời giữ** vì cần thời gian refactor

### 5. Thay thế `sql-safety.ts`
- Cài đặt `node-sql-parser`: `npm install node-sql-parser`
- Refactor để dùng AST parser thay vì regex patterns
- **Simplify** nếu không muốn thêm dependency

## Implementation order

1. ✅ Loại bỏ `intent-utils.ts` và duplicate logic trong `ai.service.ts`
2. ✅ Loại bỏ `query-validator.ts` từ `sql-generation-agent.ts`
3. ✅ Di chuyển `business.ts` sang `prompts/business-context.ts`
4. ⏸️ Simplify `sql-safety.ts` (giữ logic cơ bản, bỏ phần phức tạp)
5. ⏸️ Refactor `schema-provider.ts` (future task)

## Notes
- Agent nên tự quyết định intent thay vì dựa vào hardcode patterns
- Simplify codebase, giảm dependencies
- Giữ lại logic quan trọng cho security và data transformation

