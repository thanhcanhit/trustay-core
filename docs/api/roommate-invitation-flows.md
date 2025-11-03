# Roommate Invitation Flows - API Documentation

Tài liệu mô tả 2 flow mời người ở ghép: **Mời trực tiếp** và **Mời bằng link**.

## Tổng quan

Có 2 cách để thêm người vào phòng:

1. **Mời trực tiếp (Add Roommate Directly)**: Thêm người vào phòng ngay lập tức bằng email/phone, tự động tạo rental
2. **Mời bằng link (Invite by Link)**: Tạo link mời, người nhận accept và tạo application, đi qua flow approval

---

## Flow 1: Mời trực tiếp (Add Roommate Directly)

### Mô tả

Flow này cho phép **tenant** hoặc **landlord** thêm trực tiếp một người vào phòng chỉ bằng **email** hoặc **số điện thoại**, mà không cần:
- Tạo application
- Chờ approval
- Quy trình phức tạp

**Rental sẽ được tạo tự động ngay lập tức.**

### Flow Diagram

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

### API Endpoint

**Endpoint:** `POST /api/roommate-applications/:postId/add-roommate`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```typescript
{
  email?: string;                // Chỉ cần một trong 3: email, phone, hoặc userId
  phone?: string;
  userId?: string;
  
  // Optional - chỉ nhập nếu cần thiết
  moveInDate?: string;           // Mặc định là ngày hiện tại (ISO 8601: YYYY-MM-DD)
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

### Flow Details

1. **Tìm User**: Tìm user theo email/phone/userId
2. **Validation**: 
   - Kiểm tra user có tồn tại
   - Kiểm tra user có rental active không
   - Kiểm tra post có tồn tại và user có quyền không
   - Kiểm tra room còn slot trống không
3. **Tạo Rental**: Tạo rental mới với status `active`
4. **Update Post**: Tăng `currentOccupancy` của post
5. **Notifications**: Gửi notification cho user được thêm và tenant/landlord

### Đặc điểm

- ✅ **Tạo rental ngay lập tức** - Không cần approval
- ✅ **Đơn giản** - Chỉ cần email/phone
- ✅ **Nhanh** - Không qua các bước phức tạp
- ⚠️ **Yêu cầu quyền** - Chỉ tenant/landlord của post mới có quyền

---

## Flow 2: Mời bằng link (Invite by Link)

### Mô tả

Flow này cho phép:
1. **Người A** (có rental) tạo invite link và chia sẻ
2. **Người B** (nhận link) chấp nhận invite và tạo application tự động
3. Sử dụng lại flow application hiện tại (approve → confirm → tạo rental)

### Flow Diagram

```
┌─────────────┐
│  Người A    │
│ (có rental) │
└──────┬──────┘
       │
       │ 1. Generate Invite Link
       │ POST /roommate-applications/generate-invite-link
       │
       ▼
┌─────────────────────┐
│  Nhận invite link   │
│  {FRONTEND_URL}/    │
│  invite?token=xxx   │
└──────┬──────────────┘
       │
       │ Share link với Người B
       │
       ▼
┌─────────────┐
│  Người B    │
│ (nhận link) │
└──────┬──────┘
       │
       │ 2. Accept Invite
       │ POST /roommate-applications/accept-invite
       │
       ▼
┌─────────────────────┐
│ Application created │
│ (auto-created post) │
└──────┬──────────────┘
       │
       │ 3. Existing Flow
       │ Tenant approve → Landlord approve → Applicant confirm
       │
       ▼
