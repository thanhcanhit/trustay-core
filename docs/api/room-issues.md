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
- **Kết quả**: `RoomIssueResponseDto`
  | Trường chính | Mô tả |
  |--------------|-------|
  | `id`, `title`, `category`, `status`, `imageUrls`, `createdAt`, `updatedAt` |
  | `reporter` | `{ id, firstName, lastName, email, phone }` |
  | `roomInstance` | `{ id, roomNumber, room: { id, name, slug, buildingId, buildingName, ownerId } }` |
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
- **Response**: `PaginatedResponseDto<RoomIssueResponseDto>`.
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
- **Response**: `PaginatedResponseDto<RoomIssueResponseDto>` (chỉ dữ liệu thuộc các building landlord sở hữu).
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

