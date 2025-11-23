# API Room Publishing với AI

## Endpoint

**POST** `/api/ai/room-publish`

**Authentication**: Bắt buộc (JWT Bearer Token)

## Request

```typescript
{
  message?: string;      // Tin nhắn của user (optional - có thể rỗng để trigger tạo phòng)
  buildingId?: string;   // ID hoặc slug của building (optional)
  images?: string[];     // Danh sách đường dẫn hình ảnh (optional)
}
```

**Ví dụ**:
```json
{
  "message": "Phòng trọ 20m2, giá 2.5 triệu, nước 50k 1 người, điện 3.5k",
  "buildingId": "nhi-tuong-phong-troquan-go-vap",
  "images": ["/images/photo1.jpg"]
}
```

## Response - 4 Trạng thái

### 1. NEED_MORE_INFO - Cần thêm thông tin

```typescript
{
  success: true,
  data: {
    kind: 'CONTROL',
    sessionId: string,
    message: string,  // Câu hỏi từ AI
    payload: {
      mode: 'ROOM_PUBLISH',
      status: 'NEED_MORE_INFO',
      missingField?: string,      // Field còn thiếu
      hasPendingActions?: boolean  // Đang chờ xử lý actions
    },
    meta: {
      stage: string,
      pendingActions?: number,
      actionTypes?: string
    }
  }
}
```

**Hành động**: Hiển thị message và chờ user trả lời

### 2. READY_TO_CREATE - Sẵn sàng tạo phòng

```typescript
{
  success: true,
  data: {
    kind: 'CONTROL',
    sessionId: string,
    message: string,  // "Hoàn tất! Mình sẽ tạo phòng trọ cho bạn ngay."
    payload: {
      mode: 'ROOM_PUBLISH',
      status: 'READY_TO_CREATE',
      plan: {
        shouldCreateBuilding: boolean,
        buildingId?: string,
        buildingPayload?: CreateBuildingDto,
        roomPayload: CreateRoomDto
      }
    },
    meta: {
      stage: 'finalize-room',
      planReady: true
    }
  }
}
```

**Hành động**: 
- Nếu `message` rỗng → Backend tự động tạo phòng
- Nếu có `message` → Hiển thị xác nhận, gửi request rỗng để trigger tạo phòng

### 3. CREATED - Đã tạo thành công

```typescript
{
  success: true,
  data: {
    kind: 'CONTROL',
    sessionId: string,
    message: string,  // "Đã tạo phòng thành công!"
    payload: {
      mode: 'ROOM_PUBLISH',
      status: 'CREATED',
      roomId: string,
      roomSlug: string,
      roomPath: string  // "/rooms/{slug}" - dùng để redirect
    }
  }
}
```

**Hành động**: Redirect user tới `roomPath`

### 4. CREATION_FAILED - Tạo thất bại

```typescript
{
  success: true,
  data: {
    kind: 'CONTROL',
    sessionId: string,
    message: string,  // Thông báo lỗi
    payload: {
      mode: 'ROOM_PUBLISH',
      status: 'CREATION_FAILED',
      error: string
    }
  }
}
```

**Hành động**: Hiển thị lỗi cho user

## Flow đơn giản

1. **Gửi thông tin phòng** → Nhận `NEED_MORE_INFO` hoặc `READY_TO_CREATE`
2. **Nếu `READY_TO_CREATE`** → Gửi request rỗng (`message: ""`) để trigger tạo phòng
3. **Nhận `CREATED`** → Redirect tới `roomPath`

## Ví dụ code

```typescript
// 1. Gửi thông tin phòng
const response = await fetch('/api/ai/room-publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: "Phòng trọ 20m2, giá 2.5 triệu",
    buildingId: "nhi-tuong-phong-troquan-go-vap",
    images: ["/images/photo1.jpg"]
  })
});

const result = await response.json();

// 2. Xử lý theo status
switch (result.data.payload.status) {
  case 'NEED_MORE_INFO':
    // Hiển thị message, chờ user trả lời
    showMessage(result.data.message);
    break;
    
  case 'READY_TO_CREATE':
    // Gửi request rỗng để trigger tạo phòng
    const createResponse = await fetch('/api/ai/room-publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: "",  // Rỗng để trigger tạo phòng
        buildingId: result.data.payload.plan.buildingId
      })
    });
    const createResult = await createResponse.json();
    
    if (createResult.data.payload.status === 'CREATED') {
      // Redirect tới trang phòng
      window.location.href = createResult.data.payload.roomPath;
    }
    break;
    
  case 'CREATED':
    // Redirect tới trang phòng
    window.location.href = result.data.payload.roomPath;
    break;
    
  case 'CREATION_FAILED':
    // Hiển thị lỗi
    showError(result.data.message);
    break;
}
```

## Lưu ý

- **Session**: Tự động quản lý theo `userId`, không cần truyền `sessionId`
- **buildingId**: Có thể là UUID hoặc slug
- **Auto-create**: Khi `status = READY_TO_CREATE` và gửi `message = ""`, backend tự động tạo phòng
- **Thông tin bắt buộc**: Giá thuê (`basePriceMonthly`) và địa điểm (nếu không có `buildingId`)
- **Thông tin tự động**: Tên phòng, mô tả, loại phòng, số phòng (AI tự tạo)
