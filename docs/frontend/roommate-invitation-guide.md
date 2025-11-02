# Roommate Invitation Guide - Frontend

Tài liệu ngắn gọn hướng dẫn frontend implement 2 flow mời người ở ghép.

## Tổng quan

Có 2 cách để thêm người vào phòng:

1. **Add Roommate Directly**: Thêm trực tiếp bằng email/phone → Tạo rental ngay
2. **Invite by Link**: Tạo link mời → Người nhận accept → Đi qua approval flow → Tạo rental

---

## Flow 1: Add Roommate Directly

### Mô tả

Thêm người vào phòng ngay lập tức bằng email/phone, **không cần approval**. Rental được tạo tự động.

### API Endpoint

**POST** `/api/roommate-applications/:postId/add-roommate`

**Request:**
```typescript
{
  email?: string;          // Một trong 3: email, phone, hoặc userId
  phone?: string;
  userId?: string;
  moveInDate?: string;     // Optional: mặc định là hôm nay (YYYY-MM-DD)
  intendedStayMonths?: number; // Optional
}
```

**Response:**
- Status: `201 Created`
- Body: `(empty)`

**Errors:**
- `400`: User đã có rental, phòng hết chỗ, dữ liệu không hợp lệ
- `403`: Không có quyền (chỉ tenant/landlord)
- `404`: Không tìm thấy post hoặc user

### Flow

```
Tenant/Landlord → POST add-roommate → System tạo rental → Success
```

### Notifications

- **User được thêm**: Nhận 2 notifications
  - `ROOMMATE_APPLICATION_APPROVED`: "Đơn ứng tuyển của bạn đã được chấp nhận"
  - `RENTAL_CREATED`: "Hợp đồng thuê đã được tạo"
- **Tenant/Landlord**: Nhận `RENTAL_CREATED`

---

## Flow 2: Invite by Link

### Mô tả

Tenant tạo invite link → Chia sẻ link → Người nhận accept → Tạo application (tenant auto-approved) → Landlord approve (nếu platform room) → Applicant confirm → Tạo rental

### API Endpoints

#### 1. Generate Invite Link

**POST** `/api/roommate-applications/generate-invite-link`

**Response:**
```typescript
{
  inviteLink: string;    // {FRONTEND_URL}/invite?token=xxx
  token: string;         // JWT token (expires in 30 days)
  rentalId: string;
  roommateSeekingPostId?: string;
  expiresAt: string;     // ISO date
}
```

**Errors:**
- `400`: User chưa có rental active
- `401`: Chưa xác thực

#### 2. Accept Invite

**POST** `/api/roommate-applications/accept-invite`

**Request:**
```typescript
{
  token: string;                    // Từ invite link
  fullName: string;                  // Required
  phoneNumber: string;               // Required
  moveInDate: string;               // Required (YYYY-MM-DD)
  occupation?: string;              // Optional
  intendedStayMonths?: number;      // Optional
  applicationMessage?: string;      // Optional
  isUrgent?: boolean;               // Optional
}
```

**Response:**
```typescript
{
  id: string;
  status: 'accepted' | 'awaiting_confirmation'; // Tenant auto-approved
  // Platform room: 'accepted' (chờ landlord)
  // External room: 'awaiting_confirmation' (applicant có thể confirm)
  roommateSeekingPostId: string;
  applicantId: string;
  fullName: string;
  // ... other fields
}
```

**Errors:**
- `400`: Token không hợp lệ, đã có application, đã có rental khác
- `401`: Token hết hạn hoặc chưa xác thực
- `404`: Không tìm thấy rental

### Flow

```
1. Tenant tạo link → POST generate-invite-link
2. Chia sẻ link với người khác
3. Người nhận vào link → Điền form → POST accept-invite
4. Application được tạo với status:
   - Platform room: 'accepted' (tenant auto-approved, chờ landlord)
   - External room: 'awaiting_confirmation' (có thể confirm ngay)
5. Landlord approve (nếu platform room) → POST :id/landlord-approve
6. Applicant confirm → PATCH :id/confirm
7. Rental được tạo tự động
```

### Status Flow

**Platform Room:**
```
accept-invite → 'accepted' (tenant auto-approved)
     ↓
landlord-approve → 'awaiting_confirmation'
     ↓
applicant-confirm → 'accepted' + Rental created
```

**External Room:**
```
accept-invite → 'awaiting_confirmation' (tenant auto-approved)
     ↓
applicant-confirm → 'accepted' + Rental created
```

### Notifications

#### Sau khi accept invite:
- **Platform room**:
  - Landlord: `ROOMMATE_APPLICATION_RECEIVED` (cần approve)
  - Applicant: `ROOMMATE_APPLICATION_APPROVED` (tenant đã approve)
