## Room Issue Reporting (Báo cáo sự cố phòng)

### Mục tiêu
- Cho phép **tenant** báo cáo mọi loại sự cố (vật lý, tiện ích, hàng xóm ồn ào, wifi yếu...).
- Cung cấp cho **landlord** danh sách sự cố chưa xử lý, được ưu tiên theo thời gian tạo.
- Phát sinh **notification real-time** tới landlord ngay khi có báo cáo mới.

### Mô hình dữ liệu chính
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `title` | string | Tiêu đề ngắn cho sự cố. |
| `category` | `RoomIssueCategory` | `facility`, `utility`, `neighbor`, `noise`, `security`, `other`. |
| `status` | `RoomIssueStatus` | `new` (mặc định), `in_progress`, `resolved`. |
| `imageUrls` | `string[]` | Tối đa 10 link ảnh minh chứng (tùy chọn). |
| `roomInstanceId` | UUID | Instance phòng gắn với rental đang active. |
| `reporterId` | UUID | Tự động lấy từ user hiện tại. |

### Hành vi status & sắp xếp
- Nếu **không truyền status**, API chỉ trả về các issue đang cần xử lý (`new`, `in_progress`).
- Danh sách được **sắp xếp tăng dần theo `createdAt`** để issue cũ nhất hiển thị trước.
- FE có thể truyền `status` cụ thể để xem lịch sử (bao gồm `resolved`).

---

## Cấu trúc Response DTO

### `RoomIssueResponseDto`
Đây là DTO chính được trả về từ tất cả các API endpoints liên quan đến room issues.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | UUID | ID duy nhất của issue. |
| `title` | string | Tiêu đề ngắn mô tả sự cố. |
| `category` | `RoomIssueCategory` | Loại sự cố (xem enum bên dưới). |
| `status` | `RoomIssueStatus` | Trạng thái xử lý (xem enum bên dưới). |
| `imageUrls` | `string[]` | Mảng các URL ảnh minh chứng (có thể rỗng). |
| `createdAt` | DateTime (ISO 8601) | Thời điểm tạo issue. |
| `updatedAt` | DateTime (ISO 8601) | Thời điểm cập nhật lần cuối. |
| `reporter` | `RoomIssueReporterDto` | Thông tin người báo cáo (xem bảng dưới). |
| `roomInstance` | `RoomIssueRoomInstanceDto` | Thông tin phòng instance (xem bảng dưới). |

#### `RoomIssueReporterDto` (nested trong `reporter`)
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | UUID | ID của người báo cáo. |
| `firstName` | string \| null | Tên của người báo cáo (có thể null). |
| `lastName` | string \| null | Họ của người báo cáo (có thể null). |
| `email` | string | Email của người báo cáo. |
| `phone` | string \| null | Số điện thoại (có thể null). |

#### `RoomIssueRoomInstanceDto` (nested trong `roomInstance`)
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | UUID | ID của room instance. |
| `roomNumber` | string | Số phòng (ví dụ: "101", "A-205"). |
| `room` | `RoomIssueRoomDto` | Thông tin phòng (xem bảng dưới). |

#### `RoomIssueRoomDto` (nested trong `roomInstance.room`)
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | UUID | ID của phòng. |
| `name` | string | Tên phòng. |
| `slug` | string | Slug URL-friendly của phòng. |
| `buildingId` | UUID | ID của tòa nhà chứa phòng. |
| `buildingName` | string | Tên tòa nhà. |
| `ownerId` | UUID | ID của landlord sở hữu tòa nhà. |

### Enums

#### `RoomIssueCategory`
Các giá trị có thể:
- `facility` - Sự cố về cơ sở vật chất (tường, cửa, sàn...)
- `utility` - Sự cố về tiện ích (điện, nước, wifi...)
- `neighbor` - Vấn đề với hàng xóm
- `noise` - Tiếng ồn
- `security` - Vấn đề an ninh
- `other` - Khác

#### `RoomIssueStatus`
Các giá trị có thể:
- `new` - Mới tạo, chưa xử lý
- `in_progress` - Đang xử lý
- `resolved` - Đã giải quyết

### Ví dụ Response

```json
{
  "success": true,
  "message": "Room issue reported successfully",
  "data": {
    "id": "e1e7c5fd-1f68-4e1b-8178-8ad2a0e5b5b9",
    "title": "Water leakage near the bathroom door",
    "category": "utility",
    "status": "new",
    "imageUrls": [
      "https://cdn.trustay.vn/issues/leak-1.jpg",
      "https://cdn.trustay.vn/issues/leak-2.jpg"
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "reporter": {
      "id": "0e2c1f30-4d75-4d8d-9ecc-7f643fe81c23",
      "firstName": "Nguyễn",
      "lastName": "Văn A",
      "email": "nguyenvana@example.com",
      "phone": "+84901234567"
    },
    "roomInstance": {
      "id": "f3d9f525-8d4a-45d1-9501-893e3627ef4f",
      "roomNumber": "101",
      "room": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "Phòng 101 - Tầng 1",
        "slug": "phong-101-tang-1",
        "buildingId": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "buildingName": "Chung cư ABC",
        "ownerId": "c1c2c3d4-e5f6-7890-abcd-ef1234567890"
      }
    }
  }
}
```

