# Frontend Guide: Sử dụng currentPage trong Conversation API

## Tóm tắt nhanh

**`currentPage` đi theo từng tin nhắn cụ thể, không phải theo conversation.**

Mỗi khi user gửi tin nhắn, Frontend cần gửi `currentPage` (URL pathname hiện tại) để AI hiểu context và có thể phân tích entity cụ thể mà user đang xem.

---

## Khi nào cần gửi currentPage?

### ✅ CẦN GỬI khi:
- User đang ở trang chi tiết và muốn AI phân tích/tham chiếu entity đó
- Ví dụ: 
  - `/rooms/slug-123` + chat "phân tích phòng này"
  - `/room-seeking-posts/slug-456` + chat "đánh giá bài đăng này"

### ❌ KHÔNG CẦN GỬI khi:
- User đang ở trang home, list, search
- Query chung không liên quan đến entity cụ thể
- Ví dụ:
  - `/` + chat "tìm phòng giá rẻ"
  - `/rooms` + chat "hiển thị danh sách phòng"

---

## Format của currentPage

**PHẢI là URL pathname thuần túy** (không có domain, query params, hash):

```typescript
// ✅ ĐÚNG
"/rooms/tuyenquan-go-vap-phong-ap1443"
"/rooms/123e4567-e89b-12d3-a456-426614174000" // UUID
"/room-seeking-posts/bai-dang-tim-nguoi-o-ghep"
"/roommate-seeking-posts/tim-ban-o-ghep"

// ❌ SAI
"https://trustay.com/rooms/abc-123" // Có domain
"/rooms/abc-123?tab=details" // Có query params
"/rooms/abc-123#amenities" // Có hash
```

---

## Cách implement trong Frontend

### 1. Lấy currentPage từ window.location.pathname

```typescript
const currentPage = window.location.pathname; // e.g., "/rooms/abc-123"
```

### 2. Gửi khi tạo conversation với initial message

```typescript
const response = await fetch('/api/ai/conversations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Optional
  },
  body: JSON.stringify({
    initialMessage: "phân tích phòng này",
    currentPage: window.location.pathname // ✅ Gửi currentPage
  })
});
```

### 3. Gửi khi gửi message trong conversation

```typescript
const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Optional
  },
  body: JSON.stringify({
    message: "phân tích phòng này",
    currentPage: window.location.pathname // ✅ Gửi currentPage cho mỗi tin nhắn
  })
});
```

### 4. React Hook Example (Recommended)

```typescript
import { useState, useEffect } from 'react';

const useConversation = (conversationId: string) => {
  const [currentPage, setCurrentPage] = useState<string | undefined>();

  // Track current page khi route thay đổi
  useEffect(() => {
    const updateCurrentPage = () => {
      setCurrentPage(window.location.pathname);
    };
    
    updateCurrentPage();
    window.addEventListener('popstate', updateCurrentPage);
    
    return () => window.removeEventListener('popstate', updateCurrentPage);
  }, []);

  const sendMessage = async (message: string) => {
    const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message,
        currentPage: currentPage // ✅ Tự động gửi currentPage hiện tại
      })
    });
    
    return response.json();
  };

  return { sendMessage };
};
```

---

## Ví dụ Use Cases

### Use Case 1: Phân tích phòng hiện tại

**Scenario**: User đang ở trang `/rooms/tuyenquan-go-vap-phong-ap1443` và chat "phân tích phòng này"

```typescript
await sendMessage(conversationId, "phân tích phòng này", "/rooms/tuyenquan-go-vap-phong-ap1443");
```

**Kết quả**: AI sẽ:
- Hiểu "phòng này" = phòng có slug "tuyenquan-go-vap-phong-ap1443"
- Set `MODE_HINT=INSIGHT` (phân tích chi tiết với markdown formatting)
- Filter theo `rooms.slug='tuyenquan-go-vap-phong-ap1443'`
- Trả về phân tích đầy đủ về giá cả, tiện ích, đánh giá hợp lý

### Use Case 2: So sánh phòng

**Scenario**: User đang ở `/rooms/phong-abc-123` và chat "so sánh với phòng xyz-456"

```typescript
await sendMessage(conversationId, "so sánh với phòng xyz-456", "/rooms/phong-abc-123");
```

**Kết quả**: AI sẽ:
- Hiểu "so sánh" = so sánh phòng hiện tại (phong-abc-123) với phòng xyz-456
- Query cả 2 phòng và so sánh giá cả, tiện ích

### Use Case 3: Tìm kiếm chung (không có currentPage)

**Scenario**: User đang ở `/` (home page) và chat "tìm phòng giá rẻ ở quận 1"

```typescript
await sendMessage(conversationId, "tìm phòng giá rẻ ở quận 1"); // Không gửi currentPage
```

**Kết quả**: AI sẽ:
- Hiểu đây là query tìm kiếm chung
- Set `MODE_HINT=TABLE` hoặc `LIST`
- Query tất cả phòng phù hợp với filter

---

## Lưu ý quan trọng

1. **`currentPage` đi theo từng tin nhắn**: 
   - Tin nhắn 1: User ở `/rooms/abc-123` → gửi `currentPage="/rooms/abc-123"`
   - Tin nhắn 2: User đã chuyển sang `/rooms/xyz-456` → gửi `currentPage="/rooms/xyz-456"`
   - Tin nhắn 3: User ở `/` → không gửi `currentPage` (hoặc `null`)

2. **Chỉ gửi khi cần thiết**: 
   - Chỉ gửi khi user đang ở trang chi tiết và muốn AI tham chiếu đến entity đó
   - Không cần gửi khi ở trang home, list, hoặc search

3. **Format đúng**: 
   - Phải là pathname thuần túy (không có domain, query params, hash)
   - Sử dụng `window.location.pathname` để lấy

4. **Optional field**: 
   - `currentPage` là optional, nếu không có thì AI sẽ xử lý như query chung

---

## Supported Routes

AI có thể parse và hiểu các routes sau:

- `/rooms/{slug}` hoặc `/rooms/{uuid}` → Entity: `room`
- `/room-seeking-posts/{slug}` → Entity: `room_seeking_post`
- `/roommate-seeking-posts/{slug}` → Entity: `roommate_seeking_post`
- `/buildings/{slug}` → Entity: `building`

---

## Troubleshooting

### AI không hiểu "phòng này" hoặc "phòng hiện tại"

**Nguyên nhân**: Không gửi `currentPage` hoặc format sai

**Giải pháp**:
1. Kiểm tra xem có gửi `currentPage` trong request body không
2. Kiểm tra format: phải là pathname thuần túy (không có domain, query params)
3. Kiểm tra route có được support không (xem section "Supported Routes")

### AI trả về kết quả không đúng phòng

**Nguyên nhân**: `currentPage` không match với phòng user đang xem

**Giải pháp**:
1. Đảm bảo `currentPage` được update khi route thay đổi
2. Sử dụng React Hook hoặc event listener để track route changes
3. Log `currentPage` trước khi gửi để debug

---

## Quick Reference

```typescript
// ✅ Template đúng
const sendMessage = async (conversationId: string, message: string) => {
  const currentPage = window.location.pathname; // Lấy pathname hiện tại
  
  const response = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Optional
    },
    body: JSON.stringify({
      message,
      currentPage: currentPage // ✅ Luôn gửi currentPage (có thể là undefined nếu ở home)
    })
  });
  
  return response.json();
};
```

