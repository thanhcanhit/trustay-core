# Add Roommate Directly - API Documentation

Tài liệu mô tả API và flow thêm người trực tiếp vào phòng (không qua application flow).

## Tổng quan

API này cho phép **tenant** hoặc **landlord** thêm trực tiếp một người vào phòng chỉ bằng **email** hoặc **số điện thoại**, mà không cần:
- Tạo application
- Chờ approval
- Quy trình phức tạp

Rental sẽ được tạo tự động ngay lập tức.

## Flow Diagram

```
┌─────────────┐
│  Tenant/    │
│  Landlord   │
└──────┬──────┘
       │
       │ 1. Nhập email hoặc số điện thoại
       │ POST /roommate-applications/:postId/add-roommate
       │
       ▼
┌─────────────────────┐
│ System tự động:     │
│ - Tìm user          │
│ - Validate          │
│ - Tạo rental        │
│ - Update post       │
└──────┬──────────────┘
       │
       ▼
┌─────────────┐
│ Rental tạo  │
│ thành công  │
└─────────────┘
```

## API Endpoint

### Add Roommate Directly

**Endpoint:** `POST /api/roommate-applications/:postId/add-roommate`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body (Minimal - chỉ cần email hoặc phone):**
```typescript
{
  email?: string;                // Chỉ cần một trong 3: email, phone, hoặc userId
  phone?: string;
  userId?: string;
  
  // Optional - chỉ nhập nếu cần thiết
  moveInDate?: string;           // Mặc định là ngày hiện tại
  intendedStayMonths?: number;   // Optional
}
```

**Response:**
```
Status: 201 Created
Body: (empty)
```

**Error Cases:**

| Status Code | Description |
|------------|-------------|
| `400 Bad Request` | Dữ liệu không hợp lệ, user đã có rental active, phòng đã hết chỗ trống |
| `401 Unauthorized` | Chưa xác thực, thiếu hoặc invalid access token |
| `403 Forbidden` | Không có quyền (chỉ tenant hoặc landlord của post mới có quyền) |
| `404 Not Found` | Không tìm thấy post hoặc user với email/phone được cung cấp |

**Error Response Format:**
```json
{
  "statusCode": 400,
  "message": "User đã có rental active trong phòng khác",
  "error": "Bad Request"
}
```

## Flow Details

### 1. Tìm User
- Nếu cung cấp `email`: Tìm user theo email
- Nếu cung cấp `phone`: Tìm user theo số điện thoại
- Nếu cung cấp `userId`: Sử dụng trực tiếp userId

### 2. Validation
- Kiểm tra user có tồn tại
- Kiểm tra user có rental active không
- Kiểm tra post có tồn tại và user có quyền không
- Kiểm tra room còn slot trống không

### 3. Tạo Rental
- Tạo rental mới với:
  - `tenantId`: User được thêm
  - `roomInstanceId`: Từ post
  - `contractStartDate`: `moveInDate` hoặc ngày hiện tại
  - `contractEndDate`: Tính từ `intendedStayMonths` (nếu có)
  - `status`: `active`

### 4. Update Post
- Tăng `currentOccupancy` của post
- Nếu `currentOccupancy` >= `maxOccupancy`, có thể set `isActive = false`

### 5. Notifications
- Gửi notification cho user được thêm về rental mới
- Gửi notification cho tenant/landlord về việc thêm roommate mới

## Important Notes

### ⚠️ Required Fields

**Chỉ cần một trong các field sau:**
- `email` - Email của người cần thêm
- `phone` - Số điện thoại của người cần thêm  
- `userId` - ID của user (nếu đã biết)

**Không thể thiếu tất cả 3 fields cùng lúc.**

### ✅ Optional Fields

- `moveInDate` - **Mặc định là ngày hiện tại** (ISO 8601 format: `YYYY-MM-DD`), chỉ nhập nếu cần date khác
- `intendedStayMonths` - Số tháng dự định ở (optional, nếu không có thì contract không có end date)

### 🔐 Authentication & Authorization

- **Authentication**: Required (Bearer token trong header)
- **Authorization**: 
  - Chỉ **tenant** hoặc **landlord** của post mới có quyền thêm roommate
  - User được thêm không thể tự thêm chính mình (phải có người khác thêm)

### 📋 Validation Rules

1. **Email**: Phải là format email hợp lệ
2. **Phone**: Phải là format số điện thoại hợp lệ (có thể có + prefix)
3. **User**: User phải tồn tại trong hệ thống
4. **Rental**: User không được có rental active khác
5. **Room Slot**: Room phải còn slot trống (currentOccupancy < maxOccupancy)
6. **Post Status**: Post phải active

### 🔄 Side Effects

Khi thêm roommate thành công:
1. Rental mới được tạo với status `active`
2. `currentOccupancy` của post được tăng lên
3. User nhận notification về rental mới
4. Tenant/Landlord nhận notification về việc thêm roommate

## Related Endpoints

Sau khi thêm roommate thành công, có thể sử dụng các endpoints sau để quản lý rental:

- `GET /api/rentals/:rentalId` - Xem chi tiết rental
- `PATCH /api/rentals/:rentalId` - Cập nhật rental
- `DELETE /api/rentals/:rentalId` - Xóa rental (kết thúc hợp đồng)


