# 🏠 Truststay Database Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Table Groups](#table-groups)
  - [User Management](#user-management)
  - [Building & Room Management](#building--room-management)
  - [Simplified Amenities System](#simplified-amenities-system)
  - [Simplified Cost Types System](#simplified-cost-types-system)
  - [Pricing](#pricing)
  - [Invitation & Booking Management](#invitation--booking-management)
  - [Monthly Billing System](#monthly-billing-system)
  - [Reviews](#reviews)
  - [System Tables](#system-tables)
- [Enums](#enums)
- [Relationships](#relationships)
- [Use Cases](#use-cases)

## Overview

Truststay là một platform cho thuê phòng trọ tại Việt Nam với kiến trúc đơn giản và tập trung:

- **Building → Floor → Room Structure**: Cấu trúc phân cấp phù hợp với nhà trọ Việt Nam
- **Role-based System**: Phân biệt tenant/landlord/both với xác thực danh tính
- **Dual Rental Paths**: BookingRequest (tenant initiative) + RoomInvitation (landlord initiative)
- **Monthly Billing System**: Tổng kết hóa đơn hàng tháng với bill items chi tiết
- **Simplified Cost Management**: Bỏ phức tạp, tập trung cốt lõi
- **Review System**: Đánh giá 2 chiều giữa tenant và landlord

**Technology Stack:**

- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Primary Keys**: UUID for scalability
- **Optimization**: Removed complex features for MVP focus

---

## Database Schema

**Total Tables**: 16 (simplified from 30+)
**Total Enums**: 10 (reduced from 15+)
**Estimated Storage**: ~2GB (first year), ~10GB (after 3 years)

---

## Table Groups

### User Management

Quản lý thông tin người dùng với role và xác thực danh tính.

#### 📁 `users`

**Purpose**: Thông tin người dùng với phân biệt vai trò và xác thực

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key, auto-generated |
| `email` | String | ✅ | Email unique, dùng để login |
| `phone` | String | ❌ | Số điện thoại, unique nếu có |
| `passwordHash` | String | ✅ | Password đã hash |
| `firstName` | String | ✅ | Tên |
| `lastName` | String | ✅ | Họ |
| `avatarUrl` | String | ❌ | Link ảnh đại diện |
| `dateOfBirth` | Date | ❌ | Ngày sinh |
| `gender` | Enum | ❌ | `male`, `female`, `other` |
| `role` | Enum | ✅ | `tenant`, `landlord`, `both` |
| `bio` | String | ❌ | Giới thiệu bản thân |
| `idCardNumber` | String | ❌ | Số CMND/CCCD |
| `idCardImages` | String[] | ❌ | Ảnh CMND/CCCD |
| `bankAccount` | String | ❌ | Số tài khoản ngân hàng |
| `bankName` | String | ❌ | Tên ngân hàng |
| `emergencyContact` | String | ❌ | Liên hệ khẩn cấp |
| `isVerifiedPhone` | Boolean | ✅ | Xác thực SĐT |
| `isVerifiedEmail` | Boolean | ✅ | Xác thực email |
| `isVerifiedIdentity` | Boolean | ✅ | Xác thực danh tính |
| `isVerifiedBank` | Boolean | ✅ | Xác thực tài khoản ngân hàng |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

**Key Changes**: Merged UserProfile fields, added role & verification fields

#### 📁 `user_addresses`

**Purpose**: Địa chỉ của user (có thể có nhiều địa chỉ)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `userId` | UUID | ✅ | Foreign key → users.id |
| `addressLine1` | String | ✅ | Địa chỉ chính |
| `addressLine2` | String | ❌ | Địa chỉ phụ |
| `ward` | String | ❌ | Phường/Xã |
| `district` | String | ✅ | Quận/Huyện |
| `city` | String | ✅ | Thành phố/Tỉnh |
| `country` | String | ✅ | Quốc gia |
| `postalCode` | String | ❌ | Mã bưu điện |
| `isPrimary` | Boolean | ✅ | Địa chỉ chính |
| `createdAt` | DateTime | ✅ | Thời gian tạo |

---

### Building & Room Management

Cấu trúc phân cấp Building → Floor → Room phù hợp với nhà trọ Việt Nam.

#### 📁 `buildings`

**Purpose**: Nhà trọ/chung cư

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `ownerId` | UUID | ✅ | Foreign key → users.id |
| `name` | String | ✅ | Tên tòa nhà |
| `description` | String | ❌ | Mô tả |
| `addressLine1` | String | ✅ | Địa chỉ chính |
| `addressLine2` | String | ❌ | Địa chỉ phụ |
| `ward` | String | ❌ | Phường/Xã |
| `district` | String | ✅ | Quận/Huyện |
| `city` | String | ✅ | Thành phố/Tỉnh |
| `country` | String | ✅ | Quốc gia |
| `isActive` | Boolean | ✅ | Có hoạt động |
| `isVerified` | Boolean | ✅ | Đã xác thực |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

#### 📁 `floors`

**Purpose**: Tầng trong building

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `buildingId` | UUID | ✅ | Foreign key → buildings.id |
| `floorNumber` | Int | ✅ | Số tầng |
| `name` | String | ❌ | Tên tầng |
| `description` | String | ❌ | Mô tả |
| `isActive` | Boolean | ✅ | Có hoạt động |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

**Constraints**: Unique(buildingId, floorNumber)

#### 📁 `rooms`

**Purpose**: Phòng trong floor

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `floorId` | UUID | ✅ | Foreign key → floors.id |
| `roomNumber` | String | ✅ | Số phòng |
| `name` | String | ❌ | Tên phòng |
| `description` | String | ❌ | Mô tả |
| `roomType` | Enum | ✅ | `single`, `double`, `suite`, `dormitory` |
| `areaSqm` | Decimal | ❌ | Diện tích (m²) |
| `maxOccupancy` | Int | ✅ | Số người ở tối đa |
| `isActive` | Boolean | ✅ | Có hoạt động |
| `isVerified` | Boolean | ✅ | Đã xác thực |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

**Constraints**: Unique(floorId, roomNumber)

#### 📁 `room_images`

**Purpose**: Hình ảnh của room

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `imageUrl` | String | ✅ | Link hình ảnh |
| `altText` | String | ❌ | Alt text |
| `sortOrder` | Int | ✅ | Thứ tự hiển thị |
| `isPrimary` | Boolean | ✅ | Ảnh chính |
| `createdAt` | DateTime | ✅ | Thời gian upload |

#### 📁 `room_rules`

**Purpose**: Quy định của room

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `ruleType` | String | ✅ | Loại: smoking, pets, visitors, noise, other |
| `ruleText` | String | ✅ | Nội dung quy định |
| `createdAt` | DateTime | ✅ | Thời gian tạo |

---

### Simplified Amenities System

Hệ thống tiện ích đơn giản chỉ sử dụng system amenities.

#### 📁 `system_amenities`

**Purpose**: Tiện ích chuẩn do hệ thống tạo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `name` | String | ✅ | Tên tiếng Việt |
| `nameEn` | String | ✅ | Tên tiếng Anh (unique) |
| `category` | Enum | ✅ | `basic`, `kitchen`, `bathroom`, `entertainment`, `safety`, `connectivity`, `building` |
| `iconUrl` | String | ❌ | Link icon |
| `description` | String | ❌ | Mô tả |
| `isActive` | Boolean | ✅ | Có hiển thị |
| `sortOrder` | Int | ✅ | Thứ tự hiển thị |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

#### 📁 `room_amenities`

**Purpose**: Link room với system amenities

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `systemAmenityId` | UUID | ✅ | Foreign key → system_amenities.id |
| `customValue` | String | ❌ | Giá trị override |
| `notes` | String | ❌ | Ghi chú |
| `createdAt` | DateTime | ✅ | Thời gian thêm |

**Constraints**: Unique(roomId, systemAmenityId)

---

### Simplified Cost Types System

Hệ thống chi phí đơn giản.

#### 📁 `system_cost_types`

**Purpose**: Loại chi phí do hệ thống định nghĩa

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `name` | String | ✅ | Tên tiếng Việt |
| `nameEn` | String | ✅ | Tên tiếng Anh |
| `category` | Enum | ✅ | `utility`, `service`, `parking`, `maintenance` |
| `defaultUnit` | String | ❌ | Đơn vị mặc định |
| `iconUrl` | String | ❌ | Link icon |
| `description` | String | ❌ | Mô tả |
| `isActive` | Boolean | ✅ | Có active |
| `sortOrder` | Int | ✅ | Thứ tự hiển thị |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

#### 📁 `room_costs`

**Purpose**: Chi phí cụ thể của room

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `systemCostTypeId` | UUID | ✅ | Foreign key → system_cost_types.id |
| `baseRate` | Decimal | ✅ | Giá cơ bản |
| `currency` | String | ✅ | Đồng tiền |
| `notes` | String | ❌ | Ghi chú |
| `isActive` | Boolean | ✅ | Có active |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

**Constraints**: Unique(roomId, systemCostTypeId)

---

### Pricing

#### 📁 `room_pricing`

**Purpose**: Giá thuê của room

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id (unique) |
| `basePriceMonthly` | Decimal | ✅ | Giá thuê/tháng |
| `currency` | String | ✅ | Đồng tiền |
| `depositAmount` | Decimal | ✅ | Tiền cọc |
| `depositMonths` | Int | ✅ | Số tháng cọc |
| `utilityIncluded` | Boolean | ✅ | Bao gồm tiện ích |
| `utilityCostMonthly` | Decimal | ❌ | Chi phí tiện ích/tháng |
| `cleaningFee` | Decimal | ❌ | Phí vệ sinh |
| `serviceFeePercentage` | Decimal | ❌ | % phí dịch vụ platform |
| `minimumStayMonths` | Int | ✅ | Thời gian thuê tối thiểu |
| `maximumStayMonths` | Int | ❌ | Thời gian thuê tối đa |
| `priceNegotiable` | Boolean | ✅ | Có thể thương lượng |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

---

### Invitation & Booking Management

Hệ thống đặt phòng với 2 con đường: Invitation (landlord initiative) và BookingRequest (tenant initiative).

#### 📁 `room_invitations`

**Purpose**: Lời mời thuê từ chủ trọ

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `senderId` | UUID | ✅ | Foreign key → users.id (landlord) |
| `recipientId` | UUID | ❌ | Foreign key → users.id (tenant) |
| `recipientEmail` | String | ❌ | Email cho user chưa đăng ký |
| `monthlyRent` | Decimal | ✅ | Giá thuê đề xuất |
| `depositAmount` | Decimal | ✅ | Tiền cọc |
| `moveInDate` | Date | ❌ | Ngày vào ở dự kiến |
| `rentalMonths` | Int | ❌ | Số tháng thuê |
| `status` | Enum | ✅ | `pending`, `accepted`, `declined`, `expired` |
| `message` | String | ❌ | Lời nhắn |
| `expiresAt` | DateTime | ❌ | Thời hạn |
| `respondedAt` | DateTime | ❌ | Thời gian phản hồi |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

#### 📁 `booking_requests`

**Purpose**: Yêu cầu đặt phòng từ tenant

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `tenantId` | UUID | ✅ | Foreign key → users.id |
| `moveInDate` | Date | ✅ | Ngày vào ở |
| `moveOutDate` | Date | ❌ | Ngày dự kiến ra |
| `rentalMonths` | Int | ❌ | Số tháng thuê |
| `monthlyRent` | Decimal | ✅ | Giá thuê |
| `depositAmount` | Decimal | ✅ | Tiền cọc |
| `totalAmount` | Decimal | ✅ | Tổng tiền |
| `status` | Enum | ✅ | `pending`, `approved`, `rejected`, `cancelled` |
| `messageToOwner` | String | ❌ | Tin nhắn gửi chủ nhà |
| `ownerNotes` | String | ❌ | Ghi chú chủ nhà |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

#### 📁 `rentals`

**Purpose**: Hợp đồng thuê chính thức

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `bookingRequestId` | UUID | ❌ | Foreign key → booking_requests.id |
| `invitationId` | UUID | ❌ | Foreign key → room_invitations.id |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `tenantId` | UUID | ✅ | Foreign key → users.id |
| `ownerId` | UUID | ✅ | Foreign key → users.id |
| `contractStartDate` | Date | ✅ | Ngày bắt đầu hợp đồng |
| `contractEndDate` | Date | ❌ | Ngày kết thúc hợp đồng |
| `monthlyRent` | Decimal | ✅ | Tiền thuê/tháng |
| `depositPaid` | Decimal | ✅ | Tiền cọc đã trả |
| `status` | Enum | ✅ | `active`, `terminated`, `expired`, `pending_renewal` |
| `contractDocumentUrl` | String | ❌ | Link file hợp đồng |
| `terminationNoticeDate` | Date | ❌ | Ngày báo chấm dứt |
| `terminationReason` | String | ❌ | Lý do chấm dứt |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

---

### Monthly Billing System

Hệ thống tổng kết hóa đơn hàng tháng với bill items chi tiết.

#### 📁 `monthly_bills`

**Purpose**: Hóa đơn tính tiền hàng tháng

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `rentalId` | UUID | ✅ | Foreign key → rentals.id |
| `roomId` | UUID | ✅ | Foreign key → rooms.id |
| `billingPeriod` | String | ✅ | "2025-01" format |
| `billingMonth` | Int | ✅ | 1-12 |
| `billingYear` | Int | ✅ | Năm |
| `periodStart` | Date | ✅ | Ngày bắt đầu kỳ |
| `periodEnd` | Date | ✅ | Ngày kết thúc kỳ |
| `subtotal` | Decimal | ✅ | Tổng phụ |
| `discountAmount` | Decimal | ✅ | Số tiền giảm |
| `taxAmount` | Decimal | ✅ | Thuế |
| `totalAmount` | Decimal | ✅ | Tổng cộng |
| `paidAmount` | Decimal | ✅ | Đã thanh toán |
| `remainingAmount` | Decimal | ✅ | Còn nợ |
| `status` | Enum | ✅ | `draft`, `pending`, `paid`, `overdue`, `cancelled` |
| `dueDate` | Date | ✅ | Ngày hết hạn |
| `paidDate` | Date | ❌ | Ngày thanh toán |
| `notes` | String | ❌ | Ghi chú |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

**Constraints**: Unique(rentalId, billingPeriod)

#### 📁 `bill_items`

**Purpose**: Chi tiết từng khoản trong hóa đơn

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `monthlyBillId` | UUID | ✅ | Foreign key → monthly_bills.id |
| `itemType` | String | ✅ | "rent", "utility", "service", "other" |
| `itemName` | String | ✅ | Tên khoản thu |
| `description` | String | ❌ | Mô tả chi tiết |
| `quantity` | Decimal | ❌ | Số lượng |
| `unitPrice` | Decimal | ❌ | Đơn giá |
| `amount` | Decimal | ✅ | Thành tiền |
| `currency` | String | ✅ | Đồng tiền |
| `notes` | String | ❌ | Ghi chú |
| `createdAt` | DateTime | ✅ | Thời gian tạo |

#### 📁 `payments`

**Purpose**: Thanh toán (updated)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `rentalId` | UUID | ✅ | Foreign key → rentals.id |
| `monthlyBillId` | UUID | ❌ | Foreign key → monthly_bills.id |
| `payerId` | UUID | ✅ | Foreign key → users.id |
| `paymentType` | Enum | ✅ | `rent`, `deposit`, `utility`, `fee`, `refund` |
| `amount` | Decimal | ✅ | Số tiền |
| `currency` | String | ✅ | Đồng tiền |
| `paymentMethod` | Enum | ❌ | `bank_transfer`, `cash`, `e_wallet`, `card` |
| `paymentStatus` | Enum | ✅ | `pending`, `completed`, `failed`, `refunded` |
| `paymentDate` | DateTime | ❌ | Ngày thanh toán |
| `dueDate` | Date | ❌ | Ngày hết hạn |
| `description` | String | ❌ | Mô tả |
| `transactionReference` | String | ❌ | Mã giao dịch |
| `createdAt` | DateTime | ✅ | Thời gian tạo |
| `updatedAt` | DateTime | ✅ | Lần update cuối |

**Key Changes**: Added `monthlyBillId` to link payments with bills

---

### Reviews

#### 📁 `reviews`

**Purpose**: Đánh giá 2 chiều

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `rentalId` | UUID | ✅ | Foreign key → rentals.id |
| `reviewerId` | UUID | ✅ | Foreign key → users.id |
| `revieweeId` | UUID | ✅ | Foreign key → users.id |
| `reviewerType` | Enum | ✅ | `tenant`, `owner` |
| `propertyRating` | Int | ❌ | Điểm property (1-5) |
| `communicationRating` | Int | ❌ | Điểm giao tiếp (1-5) |
| `cleanlinessRating` | Int | ❌ | Điểm vệ sinh (1-5) |
| `overallRating` | Int | ❌ | Điểm tổng thể (1-5) |
| `reviewText` | String | ❌ | Nội dung review |
| `isPublic` | Boolean | ✅ | Hiển thị công khai |
| `responseText` | String | ❌ | Phản hồi |
| `responseDate` | DateTime | ❌ | Ngày phản hồi |
| `createdAt` | DateTime | ✅ | Thời gian tạo |

---

### System Tables

#### 📁 `notifications`

**Purpose**: Thông báo cho users

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | ✅ | Primary key |
| `userId` | UUID | ✅ | Foreign key → users.id |
| `notificationType` | String | ✅ | Loại thông báo |
| `title` | String | ✅ | Tiêu đề |
| `message` | String | ✅ | Nội dung |
| `data` | Json | ❌ | Data bổ sung |
| `isRead` | Boolean | ✅ | Đã đọc |
| `readAt` | DateTime | ❌ | Thời gian đọc |
| `expiresAt` | DateTime | ❌ | Thời gian hết hạn |
| `createdAt` | DateTime | ✅ | Thời gian tạo |

---

## Enums

### UserRole
- `tenant` - Người thuê
- `landlord` - Chủ trọ
- `both` - Cả hai vai trò

### Gender
- `male`
- `female`
- `other`

### RoomType
- `single`
- `double`
- `suite`
- `dormitory`

### InvitationStatus
- `pending`
- `accepted`
- `declined`
- `expired`

### BillStatus
- `draft` - Bản nháp
- `pending` - Chờ thanh toán
- `paid` - Đã thanh toán
- `overdue` - Quá hạn
- `cancelled` - Đã hủy

### BookingStatus
- `pending`
- `approved`
- `rejected`
- `cancelled`

### RentalStatus
- `active`
- `terminated`
- `expired`
- `pending_renewal`

### PaymentType
- `rent`
- `deposit`
- `utility`
- `fee`
- `refund`

### PaymentMethod
- `bank_transfer`
- `cash`
- `e_wallet`
- `card`

### PaymentStatus
- `pending`
- `completed`
- `failed`
- `refunded`

### ReviewerType
- `tenant`
- `owner`

### AmenityCategory
- `basic`
- `kitchen`
- `bathroom`
- `entertainment`
- `safety`
- `connectivity`
- `building`

### CostCategory
- `utility`
- `service`
- `parking`
- `maintenance`

### Visibility
- `anyoneCanFind`
- `anyoneWithLink`
- `domainCanFind`
- `domainWithLink`
- `limited`

---

## Relationships

### Core Business Flow

```
User (Landlord) → Building → Floor → Room → Room_Amenities → System_Amenities
                                    ↓
                            Room_Costs → System_Cost_Types
                                    ↓
                  RoomInvitation/BookingRequest → Rental → MonthlyBill → BillItems
                                                          ↓              ↓
                                                     Payments & Reviews
```

### Key Relationships

#### User Relationships
- **1→N**: User có nhiều Buildings (as owner)
- **1→N**: User có nhiều RoomInvitations (sent/received)
- **1→N**: User có nhiều BookingRequests (as tenant)
- **1→N**: User có nhiều Rentals (as tenant hoặc owner)
- **1→N**: User có nhiều UserAddresses

#### Building Hierarchy
- **1→N**: Building có nhiều Floors
- **1→N**: Floor có nhiều Rooms
- **1→N**: Room có nhiều RoomImages, RoomAmenities, RoomCosts
- **1→1**: Room có 1 RoomPricing

#### Rental Flow
- **1→1**: RoomInvitation hoặc BookingRequest → Rental
- **1→N**: Rental có nhiều MonthlyBills
- **1→N**: MonthlyBill có nhiều BillItems
- **1→N**: MonthlyBill có nhiều Payments
- **1→N**: Rental có nhiều Reviews (2 chiều)

---

## Use Cases

### Typical User Flows

#### 1. Landlord setup
1. Tạo Building với thông tin địa chỉ
2. Tạo Floors với floor numbers
3. Tạo Rooms với room numbers và details
4. Upload RoomImages
5. Add RoomAmenities và RoomCosts
6. Set RoomPricing

#### 2. Landlord invite tenant
1. Tạo RoomInvitation với terms
2. Gửi qua email hoặc trong app
3. Tenant nhận và accept/decline
4. Nếu accepted → tạo Rental

#### 3. Tenant booking flow
1. Search rooms với filters
2. Xem chi tiết room, amenities, costs
3. Gửi BookingRequest
4. Landlord approve → tạo Rental
5. Tenant thanh toán deposit

#### 4. Monthly billing cycle
1. Cuối tháng: Tạo MonthlyBill (status: draft)
2. Thêm BillItems: tiền phòng, điện, nước, dịch vụ
3. Tính tổng và gửi bill (status: pending)
4. Tenant thanh toán → tạo Payment
5. Update bill status → paid

#### 5. Active rental
1. Monthly billing cycle
2. Communication về issues
3. End rental → Reviews

### Common Queries

#### Room Search with Building Info
```sql
SELECT 
  r.*, 
  f.floorNumber,
  b.name as buildingName,
  b.district,
  b.city,
  rp.basePriceMonthly
FROM rooms r
JOIN floors f ON r.floorId = f.id
JOIN buildings b ON f.buildingId = b.id
JOIN room_pricing rp ON r.id = rp.roomId
WHERE b.city = 'Ho Chi Minh City'
  AND rp.basePriceMonthly BETWEEN 5000000 AND 15000000
  AND r.isActive = true
```

#### User Rental History
```sql
SELECT 
  r.*,
  room.roomNumber,
  floor.floorNumber,
  building.name as buildingName,
  owner.firstName || ' ' || owner.lastName as ownerName
FROM rentals r
JOIN rooms room ON r.roomId = room.id
JOIN floors floor ON room.floorId = floor.id
JOIN buildings building ON floor.buildingId = building.id
JOIN users owner ON r.ownerId = owner.id
WHERE r.tenantId = 'user-uuid'
ORDER BY r.contractStartDate DESC
```

#### Monthly Bill with Items
```sql
SELECT 
  mb.billingPeriod,
  mb.totalAmount,
  mb.paidAmount,
  mb.status,
  bi.itemType,
  bi.itemName,
  bi.amount as itemAmount
FROM monthly_bills mb
JOIN bill_items bi ON mb.id = bi.monthlyBillId
WHERE mb.rentalId = 'rental-uuid'
  AND mb.billingPeriod = '2025-01'
ORDER BY bi.itemType, bi.createdAt
```

#### Payment History by Bill
```sql
SELECT 
  p.paymentDate,
  p.amount,
  p.paymentMethod,
  p.paymentStatus,
  mb.billingPeriod,
  mb.totalAmount as billTotal
FROM payments p
LEFT JOIN monthly_bills mb ON p.monthlyBillId = mb.id
WHERE p.rentalId = 'rental-uuid'
ORDER BY p.paymentDate DESC
```

---

**Database Version**: 2.1 (With Monthly Billing)
**Last Updated**: January 2025
**Key Changes**: 
- Simplified from 30+ to 16 tables
- Building → Floor → Room hierarchy
- Merged UserProfile into User
- Added UserRole and identity verification
- Dual rental paths (Invitation + BookingRequest)
- **NEW**: Monthly billing system with detailed bill items
- Enhanced payment tracking with bill linkage
- Removed complex cost calculations and custom amenities