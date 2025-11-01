# Trustay App Actions Reference

## 📋 Table of Contents
- [Notification Actions](#notification-actions)
- [Authentication & User Management](#authentication--user-management)
- [Tenant Actions](#tenant-actions)
- [Landlord Actions](#landlord-actions)
- [Shared Actions](#shared-actions)
- [System Actions](#system-actions)

---

## 🔔 Notification Actions

### Create Notification
- **Endpoint**: `POST /notifications`
- **Description**: Tạo thông báo mới cho user
- **Payload**:
```json
{
  "userId": "uuid",
  "notificationType": "string",
  "title": "string",
  "message": "string",
  "data": "json_object",
  "expiresAt": "datetime"
}
```

### Get User Notifications
- **Endpoint**: `GET /notifications`
- **Description**: Lấy danh sách thông báo của user hiện tại
- **Query Params**:
  - `page`: number
  - `limit`: number
  - `isRead`: boolean
  - `notificationType`: string

### Mark Notification as Read
- **Endpoint**: `PATCH /notifications/:id/read`
- **Description**: Đánh dấu thông báo đã đọc

### Mark All Notifications as Read
- **Endpoint**: `PATCH /notifications/mark-all-read`
- **Description**: Đánh dấu tất cả thông báo đã đọc

### Delete Notification
- **Endpoint**: `DELETE /notifications/:id`
- **Description**: Xóa thông báo

### Get Notification Count
- **Endpoint**: `GET /notifications/count`
- **Description**: Lấy số lượng thông báo chưa đọc

---

## 🔐 Authentication & User Management

### Register
- **Endpoint**: `POST /auth/register`
- **Description**: Đăng ký tài khoản mới

### Login
- **Endpoint**: `POST /auth/login`
- **Description**: Đăng nhập

### Logout
- **Endpoint**: `POST /auth/logout`
- **Description**: Đăng xuất

### Refresh Token
- **Endpoint**: `POST /auth/refresh`
- **Description**: Làm mới access token

### Send Verification Code
- **Endpoint**: `POST /auth/send-verification-code`
- **Description**: Gửi mã xác thực qua email/phone

### Verify Code
- **Endpoint**: `POST /auth/verify-code`
- **Description**: Xác thực mã

### Reset Password
- **Endpoint**: `POST /auth/reset-password`
- **Description**: Đặt lại mật khẩu

### Get Profile
- **Endpoint**: `GET /users/profile`
- **Description**: Lấy thông tin profile user

### Update Profile
- **Endpoint**: `PATCH /users/profile`
- **Description**: Cập nhật thông tin profile

### Request Change Email
- **Endpoint**: `POST /users/request-change-email`
- **Description**: Yêu cầu đổi email - Bước 1: Gửi OTP đến email mới
- **Payload**:
```json
{
  "newEmail": "newemail@example.com",
  "password": "CurrentPassword123!"
}
```

### Confirm Change Email
- **Endpoint**: `POST /users/confirm-change-email`
- **Description**: Xác nhận đổi email - Bước 2: Xác thực OTP và cập nhật email
- **Payload**:
```json
{
  "newEmail": "newemail@example.com",
  "verificationCode": "123456"
}
```

### Upload Avatar
- **Endpoint**: `POST /users/avatar`
- **Description**: Upload ảnh đại diện

### Update Verification Status
- **Endpoint**: `PATCH /users/verification`
- **Description**: Cập nhật trạng thái xác thực (phone, email, identity, bank)

---

## 🏠 Tenant Actions

### Room Seeking Posts
#### Create Room Seeking Post
- **Endpoint**: `POST /room-seeking-posts`
- **Description**: Tạo bài đăng tìm trọ mới

#### Get My Room Seeking Posts
- **Endpoint**: `GET /room-seeking-posts/my-posts`
- **Description**: Lấy danh sách bài đăng của mình

#### Update Room Seeking Post
- **Endpoint**: `PATCH /room-seeking-posts/:id`
- **Description**: Cập nhật bài đăng tìm trọ

#### Delete Room Seeking Post
- **Endpoint**: `DELETE /room-seeking-posts/:id`
- **Description**: Xóa bài đăng tìm trọ

#### Change Post Status
- **Endpoint**: `PATCH /room-seeking-posts/:id/status`
- **Description**: Thay đổi trạng thái bài đăng (active/paused/closed)

### Room Search & Booking
#### Search Rooms
- **Endpoint**: `GET /rooms/search`
- **Description**: Tìm kiếm phòng theo tiêu chí

#### Get Room Details
- **Endpoint**: `GET /rooms/:slug`
- **Description**: Xem chi tiết phòng

#### Create Booking Request
- **Endpoint**: `POST /booking-requests`
- **Description**: Tạo yêu cầu booking phòng

#### Get My Booking Requests
- **Endpoint**: `GET /booking-requests/my-requests`
- **Description**: Lấy danh sách booking request của mình

#### Cancel Booking Request
- **Endpoint**: `PATCH /booking-requests/:id/cancel`
- **Description**: Hủy yêu cầu booking

### Invitations
#### Get My Invitations
- **Endpoint**: `GET /invitations/received`
- **Description**: Lấy danh sách lời mời đã nhận

#### Accept Invitation
- **Endpoint**: `PATCH /invitations/:id/accept`
- **Description**: Chấp nhận lời mời

#### Decline Invitation
- **Endpoint**: `PATCH /invitations/:id/decline`
- **Description**: Từ chối lời mời

### Rentals & Payments
#### Get My Rentals
- **Endpoint**: `GET /rentals/my-rentals`
- **Description**: Lấy danh sách hợp đồng thuê của mình

#### Get Rental Details
- **Endpoint**: `GET /rentals/:id`
- **Description**: Xem chi tiết hợp đồng thuê

#### Get Monthly Bills
- **Endpoint**: `GET /rentals/:id/bills`
- **Description**: Lấy hóa đơn hàng tháng

#### Make Payment
- **Endpoint**: `POST /payments`
- **Description**: Thực hiện thanh toán

#### Get Payment History
- **Endpoint**: `GET /payments/history`
- **Description**: Lấy lịch sử thanh toán

### Reviews
#### Create Review for Landlord
- **Endpoint**: `POST /reviews`
- **Description**: Đánh giá chủ nhà và property

#### Get My Reviews Given
- **Endpoint**: `GET /reviews/given`
- **Description**: Lấy danh sách review đã đưa ra

#### Get My Reviews Received
- **Endpoint**: `GET /reviews/received`
- **Description**: Lấy danh sách review đã nhận

---

## 🏢 Landlord Actions

### Building Management
#### Create Building
- **Endpoint**: `POST /buildings`
- **Description**: Tạo tòa nhà mới

#### Get My Buildings
- **Endpoint**: `GET /buildings/my-buildings`
- **Description**: Lấy danh sách tòa nhà của mình

#### Update Building
- **Endpoint**: `PATCH /buildings/:id`
- **Description**: Cập nhật thông tin tòa nhà

#### Delete Building
- **Endpoint**: `DELETE /buildings/:id`
- **Description**: Xóa tòa nhà

### Room Management
#### Create Room Type
- **Endpoint**: `POST /rooms`
- **Description**: Tạo loại phòng mới

#### Get My Rooms
- **Endpoint**: `GET /rooms/my-rooms`
- **Description**: Lấy danh sách phòng của mình

#### Update Room
- **Endpoint**: `PATCH /rooms/:id`
- **Description**: Cập nhật thông tin phòng

#### Delete Room
- **Endpoint**: `DELETE /rooms/:id`
- **Description**: Xóa loại phòng

#### Upload Room Images
- **Endpoint**: `POST /rooms/:id/images`
- **Description**: Upload hình ảnh phòng

#### Set Room Pricing
- **Endpoint**: `POST /rooms/:id/pricing`
- **Description**: Thiết lập giá phòng

#### Configure Room Amenities
- **Endpoint**: `POST /rooms/:id/amenities`
- **Description**: Cấu hình tiện nghi phòng

#### Set Room Rules
- **Endpoint**: `POST /rooms/:id/rules`
- **Description**: Thiết lập quy định phòng

#### Configure Room Costs
- **Endpoint**: `POST /rooms/:id/costs`
- **Description**: Cấu hình chi phí phòng

### Room Instance Management
#### Create Room Instance
- **Endpoint**: `POST /room-instances`
- **Description**: Tạo phòng cụ thể

#### Get Room Instances
- **Endpoint**: `GET /room-instances`
- **Description**: Lấy danh sách phòng cụ thể

#### Update Room Instance Status
- **Endpoint**: `PATCH /room-instances/:id/status`
- **Description**: Cập nhật trạng thái phòng

#### Delete Room Instance
- **Endpoint**: `DELETE /room-instances/:id`
- **Description**: Xóa phòng cụ thể

### Booking & Invitation Management
#### Get Booking Requests
- **Endpoint**: `GET /booking-requests/received`
- **Description**: Lấy yêu cầu booking đã nhận

#### Approve Booking Request
- **Endpoint**: `PATCH /booking-requests/:id/approve`
- **Description**: Chấp nhận yêu cầu booking

#### Reject Booking Request
- **Endpoint**: `PATCH /booking-requests/:id/reject`
- **Description**: Từ chối yêu cầu booking

#### Create Room Invitation
- **Endpoint**: `POST /invitations`
- **Description**: Tạo lời mời thuê phòng

#### Get My Sent Invitations
- **Endpoint**: `GET /invitations/sent`
- **Description**: Lấy danh sách lời mời đã gửi

### Rental Management
#### Get My Rentals as Owner
- **Endpoint**: `GET /rentals/as-owner`
- **Description**: Lấy danh sách hợp đồng thuê với vai trò chủ nhà

#### Create Rental Contract
- **Endpoint**: `POST /rentals`
- **Description**: Tạo hợp đồng thuê

#### Update Rental Status
- **Endpoint**: `PATCH /rentals/:id/status`
- **Description**: Cập nhật trạng thái hợp đồng

#### Terminate Rental
- **Endpoint**: `PATCH /rentals/:id/terminate`
- **Description**: Chấm dứt hợp đồng thuê

### Billing Management
#### Create Monthly Bill
- **Endpoint**: `POST /bills`
- **Description**: Tạo hóa đơn hàng tháng

#### Get Bills
- **Endpoint**: `GET /bills`
- **Description**: Lấy danh sách hóa đơn

#### Update Bill Status
- **Endpoint**: `PATCH /bills/:id/status`
- **Description**: Cập nhật trạng thái hóa đơn

#### Add Bill Items
- **Endpoint**: `POST /bills/:id/items`
- **Description**: Thêm mục vào hóa đơn

### Room Seeking Posts (View)
#### Get Room Seeking Posts
- **Endpoint**: `GET /room-seeking-posts`
- **Description**: Xem bài đăng tìm trọ của tenant

#### Contact Tenant
- **Endpoint**: `POST /room-seeking-posts/:id/contact`
- **Description**: Liên hệ với tenant

---

## 🤝 Shared Actions

### Location Services
#### Get Provinces
- **Endpoint**: `GET /locations/provinces`
- **Description**: Lấy danh sách tỉnh/thành

#### Get Districts
- **Endpoint**: `GET /locations/districts/:provinceId`
- **Description**: Lấy danh sách quận/huyện

#### Get Wards
- **Endpoint**: `GET /locations/wards/:districtId`
- **Description**: Lấy danh sách phường/xã

### Address Management
#### Create User Address
- **Endpoint**: `POST /addresses`
- **Description**: Tạo địa chỉ mới

#### Get User Addresses
- **Endpoint**: `GET /addresses`
- **Description**: Lấy danh sách địa chỉ

#### Update Address
- **Endpoint**: `PATCH /addresses/:id`
- **Description**: Cập nhật địa chỉ

#### Delete Address
- **Endpoint**: `DELETE /addresses/:id`
- **Description**: Xóa địa chỉ

#### Set Primary Address
- **Endpoint**: `PATCH /addresses/:id/set-primary`
- **Description**: Đặt địa chỉ chính

---

## ⚙️ System Actions

### System Data
#### Get System Amenities
- **Endpoint**: `GET /system/amenities`
- **Description**: Lấy danh sách tiện nghi hệ thống

#### Get System Room Rules
- **Endpoint**: `GET /system/room-rules`
- **Description**: Lấy danh sách quy định phòng hệ thống

#### Get System Cost Types
- **Endpoint**: `GET /system/cost-types`
- **Description**: Lấy danh sách loại chi phí hệ thống

### Error Logging
#### Log Error
- **Endpoint**: `POST /errors/log`
- **Description**: Ghi log lỗi

#### Get Error Logs (Admin only)
- **Endpoint**: `GET /errors`
- **Description**: Lấy danh sách log lỗi

---

## 📝 Notes

### Status Enums
- **BookingStatus**: pending, approved, rejected, cancelled
- **RentalStatus**: active, terminated, expired, pending_renewal
- **InvitationStatus**: pending, accepted, declined, expired
- **BillStatus**: draft, pending, paid, overdue, cancelled
- **PaymentStatus**: pending, completed, failed, refunded
- **SearchPostStatus**: active, paused, closed, expired
- **RoomStatus**: available, occupied, maintenance, reserved, unavailable

### Authentication
- Most endpoints require JWT authentication
- Role-based access control (tenant/landlord)
- Some endpoints are public (search, system data)

### Pagination
- Most list endpoints support pagination with `page` and `limit` params
- Default limit: 20 items per page

### File Uploads
- Support for images (avatar, room images, ID cards)
- File size limits and format validation
- Cloud storage integration