┌─────────────┐
│ Rental created│
└─────────────┘
```

### API Endpoints

#### 1. Generate Invite Link

**Endpoint:** `POST /api/roommate-applications/generate-invite-link`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```typescript
{
  inviteLink: string;              // Full URL: {FRONTEND_URL}/invite?token=xxx
  token: string;                   // JWT token (expires in 30 days)
  rentalId: string;                // ID của rental hiện tại
  roommateSeekingPostId?: string; // ID của post (nếu có)
  expiresAt: string;               // ISO date string
}
```

**Error Cases:**
- `400`: User chưa có phòng thuê active
- `401`: Chưa xác thực

#### 2. Accept Invite

**Endpoint:** `POST /api/roommate-applications/accept-invite`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```typescript
{
  token: string;                    // Token từ invite link
  fullName: string;                  // Bắt buộc
  phoneNumber: string;              // Bắt buộc
  moveInDate: string;               // ISO date string, bắt buộc
  occupation?: string;              // Tùy chọn
  intendedStayMonths?: number;      // Tùy chọn
  applicationMessage?: string;      // Tùy chọn
  isUrgent?: boolean;               // Tùy chọn
}
```

**Response:**
```typescript
{
  id: string;
  roommateSeekingPostId: string;
  applicantId: string;
  fullName: string;
  occupation?: string;
  phoneNumber: string;
  moveInDate: string;
  intendedStayMonths?: number;
  applicationMessage?: string;
  status: 'pending' | 'approved_by_tenant' | 'rejected_by_tenant' | ...;
  // ... other fields
}
```

**Error Cases:**
- `400`: Dữ liệu không hợp lệ, đã có application, đã có rental khác, token không hợp lệ
- `401`: Token hết hạn hoặc chưa xác thực
- `404`: Không tìm thấy rental hoặc post

### Flow Details

#### Bước 1: Generate Invite Link (Người A)

1. Tìm active rental của user
2. Tìm roommate seeking post liên quan (nếu có)
3. Tạo JWT token chứa:
   - `rentalId`
   - `roomInstanceId`
   - `tenantId`
   - `roommateSeekingPostId` (nếu có)
4. Token có thời hạn 30 ngày
5. Trả về invite link: `{FRONTEND_URL}/invite?token={token}`

#### Bước 2: Accept Invite (Người B)

1. **Verify Token**: Decode và verify JWT token
2. **Validation**:
   - Kiểm tra tenant không phải là applicant (không thể mời chính mình)
   - Kiểm tra rental còn active
   - Kiểm tra user chưa có application cho rental này
   - Kiểm tra user chưa có rental active khác
3. **Tìm hoặc tạo Post**:
   - Nếu có `roommateSeekingPostId`: Sử dụng post hiện có
   - Nếu không: Tạo post mới (non-public, chỉ cho direct invites)
4. **Tạo Application**: Tạo application với thông tin từ form
5. **Notifications**: Gửi notification cho tenant về application mới

#### Bước 3: Application Flow (Tiếp tục flow hiện tại)

Sau khi accept invite, application đi qua flow approval:
1. Tenant approve/reject
2. Landlord approve (nếu platform room)
3. Applicant confirm
4. Rental được tạo tự động

### Đặc điểm

- ✅ **Linh hoạt** - Có thể chia sẻ link với nhiều người
- ✅ **Có approval** - Đi qua flow application để kiểm tra
- ✅ **An toàn** - Token có thời hạn, verify kỹ
- ⚠️ **Phức tạp hơn** - Cần nhiều bước hơn flow trực tiếp
- ⚠️ **Yêu cầu authentication** - Người nhận phải đăng nhập để accept

---

## So sánh 2 Flow

| Tiêu chí | Mời trực tiếp | Mời bằng link |
|----------|--------------|---------------|
| **Tốc độ** | ⚡ Rất nhanh - Tạo rental ngay | 🐌 Chậm hơn - Cần approval |
| **Quy trình** | ✅ Đơn giản - 1 bước | ⚙️ Phức tạp - Nhiều bước |
| **Approval** | ❌ Không cần | ✅ Có approval flow |
| **Số người** | 1 người/lần | Nhiều người (share link) |
| **Yêu cầu** | Email/phone | User phải đăng nhập |
| **An toàn** | ⚠️ Ít kiểm tra hơn | ✅ Kiểm tra kỹ hơn |
| **Use case** | Thêm người đã biết, tin tưởng | Mời người chưa biết, cần xem xét |

## Khi nào dùng Flow nào?

### Dùng Flow 1 (Mời trực tiếp) khi:
- Thêm người đã quen biết, tin tưởng
- Cần thêm người ngay lập tức
- Đã biết email/phone của người cần thêm
- Không cần approval process

### Dùng Flow 2 (Mời bằng link) khi:
- Mời người chưa biết rõ
- Cần approval process
- Muốn chia sẻ link với nhiều người
- Người nhận cần điền form application
- Cần kiểm tra kỹ trước khi cho vào phòng

## Related Endpoints

Sau khi thêm roommate thành công, có thể sử dụng các endpoints sau để quản lý rental:

- `GET /api/rentals/:rentalId` - Xem chi tiết rental
- `PATCH /api/rentals/:rentalId` - Cập nhật rental
- `DELETE /api/rentals/:rentalId` - Xóa rental (kết thúc hợp đồng)
- `GET /api/roommate-applications/:applicationId` - Xem chi tiết application
- `POST /api/roommate-applications/:applicationId/approve` - Approve application
- `POST /api/roommate-applications/:applicationId/reject` - Reject application