**Lưu ý**: Tất cả các API endpoints đều trả về response được bọc trong `ApiResponseDto` với cấu trúc:
- `success`: boolean - Trạng thái thành công/thất bại
- `message`: string - Thông báo mô tả
- `data`: T - Dữ liệu thực tế (có thể là `RoomIssueResponseDto` hoặc `PaginatedResponseDto<RoomIssueResponseDto>`)

---

## API & DTO chi tiết

### 1. `POST /room-issues` – Tenant báo cáo sự cố
- **Auth**: Tenant (JWT, rental đang active với `roomInstanceId`).
- **DTO yêu cầu** `CreateRoomIssueDto`:
  | Trường | Kiểu | Bắt buộc | Ghi chú |
  |--------|------|----------|---------|
  | `roomInstanceId` | UUID | ✅ | Phải thuộc rental active của tenant. |
  | `title` | string (≤120) | ✅ | Tiêu đề ngắn. |
  | `category` | `RoomIssueCategory` | ✅ | Chọn từ enum. |
  | `imageUrls` | string[] | ❌ | Tối đa 10 link, có thể rỗng. |
- **Kết quả**: `ApiResponseDto<RoomIssueResponseDto>`
  - Xem chi tiết cấu trúc `RoomIssueResponseDto` ở section "Cấu trúc Response DTO" phía trên.
- **Flow**:
  1. Backend kiểm tra rental active của tenant.
  2. Lưu issue với `status = new`.
  3. Gửi notification `ROOM_ISSUE_REPORTED` cho landlord sở hữu building.

### 2. `GET /room-issues/me` – Tenant xem sự cố đã báo
- **Auth**: Tenant (JWT).
- **Query DTO** `RoomIssueQueryDto`:
  | Trường | Kiểu | Mặc định | Ghi chú |
  |--------|------|----------|---------|
  | `page` | number (>=1) | 1 | Phân trang. |
  | `limit` | number (1-50) | 20 | Phân trang. |
  | `roomInstanceId` | UUID | - | Lọc theo phòng. |
  | `category` | `RoomIssueCategory` | - | Lọc theo loại. |
  | `status` | `RoomIssueStatus` | chỉ open | Nếu không truyền thì backend tự áp dụng `new` + `in_progress`. |
- **Response**: `ApiResponseDto<PaginatedResponseDto<RoomIssueResponseDto>>`.
- **FE flow**:
  1. Mặc định gọi không truyền status để chỉ thấy việc cần xử lý.
  2. Khi tenant cần xem lịch sử đã giải quyết => truyền `status=resolved`.

### 3. `GET /room-issues/landlord` – Landlord xem sự cố trong hệ thống của mình
- **Auth**: Landlord (JWT, role check).
- **Query DTO** `LandlordRoomIssueQueryDto`:
  | Trường | Kiểu | Mặc định | Ghi chú |
  |--------|------|----------|---------|
  | Các trường từ `RoomIssueQueryDto` | | | Giống tenant. |
  | `reporterId` | UUID | - | Lọc theo người báo cáo cụ thể. |
- **Response**: `ApiResponseDto<PaginatedResponseDto<RoomIssueResponseDto>>` (chỉ dữ liệu thuộc các building landlord sở hữu).
- **Flow**:
  1. Mặc định hiển thị issue open theo thứ tự cũ nhất.
  2. Landlord có thể lọc theo phòng, tenant, category hoặc status.
  3. Sau khi xử lý xong, phía landlord có thể cập nhật status thông qua tool nội bộ (API chưa định nghĩa update trong phạm vi này).

### 4. `GET /room-issues/:issueId` – Chi tiết sự cố
- **Auth**: Tenant hoặc Landlord.
- **Điều kiện truy cập**:
  - Tenant chỉ xem được issue do chính mình tạo.
  - Landlord chỉ xem được issue thuộc building mình sở hữu.
- **Response**: `ApiResponseDto<RoomIssueResponseDto>`.

---

## Flow tương tác hai phía

### Tenant
1. Gửi issue (POST).
2. Xem danh sách open issue (GET `/me` mặc định).
3. Theo dõi cập nhật từ landlord (qua chat, notification, hoặc timeline khác – tùy UI).

### Landlord
1. Nhận notification `ROOM_ISSUE_REPORTED` với `{ roomName, roomNumber, tenantName, issueId, category, title }`.
2. Vào màn hình quản lý gọi `GET /landlord` để thấy backlog được sắp xếp theo thời gian.
3. Chủ động liên hệ tenant hoặc cập nhật trạng thái (khi có API update trong tương lai).

Tài liệu này cung cấp đủ DTO để FE xây dựng màn hình và flow tương tác cho cả hai vai trò. Nếu cần thêm API cập nhật status, vui lòng mở yêu cầu riêng để thiết kế thêm.

