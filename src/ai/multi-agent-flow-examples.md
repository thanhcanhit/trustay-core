# Multi-Agent Flow Examples

## Mô tả Multi-Agent Architecture

Hệ thống AI của Trustay sử dụng **Multi-Agent Flow** với 2 LLM agents:

### Agent 1: Conversational Agent 🤖
- **Nhiệm vụ**: Xử lý hội thoại tự nhiên, phân tích ý định người dùng
- **Chức năng**:
  - Trò chuyện thân thiện với người dùng
  - Xác định xem có đủ thông tin để tạo SQL query không
  - Yêu cầu thông tin bổ sung nếu cần thiết
  - Phân loại tình huống: GREETING, READY_FOR_SQL, NEEDS_CLARIFICATION, GENERAL_CHAT

### Agent 2: SQL Generation Agent 🔍
- **Nhiệm vụ**: Sinh SQL và thực thi query khi đã có đủ thông tin
- **Chức năng**:
  - Tạo SQL query từ ngữ cảnh hội thoại
  - Thực thi query trên database
  - Trả về kết quả có cấu trúc

## Flow Diagram

```
User Query → Agent 1 (Conversational) → Decision:
                                        ├─ Not Ready → Ask for more info
                                        └─ Ready → Agent 2 (SQL) → Final Response
```

## Ví dụ Conversations

### Ví dụ 1: Lời chào đầu tiên
**User**: "Xin chào"
**Agent 1**: Phân loại → GREETING
**Response**: 
```
Xin chào! 👋 Tôi là AI Assistant của Trustay, rất vui được trò chuyện với bạn!

Tôi có thể giúp bạn tìm hiểu về dữ liệu phòng trọ, thống kê doanh thu, thông tin người dùng và nhiều thứ khác.

Bạn muốn tìm hiểu điều gì? 😊
```

### Ví dụ 2: Câu hỏi cần làm rõ
**User**: "Thống kê phòng"
**Agent 1**: Phân loại → NEEDS_CLARIFICATION
**Response**:
```
Tôi hiểu bạn muốn xem thống kê về phòng! 📊

Bạn muốn xem thống kê gì cụ thể?
• Số lượng phòng theo trạng thái (trống/đã thuê)?
• Thống kê giá phòng theo khu vực?
• Số phòng theo loại (boarding house, apartment...)?

Bạn quan tâm đến thông tin nào nhất? 🤔
```

### Ví dụ 3: Câu hỏi rõ ràng → SQL
**User**: "Có bao nhiêu phòng trống hiện tại?"
**Agent 1**: Phân loại → READY_FOR_SQL
**Agent 2**: Tạo SQL → `SELECT COUNT(*) FROM rooms WHERE is_available = true;`
**Final Response**:
```
Hiện tại có 47 phòng đang trống và sẵn sàng cho thuê! 🏠

Đây là những phòng có thể đặt ngay. Bạn có muốn xem thêm thông tin chi tiết về các phòng này không?
```

### Ví dụ 4: Hội thoại liên tục
**User**: "Thế còn phòng đã thuê?"
**Context**: Có ngữ cảnh từ câu hỏi trước về phòng trống
**Agent 1**: Phân loại → READY_FOR_SQL (dựa vào context)
**Agent 2**: Tạo SQL → `SELECT COUNT(*) FROM rooms WHERE is_available = false;`
**Final Response**:
```
Có 198 phòng đang được thuê! 🏡

Tỷ lệ lấp đầy khá tốt với khoảng 80.8% phòng đã có người thuê. Bạn có muốn xem thống kê chi tiết hơn không?
```

## Lợi ích của Multi-Agent Flow

### 1. **Trải nghiệm người dùng tự nhiên**
- Không có message lỗi cứng nhắc
- Hội thoại mượt mà như với con người
- Phản hồi thông minh dựa trên ngữ cảnh

### 2. **Xử lý thông minh**
- Agent 1 hiểu ý định và yêu cầu thông tin thiếu
- Agent 2 chỉ hoạt động khi đã có đủ thông tin
- Kết hợp 2 agents tạo ra response hoàn chỉnh

### 3. **Khả năng mở rộng**
- Có thể thêm agents khác (Agent 3: Data Analysis, Agent 4: Recommendations...)
- Mỗi agent có chuyên môn riêng
- Flow có thể phức tạp hơn với nhiều decision points

### 4. **Bảo mật và kiểm soát**
- Agent 1 filter các request không phù hợp
- Agent 2 chỉ tạo SELECT queries an toàn
- Có thể thêm validation layers giữa các agents

## Technical Implementation

### Key Methods:
- `chatWithAI()`: Main entry point cho multi-agent flow
- `conversationalAgent()`: Agent 1 implementation  
- `sqlGenerationAgent()`: Agent 2 implementation
- `generateFinalResponse()`: Kết hợp outputs từ 2 agents

### Response Structure:
```typescript
interface ChatResponse {
  sessionId: string;
  message: string;        // Final human-friendly response
  sql?: string;          // SQL query (if executed)
  results?: any;         // Query results (if any)
  count?: number;        // Result count (if any)
  timestamp: string;
  validation?: {
    isValid: boolean;
    needsClarification?: boolean;
    needsIntroduction?: boolean;
  };
}
```

## Future Enhancements

1. **Agent 3: Data Visualization** - Tạo charts/graphs từ kết quả SQL
2. **Agent 4: Recommendation Engine** - Đưa ra gợi ý dựa trên data patterns
3. **Agent 5: Report Generator** - Tạo báo cáo PDF/Excel từ queries
4. **Context Memory** - Lưu trữ context dài hạn cho personalization
