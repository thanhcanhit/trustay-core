# 🏠 Truststay Database Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Table Groups](#table-groups)
  - [User Management](#user-management)
  - [Property Management](#property-management)
  - [Flexible Amenities System](#flexible-amenities-system)
  - [Flexible Cost Types System](#flexible-cost-types-system)
  - [Pricing & Availability](#pricing--availability)
  - [Booking & Rental Management](#booking--rental-management)
  - [Communication & Reviews](#communication--reviews)
  - [Support & Reporting](#support--reporting)
  - [System Tables](#system-tables)
- [Enums](#enums)
- [Relationships](#relationships)
- [Use Cases](#use-cases)

## Overview

Truststay là một platform cho thuê phòng trọ/căn hộ tại Việt Nam với các tính năng đặc biệt:

- **Flexible Amenities**: Hệ thống tiện ích linh hoạt cho phép user tự tạo tiện ích riêng
- **Vietnam Cost Management**: Quản lý chi phí phức tạp (điện bậc thang, nước, dịch vụ...)
- **Community-driven**: User có thể chia sẻ amenities/cost types với cộng đồng
- **Comprehensive Rental Management**: Từ booking đến thanh toán và reviews

**Technology Stack:**

- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Primary Keys**: UUID for scalability
- **JSON Fields**: JSONB for flexible data storage

---

## Database Schema

**Total Tables**: 30
**Total Enums**: 15
**Estimated Storage**: ~10GB (first year), ~50GB (after 3 years)

---

## Table Groups

### User Management

Quản lý thông tin người dùng, profile và địa chỉ.

#### 📁 `users`

**Purpose**: Lưu thông tin cơ bản của người dùng (cả owner và tenant)

| Field          | Type     | Required | Description                             |
| -------------- | -------- | -------- | --------------------------------------- |
| `id`           | UUID     | ✅       | Primary key, auto-generated             |
| `email`        | String   | ✅       | Email unique, dùng để login             |
| `phone`        | String   | ❌       | Số điện thoại, unique nếu có            |
| `passwordHash` | String   | ✅       | Password đã hash (bcrypt/argon2)        |
| `firstName`    | String   | ✅       | Tên                                     |
| `lastName`     | String   | ✅       | Họ                                      |
| `avatarUrl`    | String   | ❌       | Link ảnh đại diện                       |
| `dateOfBirth`  | Date     | ❌       | Ngày sinh                               |
| `gender`       | Enum     | ❌       | `male`, `female`, `other`               |
| `isVerified`   | Boolean  | ✅       | Account đã verify chưa (default: false) |
| `isActive`     | Boolean  | ✅       | Account có active không (default: true) |
| `createdAt`    | DateTime | ✅       | Thời gian tạo account                   |
| `updatedAt`    | DateTime | ✅       | Lần update cuối                         |

**Indexes**: email, phone, createdAt
**Relations**: 1→N với properties (as owner), rentals (as tenant/owner), bookings, payments

#### 📁 `user_profiles`

**Purpose**: Thông tin chi tiết mở rộng của user

| Field                   | Type     | Required | Description                          |
| ----------------------- | -------- | -------- | ------------------------------------ |
| `id`                    | UUID     | ✅       | Primary key                          |
| `userId`                | UUID     | ✅       | Foreign key → users.id               |
| `bio`                   | Text     | ❌       | Giới thiệu bản thân                  |
| `occupation`            | String   | ❌       | Nghề nghiệp                          |
| `languages`             | String[] | ❌       | Array ngôn ngữ biết                  |
| `emergencyContactName`  | String   | ❌       | Tên người liên hệ khẩn cấp           |
| `emergencyContactPhone` | String   | ❌       | SĐT người liên hệ khẩn cấp           |
| `verificationDocuments` | JSONB    | ❌       | Documents verify (CMND, passport...) |
| `createdAt`             | DateTime | ✅       | Thời gian tạo                        |
| `updatedAt`             | DateTime | ✅       | Lần update cuối                      |

**Relations**: 1→1 với users

#### 📁 `user_addresses`

**Purpose**: Địa chỉ của user (có thể có nhiều địa chỉ)

| Field          | Type     | Required | Description                   |
| -------------- | -------- | -------- | ----------------------------- |
| `id`           | UUID     | ✅       | Primary key                   |
| `userId`       | UUID     | ✅       | Foreign key → users.id        |
| `addressLine1` | String   | ✅       | Địa chỉ chính (số nhà, đường) |
| `addressLine2` | String   | ❌       | Địa chỉ phụ (tòa nhà, căn hộ) |
| `ward`         | String   | ❌       | Phường/Xã                     |
| `district`     | String   | ✅       | Quận/Huyện                    |
| `city`         | String   | ✅       | Thành phố/Tỉnh                |
| `country`      | String   | ✅       | Quốc gia (default: "Vietnam") |
| `postalCode`   | String   | ❌       | Mã bưu điện                   |
| `isPrimary`    | Boolean  | ✅       | Địa chỉ chính hay không       |
| `createdAt`    | DateTime | ✅       | Thời gian tạo                 |

**Relations**: N→1 với users

---

### Property Management

Quản lý thông tin property, hình ảnh, quy định.

#### 📁 `properties`

**Purpose**: Thông tin cơ bản về property (phòng/căn hộ cho thuê)

| Field          | Type          | Required | Description                               |
| -------------- | ------------- | -------- | ----------------------------------------- |
| `id`           | UUID          | ✅       | Primary key                               |
| `ownerId`      | UUID          | ✅       | Foreign key → users.id (chủ nhà)          |
| `title`        | String        | ✅       | Tiêu đề property                          |
| `description`  | Text          | ❌       | Mô tả chi tiết                            |
| `propertyType` | Enum          | ✅       | `room`, `apartment`, `house`, `dormitory` |
| `addressLine1` | String        | ✅       | Địa chỉ chính                             |
| `addressLine2` | String        | ❌       | Địa chỉ phụ                               |
| `ward`         | String        | ❌       | Phường/Xã                                 |
| `district`     | String        | ✅       | Quận/Huyện                                |
| `city`         | String        | ✅       | Thành phố/Tỉnh                            |
| `country`      | String        | ✅       | Quốc gia (default: "Vietnam")             |
| `latitude`     | Decimal(10,8) | ❌       | Vĩ độ (GPS)                               |
| `longitude`    | Decimal(11,8) | ❌       | Kinh độ (GPS)                             |
| `areaSqm`      | Decimal(8,2)  | ❌       | Diện tích (m²)                            |
| `maxOccupancy` | Integer       | ✅       | Số người ở tối đa (default: 1)            |
| `isActive`     | Boolean       | ✅       | Property có active không                  |
| `isVerified`   | Boolean       | ✅       | Đã verify bởi admin chưa                  |
| `createdAt`    | DateTime      | ✅       | Thời gian tạo                             |
| `updatedAt`    | DateTime      | ✅       | Lần update cuối                           |

**Indexes**: ownerId, (district,city), propertyType, isActive, (latitude,longitude)
**Relations**: N→1 với users, 1→N với images/rules/amenities/costs

#### 📁 `property_images`

**Purpose**: Hình ảnh của property

| Field        | Type     | Required | Description                    |
| ------------ | -------- | -------- | ------------------------------ |
| `id`         | UUID     | ✅       | Primary key                    |
| `propertyId` | UUID     | ✅       | Foreign key → properties.id    |
| `imageUrl`   | String   | ✅       | Link hình ảnh                  |
| `altText`    | String   | ❌       | Alt text cho SEO/accessibility |
| `sortOrder`  | Integer  | ✅       | Thứ tự hiển thị (default: 0)   |
| `isPrimary`  | Boolean  | ✅       | Ảnh chính hay không            |
| `createdAt`  | DateTime | ✅       | Thời gian upload               |

**Relations**: N→1 với properties

#### 📁 `property_rules`

**Purpose**: Quy định của property

| Field         | Type     | Required | Description                                          |
| ------------- | -------- | -------- | ---------------------------------------------------- |
| `id`          | UUID     | ✅       | Primary key                                          |
| `propertyId`  | UUID     | ✅       | Foreign key → properties.id                          |
| `ruleType`    | String   | ✅       | Loại quy định: smoking, pets, visitors, noise, other |
| `ruleText`    | Text     | ✅       | Nội dung quy định                                    |
| `isMandatory` | Boolean  | ✅       | Bắt buộc hay optional                                |
| `createdAt`   | DateTime | ✅       | Thời gian tạo                                        |

**Relations**: N→1 với properties

---

### Flexible Amenities System

Hệ thống tiện ích linh hoạt cho phép system và user tạo amenities.

#### 📁 `system_amenities`

**Purpose**: Tiện ích chuẩn do hệ thống tạo sẵn

| Field         | Type     | Required | Description                                                                           |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------- |
| `id`          | UUID     | ✅       | Primary key                                                                           |
| `name`        | String   | ✅       | Tên tiếng Việt                                                                        |
| `nameEn`      | String   | ✅       | Tên tiếng Anh (unique, chuẩn hóa)                                                     |
| `category`    | Enum     | ✅       | `basic`, `kitchen`, `bathroom`, `entertainment`, `safety`, `connectivity`, `building` |
| `iconUrl`     | String   | ❌       | Link icon                                                                             |
| `description` | Text     | ❌       | Mô tả chi tiết                                                                        |
| `isActive`    | Boolean  | ✅       | Có hiển thị không                                                                     |
| `sortOrder`   | Integer  | ✅       | Thứ tự hiển thị                                                                       |
| `createdAt`   | DateTime | ✅       | Thời gian tạo                                                                         |
| `updatedAt`   | DateTime | ✅       | Lần update cuối                                                                       |

**Examples**: WiFi, Điều hòa, Thang máy, Hồ bơi
**Indexes**: category, isActive
**Relations**: 1→N với property_amenities

#### 📁 `user_custom_amenities`

**Purpose**: Tiện ích tùy chỉnh do user tạo

| Field         | Type     | Required | Description                        |
| ------------- | -------- | -------- | ---------------------------------- |
| `id`          | UUID     | ✅       | Primary key                        |
| `creatorId`   | UUID     | ✅       | Foreign key → users.id (người tạo) |
| `name`        | String   | ✅       | Tên tiện ích                       |
| `category`    | String   | ❌       | Category (có thể custom)           |
| `iconUrl`     | String   | ❌       | Link icon                          |
| `description` | Text     | ❌       | Mô tả                              |
| `isPublic`    | Boolean  | ✅       | Cho phép user khác dùng không      |
| `usageCount`  | Integer  | ✅       | Số lần được sử dụng                |
| `createdAt`   | DateTime | ✅       | Thời gian tạo                      |
| `updatedAt`   | DateTime | ✅       | Lần update cuối                    |

**Examples**: "Gaming Setup RTX 4090", "Máy pha cà phê Nespresso"
**Constraints**: Unique(creatorId, name, category)
**Indexes**: creatorId, isPublic, category
**Relations**: N→1 với users, 1→N với property_amenities

#### 📁 `property_amenities`

**Purpose**: Link property với amenities (system hoặc custom)

| Field                 | Type     | Required | Description                                          |
| --------------------- | -------- | -------- | ---------------------------------------------------- |
| `id`                  | UUID     | ✅       | Primary key                                          |
| `propertyId`          | UUID     | ✅       | Foreign key → properties.id                          |
| `systemAmenityId`     | UUID     | ❌       | Foreign key → system_amenities.id                    |
| `userCustomAmenityId` | UUID     | ❌       | Foreign key → user_custom_amenities.id               |
| `customValue`         | String   | ❌       | Giá trị override ("2 phòng ngủ" thay vì "Phòng ngủ") |
| `notes`               | Text     | ❌       | Ghi chú thêm                                         |
| `createdAt`           | DateTime | ✅       | Thời gian thêm                                       |

**Constraints**:

- Unique(propertyId, systemAmenityId)
- Unique(propertyId, userCustomAmenityId)
- Chỉ một trong hai: systemAmenityId HOẶC userCustomAmenityId

#### 📁 `user_amenity_adoptions`

**Purpose**: Track việc user "adopt" custom amenities của user khác

| Field             | Type     | Required | Description                            |
| ----------------- | -------- | -------- | -------------------------------------- |
| `id`              | UUID     | ✅       | Primary key                            |
| `userId`          | UUID     | ✅       | Foreign key → users.id                 |
| `customAmenityId` | UUID     | ✅       | Foreign key → user_custom_amenities.id |
| `adoptedAt`       | DateTime | ✅       | Thời gian adopt                        |

**Constraints**: Unique(userId, customAmenityId)

---

### Flexible Cost Types System

Hệ thống quản lý chi phí linh hoạt cho thị trường Việt Nam.

#### 📁 `system_cost_types`

**Purpose**: Loại chi phí chuẩn do hệ thống định nghĩa

| Field               | Type     | Required | Description                                      |
| ------------------- | -------- | -------- | ------------------------------------------------ |
| `id`                | UUID     | ✅       | Primary key                                      |
| `name`              | String   | ✅       | Tên tiếng Việt                                   |
| `nameEn`            | String   | ✅       | Tên tiếng Anh (unique)                           |
| `category`          | Enum     | ✅       | `utility`, `service`, `parking`, `maintenance`   |
| `calculationMethod` | Enum     | ✅       | `fixed`, `per_unit`, `per_person`, `per_vehicle` |
| `defaultUnit`       | String   | ❌       | Đơn vị: kWh, m3, person, vehicle, month          |
| `iconUrl`           | String   | ❌       | Link icon                                        |
| `description`       | Text     | ❌       | Mô tả                                            |
| `isActive`          | Boolean  | ✅       | Có active không                                  |
| `sortOrder`         | Integer  | ✅       | Thứ tự hiển thị                                  |
| `createdAt`         | DateTime | ✅       | Thời gian tạo                                    |
| `updatedAt`         | DateTime | ✅       | Lần update cuối                                  |

**Examples**:

- Tiền điện (per_unit, kWh)
- Tiền nước (per_unit, m3)
- Tiền rác (fixed, month)
- Gửi xe máy (per_vehicle, vehicle)

#### 📁 `user_custom_cost_types`

**Purpose**: Loại chi phí tùy chỉnh do user tạo

| Field               | Type     | Required | Description              |
| ------------------- | -------- | -------- | ------------------------ |
| `id`                | UUID     | ✅       | Primary key              |
| `creatorId`         | UUID     | ✅       | Foreign key → users.id   |
| `name`              | String   | ✅       | Tên chi phí              |
| `category`          | String   | ❌       | Category (có thể custom) |
| `calculationMethod` | Enum     | ✅       | Cách tính                |
| `unit`              | String   | ❌       | Đơn vị                   |
| `description`       | Text     | ❌       | Mô tả                    |
| `isPublic`          | Boolean  | ✅       | Chia sẻ với community    |
| `usageCount`        | Integer  | ✅       | Số lần được dùng         |
| `createdAt`         | DateTime | ✅       | Thời gian tạo            |
| `updatedAt`         | DateTime | ✅       | Lần update cuối          |

**Examples**: "Phí bảo vệ riêng", "Tiền cáp truyền hình"

#### 📁 `property_costs`

**Purpose**: Cấu trúc chi phí cụ thể của từng property

| Field                  | Type          | Required | Description                             |
| ---------------------- | ------------- | -------- | --------------------------------------- |
| `id`                   | UUID          | ✅       | Primary key                             |
| `propertyId`           | UUID          | ✅       | Foreign key → properties.id             |
| `systemCostTypeId`     | UUID          | ❌       | Foreign key → system_cost_types.id      |
| `userCustomCostTypeId` | UUID          | ❌       | Foreign key → user_custom_cost_types.id |
| `baseRate`             | Decimal(15,2) | ✅       | Giá cơ bản                              |
| `currency`             | String        | ✅       | Đồng tiền (default: "VND")              |
| `pricingTiers`         | JSONB         | ❌       | Bậc thang giá (điện VN)                 |
| `includedAmount`       | Decimal(10,2) | ✅       | Lượng miễn phí                          |
| `minimumCharge`        | Decimal(15,2) | ❌       | Phí tối thiểu                           |
| `maximumCharge`        | Decimal(15,2) | ❌       | Phí tối đa                              |
| `billingCycle`         | Enum          | ✅       | `monthly`, `quarterly`, `usage_based`   |
| `paymentDeadlineDays`  | Integer       | ✅       | Deadline thanh toán (ngày)              |
| `lateFeeRate`          | Decimal(5,2)  | ❌       | % phí trễ hạn                           |
| `notes`                | Text          | ❌       | Ghi chú                                 |
| `isActive`             | Boolean       | ✅       | Có active không                         |
| `createdAt`            | DateTime      | ✅       | Thời gian tạo                           |
| `updatedAt`            | DateTime      | ✅       | Lần update cuối                         |

**pricingTiers Example** (Điện bậc thang VN):

```json
[
	{ "from": 0, "to": 50, "rate": 1678 },
	{ "from": 51, "to": 100, "rate": 1734 },
	{ "from": 101, "to": 200, "rate": 2014 }
]
```

#### 📁 `utility_readings`

**Purpose**: Chỉ số hàng tháng (điện, nước, gas...)

| Field              | Type          | Required | Description                           |
| ------------------ | ------------- | -------- | ------------------------------------- |
| `id`               | UUID          | ✅       | Primary key                           |
| `rentalId`         | UUID          | ✅       | Foreign key → rentals.id              |
| `propertyCostId`   | UUID          | ✅       | Foreign key → property_costs.id       |
| `readingDate`      | Date          | ✅       | Ngày ghi chỉ số                       |
| `previousReading`  | Decimal(10,2) | ❌       | Chỉ số cũ                             |
| `currentReading`   | Decimal(10,2) | ❌       | Chỉ số mới                            |
| `consumption`      | Decimal(10,2) | ❌       | Lượng tiêu thụ (current - previous)   |
| `meterPhotos`      | String[]      | ❌       | Array ảnh đồng hồ                     |
| `notes`            | Text          | ❌       | Ghi chú                               |
| `recordedById`     | UUID          | ❌       | Foreign key → users.id (người ghi)    |
| `verifiedById`     | UUID          | ❌       | Foreign key → users.id (người verify) |
| `verificationDate` | DateTime      | ❌       | Thời gian verify                      |
| `createdAt`        | DateTime      | ✅       | Thời gian tạo                         |

**Constraints**: currentReading >= previousReading

#### 📁 `cost_calculations`

**Purpose**: Tính toán chi phí cụ thể và billing

| Field                | Type          | Required | Description                            |
| -------------------- | ------------- | -------- | -------------------------------------- |
| `id`                 | UUID          | ✅       | Primary key                            |
| `rentalId`           | UUID          | ✅       | Foreign key → rentals.id               |
| `propertyCostId`     | UUID          | ✅       | Foreign key → property_costs.id        |
| `utilityReadingId`   | UUID          | ❌       | Foreign key → utility_readings.id      |
| `billingPeriodStart` | Date          | ✅       | Ngày bắt đầu kỳ bill                   |
| `billingPeriodEnd`   | Date          | ✅       | Ngày kết thúc kỳ bill                  |
| `baseAmount`         | Decimal(10,2) | ❌       | Lượng cơ bản                           |
| `billableAmount`     | Decimal(10,2) | ❌       | Lượng tính tiền                        |
| `tierCalculations`   | JSONB         | ❌       | Chi tiết tính theo bậc                 |
| `subtotal`           | Decimal(15,2) | ✅       | Tổng phụ                               |
| `discountAmount`     | Decimal(15,2) | ✅       | Số tiền giảm                           |
| `totalAmount`        | Decimal(15,2) | ✅       | Tổng cuối                              |
| `paymentStatus`      | Enum          | ✅       | `pending`, `paid`, `overdue`, `waived` |
| `dueDate`            | Date          | ✅       | Ngày hết hạn thanh toán                |
| `paidAmount`         | Decimal(15,2) | ✅       | Số tiền đã trả                         |
| `paymentDate`        | DateTime      | ❌       | Ngày thanh toán                        |
| `lateFeeApplied`     | Decimal(15,2) | ✅       | Phí trễ hạn                            |
| `notes`              | Text          | ❌       | Ghi chú                                |
| `createdAt`          | DateTime      | ✅       | Thời gian tạo                          |
| `updatedAt`          | DateTime      | ✅       | Lần update cuối                        |

#### 📁 `user_cost_adoptions`

**Purpose**: Track việc user adopt custom cost types

| Field              | Type     | Required | Description                             |
| ------------------ | -------- | -------- | --------------------------------------- |
| `id`               | UUID     | ✅       | Primary key                             |
| `userId`           | UUID     | ✅       | Foreign key → users.id                  |
| `customCostTypeId` | UUID     | ✅       | Foreign key → user_custom_cost_types.id |
| `adoptedAt`        | DateTime | ✅       | Thời gian adopt                         |

---

### Pricing & Availability

Quản lý giá thuê và lịch trống.

#### 📁 `property_pricing`

**Purpose**: Giá thuê và chính sách giá của property

| Field                  | Type          | Required | Description                          |
| ---------------------- | ------------- | -------- | ------------------------------------ |
| `id`                   | UUID          | ✅       | Primary key                          |
| `propertyId`           | UUID          | ✅       | Foreign key → properties.id (unique) |
| `basePriceMonthly`     | Decimal(15,2) | ✅       | Giá thuê cơ bản/tháng                |
| `currency`             | String        | ✅       | Đồng tiền (default: "VND")           |
| `depositAmount`        | Decimal(15,2) | ✅       | Tiền cọc                             |
| `depositMonths`        | Integer       | ✅       | Số tháng cọc                         |
| `utilityIncluded`      | Boolean       | ✅       | Bao gồm tiện ích không               |
| `utilityCostMonthly`   | Decimal(15,2) | ❌       | Chi phí tiện ích/tháng               |
| `cleaningFee`          | Decimal(15,2) | ❌       | Phí vệ sinh                          |
| `serviceFeePercentage` | Decimal(5,2)  | ❌       | % phí dịch vụ platform               |
| `minimumStayMonths`    | Integer       | ✅       | Thời gian thuê tối thiểu             |
| `maximumStayMonths`    | Integer       | ❌       | Thời gian thuê tối đa                |
| `priceNegotiable`      | Boolean       | ✅       | Có thể thương lượng giá              |
| `createdAt`            | DateTime      | ✅       | Thời gian tạo                        |
| `updatedAt`            | DateTime      | ✅       | Lần update cuối                      |

**Relations**: 1→1 với properties

#### 📁 `property_availability`

**Purpose**: Lịch trống của property

| Field           | Type     | Required | Description                 |
| --------------- | -------- | -------- | --------------------------- |
| `id`            | UUID     | ✅       | Primary key                 |
| `propertyId`    | UUID     | ✅       | Foreign key → properties.id |
| `availableFrom` | Date     | ✅       | Ngày bắt đầu trống          |
| `availableTo`   | Date     | ❌       | Ngày kết thúc trống         |
| `isAvailable`   | Boolean  | ✅       | Có sẵn không                |
| `notes`         | Text     | ❌       | Ghi chú                     |
| `createdAt`     | DateTime | ✅       | Thời gian tạo               |
| `updatedAt`     | DateTime | ✅       | Lần update cuối             |

**Relations**: N→1 với properties

---

### Booking & Rental Management

Quản lý đặt phòng, hợp đồng thuê và thanh toán.

#### 📁 `booking_requests`

**Purpose**: Yêu cầu đặt phòng từ tenant

| Field            | Type          | Required | Description                                    |
| ---------------- | ------------- | -------- | ---------------------------------------------- |
| `id`             | UUID          | ✅       | Primary key                                    |
| `propertyId`     | UUID          | ✅       | Foreign key → properties.id                    |
| `tenantId`       | UUID          | ✅       | Foreign key → users.id (người thuê)            |
| `moveInDate`     | Date          | ✅       | Ngày vào ở                                     |
| `moveOutDate`    | Date          | ❌       | Ngày dự kiến ra                                |
| `rentalMonths`   | Integer       | ❌       | Số tháng thuê                                  |
| `monthlyRent`    | Decimal(15,2) | ✅       | Giá thuê/tháng                                 |
| `depositAmount`  | Decimal(15,2) | ✅       | Tiền cọc                                       |
| `totalAmount`    | Decimal(15,2) | ✅       | Tổng tiền                                      |
| `status`         | Enum          | ✅       | `pending`, `approved`, `rejected`, `cancelled` |
| `messageToOwner` | Text          | ❌       | Tin nhắn gửi chủ nhà                           |
| `ownerNotes`     | Text          | ❌       | Ghi chú của chủ nhà                            |
| `createdAt`      | DateTime      | ✅       | Thời gian tạo                                  |
| `updatedAt`      | DateTime      | ✅       | Lần update cuối                                |

**Relations**: N→1 với properties, users; 1→1 với rentals

#### 📁 `rentals`

**Purpose**: Hợp đồng thuê đang hiệu lực

| Field                   | Type          | Required | Description                                          |
| ----------------------- | ------------- | -------- | ---------------------------------------------------- |
| `id`                    | UUID          | ✅       | Primary key                                          |
| `bookingRequestId`      | UUID          | ❌       | Foreign key → booking_requests.id                    |
| `propertyId`            | UUID          | ✅       | Foreign key → properties.id                          |
| `tenantId`              | UUID          | ✅       | Foreign key → users.id (người thuê)                  |
| `ownerId`               | UUID          | ✅       | Foreign key → users.id (chủ nhà)                     |
| `contractStartDate`     | Date          | ✅       | Ngày bắt đầu hợp đồng                                |
| `contractEndDate`       | Date          | ❌       | Ngày kết thúc hợp đồng                               |
| `monthlyRent`           | Decimal(15,2) | ✅       | Tiền thuê/tháng                                      |
| `depositPaid`           | Decimal(15,2) | ✅       | Tiền cọc đã trả                                      |
| `status`                | Enum          | ✅       | `active`, `terminated`, `expired`, `pending_renewal` |
| `contractDocumentUrl`   | String        | ❌       | Link file hợp đồng                                   |
| `terminationNoticeDate` | Date          | ❌       | Ngày báo chấm dứt                                    |
| `terminationReason`     | Text          | ❌       | Lý do chấm dứt                                       |
| `createdAt`             | DateTime      | ✅       | Thời gian tạo                                        |
| `updatedAt`             | DateTime      | ✅       | Lần update cuối                                      |

**Relations**: 1→N với payments, utility_readings, cost_calculations, reviews

#### 📁 `payments`

**Purpose**: Giao dịch thanh toán

| Field                  | Type          | Required | Description                                   |
| ---------------------- | ------------- | -------- | --------------------------------------------- |
| `id`                   | UUID          | ✅       | Primary key                                   |
| `rentalId`             | UUID          | ✅       | Foreign key → rentals.id                      |
| `payerId`              | UUID          | ✅       | Foreign key → users.id (người trả)            |
| `paymentType`          | Enum          | ✅       | `rent`, `deposit`, `utility`, `fee`, `refund` |
| `amount`               | Decimal(15,2) | ✅       | Số tiền                                       |
| `currency`             | String        | ✅       | Đồng tiền                                     |
| `paymentMethod`        | Enum          | ❌       | `bank_transfer`, `cash`, `e_wallet`, `card`   |
| `paymentStatus`        | Enum          | ✅       | `pending`, `completed`, `failed`, `refunded`  |
| `paymentDate`          | DateTime      | ❌       | Ngày thanh toán                               |
| `dueDate`              | Date          | ❌       | Ngày hết hạn                                  |
| `description`          | Text          | ❌       | Mô tả                                         |
| `transactionReference` | String        | ❌       | Mã giao dịch                                  |
| `createdAt`            | DateTime      | ✅       | Thời gian tạo                                 |
| `updatedAt`            | DateTime      | ✅       | Lần update cuối                               |

---

### Communication & Reviews

Quản lý tin nhắn và đánh giá.

#### 📁 `conversations`

**Purpose**: Cuộc hội thoại giữa users

| Field           | Type     | Required | Description                                   |
| --------------- | -------- | -------- | --------------------------------------------- |
| `id`            | UUID     | ✅       | Primary key                                   |
| `propertyId`    | UUID     | ❌       | Foreign key → properties.id (nếu về property) |
| `participants`  | String[] | ✅       | Array user IDs tham gia                       |
| `subject`       | String   | ❌       | Chủ đề cuộc trò chuyện                        |
| `lastMessageAt` | DateTime | ✅       | Thời gian tin nhắn cuối                       |
| `createdAt`     | DateTime | ✅       | Thời gian tạo                                 |

#### 📁 `messages`

**Purpose**: Tin nhắn trong conversation

| Field            | Type     | Required | Description                        |
| ---------------- | -------- | -------- | ---------------------------------- |
| `id`             | UUID     | ✅       | Primary key                        |
| `conversationId` | UUID     | ✅       | Foreign key → conversations.id     |
| `senderId`       | UUID     | ✅       | Foreign key → users.id (người gửi) |
| `messageText`    | Text     | ✅       | Nội dung tin nhắn                  |
| `attachmentUrls` | String[] | ❌       | Array links file đính kèm          |
| `isRead`         | Boolean  | ✅       | Đã đọc chưa                        |
| `readAt`         | DateTime | ❌       | Thời gian đọc                      |
| `createdAt`      | DateTime | ✅       | Thời gian gửi                      |

#### 📁 `reviews`

**Purpose**: Đánh giá và review

| Field                 | Type     | Required | Description                              |
| --------------------- | -------- | -------- | ---------------------------------------- |
| `id`                  | UUID     | ✅       | Primary key                              |
| `rentalId`            | UUID     | ✅       | Foreign key → rentals.id                 |
| `reviewerId`          | UUID     | ✅       | Foreign key → users.id (người review)    |
| `revieweeId`          | UUID     | ✅       | Foreign key → users.id (người bị review) |
| `reviewerType`        | Enum     | ✅       | `tenant`, `owner`                        |
| `propertyRating`      | Integer  | ❌       | Điểm property (1-5)                      |
| `communicationRating` | Integer  | ❌       | Điểm giao tiếp (1-5)                     |
| `cleanlinessRating`   | Integer  | ❌       | Điểm vệ sinh (1-5)                       |
| `overallRating`       | Integer  | ❌       | Điểm tổng thể (1-5)                      |
| `reviewText`          | Text     | ❌       | Nội dung review                          |
| `isPublic`            | Boolean  | ✅       | Hiển thị công khai                       |
| `responseText`        | Text     | ❌       | Phản hồi từ người bị review              |
| `responseDate`        | DateTime | ❌       | Ngày phản hồi                            |
| `createdAt`           | DateTime | ✅       | Thời gian tạo                            |

---

### Support & Reporting

Hỗ trợ kỹ thuật và báo cáo vi phạm.

#### 📁 `support_tickets`

**Purpose**: Ticket hỗ trợ kỹ thuật

| Field             | Type     | Required | Description                                                |
| ----------------- | -------- | -------- | ---------------------------------------------------------- |
| `id`              | UUID     | ✅       | Primary key                                                |
| `userId`          | UUID     | ✅       | Foreign key → users.id                                     |
| `propertyId`      | UUID     | ❌       | Foreign key → properties.id                                |
| `rentalId`        | UUID     | ❌       | Foreign key → rentals.id                                   |
| `ticketType`      | Enum     | ✅       | `technical`, `payment`, `property`, `user_report`, `other` |
| `priority`        | Enum     | ✅       | `low`, `medium`, `high`, `urgent`                          |
| `status`          | Enum     | ✅       | `open`, `in_progress`, `resolved`, `closed`                |
| `subject`         | String   | ✅       | Tiêu đề                                                    |
| `description`     | Text     | ✅       | Mô tả vấn đề                                               |
| `attachments`     | String[] | ❌       | Files đính kèm                                             |
| `assignedTo`      | UUID     | ❌       | Staff được assign                                          |
| `resolutionNotes` | Text     | ❌       | Ghi chú giải quyết                                         |
| `resolvedAt`      | DateTime | ❌       | Thời gian giải quyết                                       |
| `createdAt`       | DateTime | ✅       | Thời gian tạo                                              |
| `updatedAt`       | DateTime | ✅       | Lần update cuối                                            |

#### 📁 `user_reports`

**Purpose**: Báo cáo vi phạm

| Field            | Type     | Required | Description                                                              |
| ---------------- | -------- | -------- | ------------------------------------------------------------------------ |
| `id`             | UUID     | ✅       | Primary key                                                              |
| `reporterId`     | UUID     | ✅       | Foreign key → users.id (người báo cáo)                                   |
| `reportedUserId` | UUID     | ✅       | Foreign key → users.id (người bị báo cáo)                                |
| `propertyId`     | UUID     | ❌       | Foreign key → properties.id                                              |
| `reportType`     | Enum     | ✅       | `inappropriate_behavior`, `fraud`, `property_misrepresentation`, `other` |
| `description`    | Text     | ✅       | Mô tả vi phạm                                                            |
| `evidenceUrls`   | String[] | ❌       | Bằng chứng                                                               |
| `status`         | Enum     | ✅       | `pending`, `under_review`, `resolved`, `dismissed`                       |
| `adminNotes`     | Text     | ❌       | Ghi chú admin                                                            |
| `actionTaken`    | Text     | ❌       | Hành động đã thực hiện                                                   |
| `createdAt`      | DateTime | ✅       | Thời gian tạo                                                            |
| `updatedAt`      | DateTime | ✅       | Lần update cuối                                                          |

---

### System Tables

Bảng hệ thống.

#### 📁 `notifications`

**Purpose**: Thông báo cho users

| Field              | Type     | Required | Description            |
| ------------------ | -------- | -------- | ---------------------- |
| `id`               | UUID     | ✅       | Primary key            |
| `userId`           | UUID     | ✅       | Foreign key → users.id |
| `notificationType` | String   | ✅       | Loại thông báo         |
| `title`            | String   | ✅       | Tiêu đề                |
| `message`          | Text     | ✅       | Nội dung               |
| `data`             | JSONB    | ❌       | Data bổ sung           |
| `isRead`           | Boolean  | ✅       | Đã đọc chưa            |
| `readAt`           | DateTime | ❌       | Thời gian đọc          |
| `expiresAt`        | DateTime | ❌       | Thời gian hết hạn      |
| `createdAt`        | DateTime | ✅       | Thời gian tạo          |

#### 📁 `activity_logs`

**Purpose**: Log hoạt động hệ thống

| Field          | Type     | Required | Description            |
| -------------- | -------- | -------- | ---------------------- |
| `id`           | UUID     | ✅       | Primary key            |
| `userId`       | UUID     | ❌       | Foreign key → users.id |
| `activityType` | String   | ✅       | Loại hoạt động         |
| `description`  | Text     | ✅       | Mô tả                  |
| `entityType`   | String   | ❌       | Loại entity            |
| `entityId`     | UUID     | ❌       | ID entity              |
| `metadata`     | JSONB    | ❌       | Metadata bổ sung       |
| `ipAddress`    | String   | ❌       | IP address             |
| `userAgent`    | String   | ❌       | User agent             |
| `createdAt`    | DateTime | ✅       | Thời gian tạo          |

---

## Enums

### Gender

- `male`
- `female`
- `other`

### PropertyType

- `room`
- `apartment`
- `house`
- `dormitory`

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

### CalculationMethod

- `fixed` - Cố định (tiền rác)
- `per_unit` - Theo đơn vị (điện/kWh)
- `per_person` - Theo người
- `per_vehicle` - Theo xe

### BillingCycle

- `monthly`
- `quarterly`
- `usage_based`

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

### CostPaymentStatus

- `pending`
- `paid`
- `overdue`
- `waived`

### ReviewerType

- `tenant`
- `owner`

### TicketType

- `technical`
- `payment`
- `property`
- `user_report`
- `other`

### TicketPriority

- `low`
- `medium`
- `high`
- `urgent`

### TicketStatus

- `open`
- `in_progress`
- `resolved`
- `closed`

### ReportType

- `inappropriate_behavior`
- `fraud`
- `property_misrepresentation`
- `other`

### ReportStatus

- `pending`
- `under_review`
- `resolved`
- `dismissed`

---

## Relationships

### Core Business Flow

```
User (Owner) → Property → Property_Amenities → System/Custom_Amenities
              ↓
           Property_Costs → System/Custom_Cost_Types
              ↓
           Booking_Request → Rental → Utility_Readings → Cost_Calculations
                              ↓
                           Payments & Reviews
```

### Key Relationships

#### User Relationships

- **1→N**: User có nhiều Properties (as owner)
- **1→N**: User có nhiều BookingRequests (as tenant)
- **1→N**: User có nhiều Rentals (as tenant hoặc owner)
- **1→1**: User có 1 UserProfile
- **1→N**: User có nhiều UserAddresses

#### Property Relationships

- **N→1**: Property thuộc về 1 User (owner)
- **1→N**: Property có nhiều PropertyImages
- **1→N**: Property có nhiều PropertyAmenities
- **1→N**: Property có nhiều PropertyCosts
- **1→1**: Property có 1 PropertyPricing
- **1→N**: Property có nhiều PropertyAvailability

#### Amenities Relationships

- **N→N**: Property ↔ SystemAmenities (qua PropertyAmenities)
- **N→N**: Property ↔ UserCustomAmenities (qua PropertyAmenities)
- **N→N**: User ↔ UserCustomAmenities (qua UserAmenityAdoptions)

#### Cost Relationships

- **1→N**: Rental có nhiều UtilityReadings
- **1→N**: Rental có nhiều CostCalculations
- **N→1**: CostCalculation có 1 UtilityReading (optional)

#### Rental Relationships

- **1→1**: BookingRequest → Rental (khi approved)
- **1→N**: Rental có nhiều Payments
- **1→N**: Rental có nhiều Reviews (2 chiều: tenant ↔ owner)

---

## Use Cases

### Typical User Flows

#### 1. Owner đăng property

1. Tạo Property với thông tin cơ bản
2. Upload PropertyImages
3. Add PropertyAmenities (system + custom)
4. Setup PropertyCosts với pricing tiers
5. Set PropertyPricing và PropertyAvailability

#### 2. Tenant tìm và book property

1. Search properties với filters (location, price, amenities)
2. Xem chi tiết property, amenities, costs
3. Gửi BookingRequest
4. Owner approve → tạo Rental
5. Tenant thanh toán deposit

#### 3. Monthly billing cycle

1. Ghi UtilityReadings (với photos)
2. Hệ thống auto-generate CostCalculations
3. Tenant thanh toán Payments
4. Track overdue bills

#### 4. Custom amenities workflow

1. User tạo UserCustomAmenity
2. Set isPublic = true để chia sẻ
3. User khác adopt qua UserAmenityAdoptions
4. Sử dụng cho PropertyAmenities

#### 5. End of rental

1. Tenant/Owner gửi termination notice
2. Final utility readings và bills
3. Process deposit refund
4. Both parties leave Reviews
5. Update Rental status

### Common Queries

#### Property Search

```sql
-- Tìm property với amenities và price range
SELECT p.*, pr.basePriceMonthly
FROM properties p
JOIN property_pricing pr ON p.id = pr.propertyId
JOIN property_amenities pa ON p.id = pa.propertyId
JOIN system_amenities sa ON pa.systemAmenityId = sa.id
WHERE p.city = 'Ho Chi Minh City'
  AND pr.basePriceMonthly BETWEEN 5000000 AND 15000000
  AND sa.nameEn IN ('WiFi', 'Air Conditioning')
  AND p.isActive = true
```

#### Cost Analytics

```sql
-- Tổng chi phí theo tháng cho 1 rental
SELECT
  DATE_TRUNC('month', billingPeriodStart) as month,
  SUM(totalAmount) as totalCost
FROM cost_calculations
WHERE rentalId = 'rental-uuid'
GROUP BY month
ORDER BY month DESC
```

#### Popular Custom Amenities

```sql
-- Top custom amenities được sử dụng nhiều nhất
SELECT uca.name, uca.usageCount, u.firstName || ' ' || u.lastName as creator
FROM user_custom_amenities uca
JOIN users u ON uca.creatorId = u.id
WHERE uca.isPublic = true
ORDER BY uca.usageCount DESC
LIMIT 10
```

---

**Database Version**: 1.0
**Last Updated**: January 2025
**Maintained by**: Trus