- **External room**:
  - Applicant: `ROOMMATE_APPLICATION_APPROVED` (có thể confirm)

#### Sau khi landlord approve:
- Applicant: `ROOMMATE_APPLICATION_APPROVED` (có thể confirm)

#### Sau khi applicant confirm:
- Applicant: `ROOMMATE_APPLICATION_CONFIRMED` + `RENTAL_CREATED`
- Tenant: `RENTAL_CREATED`
- Landlord: `RENTAL_CREATED` (nếu platform room)

---

## So sánh 2 Flow

| Tiêu chí | Add Directly | Invite by Link |
|----------|-------------|----------------|
| **Tốc độ** | ⚡ Ngay lập tức | 🐌 Chậm hơn (cần approval) |
| **Approval** | ❌ Không cần | ✅ Có approval (landlord) |
| **Status** | Tạo rental luôn | Application → Approval → Rental |
| **Use case** | Thêm người đã biết | Mời người chưa biết |

---

## Implementation Tips

### 1. Add Roommate Directly

```typescript
// Service
async function addRoommateDirectly(
  postId: string, 
  data: { email?: string; phone?: string; userId?: string }
) {
  return apiClient.post(`/roommate-applications/${postId}/add-roommate`, data);
}

// Usage
await addRoommateDirectly(postId, { email: 'user@example.com' });
// → Rental created immediately
```

**Key points:**
- Chỉ cần 1 trong 3: email, phone, hoặc userId
- Response empty, check status code
- User được thêm sẽ nhận 2 notifications

### 2. Invite by Link

```typescript
// 1. Generate link
async function generateInviteLink() {
  return apiClient.post('/roommate-applications/generate-invite-link');
}

// 2. Accept invite
async function acceptInvite(data: AcceptInviteDto) {
  return apiClient.post('/roommate-applications/accept-invite', data);
}

// Usage
const { inviteLink } = await generateInviteLink();
// Share inviteLink

// User nhận link điền form
const application = await acceptInvite({
  token: 'xxx',
  fullName: 'John Doe',
  phoneNumber: '+84901234567',
  moveInDate: '2024-01-01'
});
// → Application created với status 'accepted' hoặc 'awaiting_confirmation'
```

**Key points:**
- Link hết hạn sau 30 ngày
- Sau accept invite, application status phụ thuộc vào room type
- Platform room: Cần landlord approve
- External room: Applicant có thể confirm ngay

### 3. Handling Status After Accept Invite

```typescript
// Sau khi accept invite
if (application.status === 'accepted') {
  // Platform room: Chờ landlord approve
  // Show message: "Đang chờ landlord phê duyệt"
} else if (application.status === 'awaiting_confirmation') {
  // External room hoặc đã được landlord approve
  // Show button: "Xác nhận" → PATCH :id/confirm
}
```

---

## Error Handling

### Add Roommate Directly

```typescript
try {
  await addRoommateDirectly(postId, { email });
} catch (error) {
  if (error.status === 400) {
    // User đã có rental hoặc phòng hết chỗ
  } else if (error.status === 404) {
    // User không tồn tại
  }
}
```

### Accept Invite

```typescript
try {
  await acceptInvite(data);
} catch (error) {
  if (error.status === 401) {
    // Token hết hạn → Redirect to error page
  } else if (error.status === 400) {
    // Đã có application hoặc rental khác
  }
}
```

---

## Quick Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/roommate-applications/:postId/add-roommate` | Thêm roommate trực tiếp |
| POST | `/roommate-applications/generate-invite-link` | Tạo invite link |
| POST | `/roommate-applications/accept-invite` | Accept invite |
| POST | `/roommate-applications/:id/landlord-approve` | Landlord approve |
| PATCH | `/roommate-applications/:id/confirm` | Applicant confirm |

### Status Values

- `pending`: Đang chờ tenant approve
- `accepted`: Tenant đã approve (chờ landlord nếu platform room)
- `awaiting_confirmation`: Chờ applicant confirm
- `rejected`: Bị từ chối
- `cancelled`: Đã hủy
- `expired`: Hết hạn

---

## Common Patterns

### Pattern 1: Add Known Person
```typescript
// Dùng addRoommateDirectly
await addRoommateDirectly(postId, { email: 'friend@example.com' });
```

### Pattern 2: Invite Unknown Person
```typescript
// Dùng invite link
const link = await generateInviteLink();
// Share link → User accept → Flow approval
```

### Pattern 3: Check Application Status
```typescript
const app = await getApplication(applicationId);

if (app.status === 'accepted') {
  // Platform room: Chờ landlord
  // Show landlord approval UI
} else if (app.status === 'awaiting_confirmation') {
  // Có thể confirm
  // Show confirm button
}
```

