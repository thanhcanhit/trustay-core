# AI Chat Introduction & Clarification System

## Hệ thống giới thiệu tính năng và hỏi lại thông minh

### 🎯 **Mục tiêu:**
Thay vì từ chối câu hỏi chung chung, hệ thống sẽ hỏi lại để thu thập thông tin cần thiết để tạo SQL query chính xác.

---

## 📝 **Ví dụ Conversation Flows:**

### **Ví dụ 1: Câu hỏi "thống kê"**

```
👤 User: "Cho tôi xem thống kê"

🤖 AI: "Tôi có thể giúp bạn xem thống kê! Bạn muốn xem thống kê về:
• Số lượng phòng trọ (tổng số, trống, đã thuê)?
• Người dùng (tenant, landlord, đăng ký mới)?
• Doanh thu (hóa đơn, thanh toán theo tháng)?
• Đặt phòng (pending, approved, rejected)?

Hãy cho tôi biết cụ thể hơn nhé!"

👤 User: "Thống kê phòng trọ"

🤖 AI: "Hiện tại hệ thống có:
- Tổng số phòng: 245 phòng
- Phòng trống: 67 phòng (27.3%)
- Phòng đã thuê: 178 phòng (72.7%)
- Phòng bảo trì: 0 phòng"
```

### **Ví dụ 2: Câu hỏi "báo cáo"**

```
👤 User: "Tôi cần báo cáo"

🤖 AI: "Tôi có thể tạo báo cáo cho bạn! Bạn cần báo cáo về:
• Doanh thu (theo tháng, quý, năm)?
• Tình trạng phòng trọ (trống, đã thuê, bảo trì)?
• Hóa đơn (đã thanh toán, chưa thanh toán, quá hạn)?
• Người dùng mới (đăng ký theo thời gian)?

Bạn muốn báo cáo gì và trong khoảng thời gian nào?"

👤 User: "Báo cáo doanh thu tháng này"

🤖 AI: "Báo cáo doanh thu tháng 10/2025:
- Tổng doanh thu: 1,245,000,000 VNĐ
- Đã thu: 1,100,000,000 VNĐ (88.4%)
- Chưa thu: 145,000,000 VNĐ (11.6%)
- Số hóa đơn: 178 hóa đơn"
```

### **Ví dụ 3: Câu hỏi với ngữ cảnh**

```
👤 User: "Có bao nhiêu phòng trống?"

🤖 AI: "Hiện tại có 67 phòng trống trong hệ thống."

👤 User: "Còn phòng nào khác?"

🤖 AI: "Trong số 67 phòng trống đó, có:
- 23 phòng nhà trọ (giá từ 2-4 triệu)
- 15 phòng ký túc xá (giá từ 1.5-3 triệu)
- 12 phòng sleepbox (giá từ 1-2 triệu)
- 17 phòng chung cư (giá từ 5-8 triệu)"
```

### **Ví dụ 4: Câu hỏi không rõ ràng**

```
👤 User: "Xem dữ liệu"

🤖 AI: "Tôi có thể giúp bạn xem dữ liệu! Hệ thống Trustay có các loại dữ liệu sau:
• Phòng trọ: thông tin, giá cả, trạng thái
• Người dùng: tenant, landlord, thông tin liên hệ
• Hóa đơn: số tiền, trạng thái thanh toán
• Hợp đồng thuê: active, terminated
• Đặt phòng: pending, approved, rejected

Bạn muốn xem dữ liệu gì cụ thể?"

👤 User: "Xem danh sách phòng giá rẻ"

🤖 AI: "Danh sách phòng có giá dưới 3 triệu:
1. Phòng A101 - 2.5 triệu - Nhà trọ - Quận 1
2. Phòng B205 - 2.8 triệu - Ký túc xá - Quận 7
3. Phòng C301 - 1.8 triệu - Sleepbox - Quận 12
..."
```

---

## 🔧 **Cách thức hoạt động:**

### **1. Phân loại câu hỏi:**
- **VALID**: Câu hỏi rõ ràng → Tạo SQL ngay
- **NEEDS_CLARIFICATION**: Câu hỏi chung chung → Hỏi lại
- **INVALID**: Không liên quan → Từ chối nhẹ nhàng

### **2. Tạo câu hỏi làm rõ thông minh:**
- Xem xét ngữ cảnh hội thoại
- Đưa ra 2-3 lựa chọn cụ thể
- Giải thích dữ liệu có sẵn
- Sử dụng ngôn ngữ thân thiện

### **3. Xử lý ngữ cảnh:**
- Nhớ câu hỏi trước đó
- Hiểu câu hỏi tiếp theo như "còn gì khác?"
- Liên kết thông tin qua các lượt hội thoại

---

## 🎨 **Lợi ích:**

✅ **Trải nghiệm người dùng tốt hơn**: Không bị từ chối cứng nhắc
✅ **Thu thập thông tin hiệu quả**: Hướng dẫn người dùng đưa ra câu hỏi tốt hơn
✅ **Tăng tỷ lệ thành công**: Nhiều câu hỏi được xử lý thành công hơn
✅ **Giáo dục người dùng**: Giúp người dùng hiểu dữ liệu có sẵn
✅ **Tương tác tự nhiên**: Giống như trò chuyện với con người

---

## 🚀 **API Response Format:**

```json
{
  "success": true,
  "data": {
    "sessionId": "user_123",
    "message": "Tôi có thể giúp bạn xem thống kê! Bạn muốn xem thống kê về...",
    "timestamp": "2025-10-26T10:30:00Z",
    "validation": {
      "isValid": false,
      "needsClarification": true,
      "clarificationQuestion": "Bạn muốn xem thống kê về..."
    }
  }
}
```

---

## 📱 **Frontend Integration:**

Frontend có thể detect `needsClarification: true` và hiển thị:
- Câu hỏi làm rõ với UI đặc biệt
- Quick action buttons cho các lựa chọn
- Gợi ý câu hỏi phổ biến

Ví dụ:
```tsx
if (response.validation?.needsClarification) {
  // Show clarification UI with suggested options
  showClarificationDialog(response.message);
}
```

---

Hệ thống này giúp tạo ra trải nghiệm chat AI thông minh và thân thiện, luôn hướng dẫn người dùng đến kết quả mong muốn thay vì từ chối!
