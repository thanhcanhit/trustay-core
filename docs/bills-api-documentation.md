# Bills API Documentation

Tài liệu này mô tả flow và các endpoints của hệ thống quản lý hóa đơn (Bills Management).

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Endpoints](#endpoints)
3. [Data Models](#data-models)

---

## Flow Overview

### 1. Tạo Hóa Đơn Tháng Cho Building (Monthly Bill Generation)

**Mục đích**: Tạo tự động các hóa đơn draft cho tất cả phòng có người thuê trong một building cho kỳ hóa đơn cụ thể.

**Flow**:
```
1. Landlord gọi API generate-monthly-bills-for-building
   ↓
2. Hệ thống tìm tất cả room instances có active rental trong building
   ↓
3. Với mỗi room:
   - Kiểm tra xem đã có bill cho billing period chưa (unique: rentalId + billingPeriod)
   - Nếu chưa có: Tạo bill mới ở trạng thái draft
   - Tính toán bill items dựa trên:
     * Fixed costs (giá cố định)
     * Per-person costs (chia theo số người - mặc định = 1)
     * Metered costs (chỉ tính nếu có meter readings)
   - Nếu có metered costs chưa có readings: đánh dấu requiresMeterData = true
   ↓
4. Trả về số lượng bills đã tạo và số bills đã tồn tại
```

**Lưu ý**:
- Chỉ tạo bill cho phòng có active rental
- Mỗi rental chỉ có 1 bill cho mỗi billing period (unique constraint)
- Bills được tạo ở trạng thái `draft`
- Default billing period = tháng trước nếu không chỉ định
- Default occupancy count = 1 (cần cập nhật sau)

### 2. Cập Nhật Meter Data và Occupancy

**Mục đích**: Cập nhật số đồng hồ (meter readings) và số người ở (occupancy) cho các bill đã tạo, sau đó tính lại bill items.

**Flow**:
```
1. Landlord gọi API update-with-meter-data hoặc :id/meter-data
   ↓
2. Hệ thống:
   - Cập nhật meter readings trong RoomCost
   - Cập nhật occupancyCount trong Bill
   ↓
3. Tính lại bill items:
   - Fixed costs: prorated theo thời gian rental
   - Per-person costs: prorated × occupancy count
   - Metered costs: (currentReading - lastReading) × unitPrice
   ↓
4. Cập nhật subtotal, totalAmount, remainingAmount
5. Nếu tất cả metered costs đã có readings: requiresMeterData = false
```

### 3. Xem và Xử Lý Bills

**Mục đích**: Landlord xem danh sách bills để xử lý, Tenant xem bills của mình.

**Flow cho Landlord**:
```
1. Landlord gọi API landlord/by-month với filters:
   - buildingId (optional)
   - roomInstanceId (optional - lọc theo building + room)
   - status (optional)
   - billingPeriod / billingMonth + billingYear (default = tháng hiện tại)
   - search (optional - tìm theo tên/số phòng)
   ↓
2. Hệ thống trả về danh sách bills đã paginated với:
   - Sort options: roomName, status, totalAmount, createdAt, dueDate
   - Filter theo các điều kiện trên
   ↓
3. Landlord có thể:
   - Xem chi tiết bill: GET /bills/:id
   - Cập nhật bill: PATCH /bills/:id
   - Đánh dấu đã thanh toán: POST /bills/:id/mark-paid
   - Xóa bill (chỉ draft hoặc pending): DELETE /bills/:id
```

**Flow cho Tenant**:
```
1. Tenant gọi API tenant/my-bills với filters:
   - rentalId (optional)
   - roomInstanceId (optional)
   - status (optional)
   - billingPeriod (optional)
   - fromDate, toDate (optional)
   ↓
2. Hệ thống trả về danh sách bills của tenant với pagination
   ↓
3. Tenant có thể xem chi tiết bill: GET /bills/:id
```

---

## Endpoints

### Base URL
```
/api/bills
```

### Authentication
Tất cả endpoints đều yêu cầu JWT Bearer Token trong header:
```
Authorization: Bearer <token>
```

---

## 1. Tạo Hóa Đơn

### 1.1. Tạo Hóa Đơn Thủ Công
**POST** `/bills`

**Role**: `landlord`

**Request Body** (`CreateBillDto`):
```typescript
{
  rentalId: string;              // Required - ID của rental
  roomInstanceId: string;        // Required - ID của room instance
  billingPeriod: string;         // Required - Format: "YYYY-MM", e.g. "2025-01"
  billingMonth: number;          // Required - 1-12
  billingYear: number;          // Required - >= 2020
  periodStart: string;            // Required - Format: "YYYY-MM-DD"
  periodEnd: string;             // Required - Format: "YYYY-MM-DD"
  subtotal: number;              // Required - >= 0
  discountAmount?: number;       // Optional - >= 0, default: 0
  taxAmount?: number;            // Optional - >= 0, default: 0
  totalAmount: number;           // Required - >= 0
  dueDate: string;               // Required - Format: "YYYY-MM-DD"
  notes?: string;                 // Optional
}
```

**Response**: `BillResponseDto` (201 Created)

---

### 1.2. Tạo Hóa Đơn Cho Phòng (Tự Động Tính Toán)
**POST** `/bills/create-for-room`

**Role**: `landlord`

**Request Body** (`CreateBillForRoomDto`):
```typescript
{
  roomInstanceId: string;        // Required
  billingPeriod: string;         // Required - Format: "YYYY-MM"
  billingMonth: number;          // Required - 1-12
  billingYear: number;          // Required - >= 2020
  periodStart: string;           // Required - Format: "YYYY-MM-DD"
  periodEnd: string;             // Required - Format: "YYYY-MM-DD"
  occupancyCount: number;        // Required - >= 1
  meterReadings: Array<{         // Required - Dữ liệu đồng hồ
    roomCostId: string;          // ID của room cost (metered type)
    currentReading: number;       // >= 0
    lastReading: number;        // >= 0
  }>;
  notes?: string;                // Optional
}
```

**Response**: `BillResponseDto` (201 Created)

**Lưu ý**: API này sẽ tự động tính toán bill items dựa trên:
- Room costs (fixed, per_person, metered)
- Occupancy count
- Meter readings
- Proration factor (nếu rental không trọn kỳ)

---

### 1.3. Tổng Kết và Tạo Hóa Đơn Tháng Cho Building
**POST** `/bills/generate-monthly-bills-for-building`

**Role**: `landlord`

**Request Body** (`PreviewBuildingBillDto`):
```typescript
{
  buildingId: string;            // Required
  billingPeriod?: string;        // Optional - Format: "YYYY-MM"
  billingMonth?: number;         // Optional - 1-12
  billingYear?: number;          // Optional - >= 2020
  periodStart?: string;          // Optional - Format: "YYYY-MM-DD", default: đầu tháng trước
  periodEnd?: string;            // Optional - Format: "YYYY-MM-DD", default: ngày hiện tại
}
```

**Response**:
```typescript
{
  message: string;               // Thông báo kết quả
  billsCreated: number;          // Số bills đã tạo mới
  billsExisted: number;         // Số bills đã tồn tại
}
```

**Lưu ý**:
- Mặc định billing period = tháng trước nếu không chỉ định
- Chỉ tạo bills cho phòng có active rental
- Mỗi rental chỉ có 1 bill cho mỗi billing period
- Bills được tạo ở trạng thái `draft`
- Occupancy count mặc định = 1 (cần cập nhật sau)

---

## 2. Truy Vấn Hóa Đơn

### 2.1. Lấy Danh Sách Hóa Đơn (Tenant)
**GET** `/bills/tenant/my-bills`

**Role**: `tenant`

**Query Parameters** (`QueryBillDto`):
```typescript
{
  page?: number;                 // Optional - default: 1, min: 1
  limit?: number;                // Optional - default: 20, min: 1, max: 100
  rentalId?: string;             // Optional
  roomInstanceId?: string;       // Optional
  status?: BillStatus;            // Optional - draft, pending, paid, overdue, cancelled
  fromDate?: string;              // Optional - Format: "YYYY-MM-DD"
  toDate?: string;                // Optional - Format: "YYYY-MM-DD"
  billingPeriod?: string;        // Optional - Format: "YYYY-MM"
}
```

**Response**: `PaginatedBillResponseDto`
```typescript
{
  data: BillResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    itemCount: number;
  };
}
```

---

### 2.2. Lấy Danh Sách Hóa Đơn Tháng (Landlord)
**GET** `/bills/landlord/by-month`

**Role**: `landlord`

**Query Parameters** (`QueryBillsForLandlordDto`):
```typescript
{
  page?: number;                 // Optional - default: 1, min: 1
  limit?: number;                // Optional - default: 20, min: 1, max: 100
  buildingId?: string;           // Optional - Lọc theo building
  roomInstanceId?: string;        // Optional - Lọc theo building + room
  billingPeriod?: string;        // Optional - Format: "YYYY-MM"
  billingMonth?: number;         // Optional - 1-12
  billingYear?: number;          // Optional - >= 2020
  status?: BillStatus;            // Optional - draft, pending, paid, overdue, cancelled
  search?: string;                // Optional - Tìm theo tên/số phòng
  sortBy?: string;                // Optional - roomName, status, totalAmount, createdAt, dueDate, default: roomName
  sortOrder?: 'asc' | 'desc';     // Optional - default: asc
}
```

**Response**: `PaginatedBillResponseDto`

**Lưu ý**:
- Mặc định billing period = tháng hiện tại nếu không chỉ định
- Nếu có `roomInstanceId`, filter `buildingId` bị bỏ qua
- `search` tìm kiếm theo tên phòng hoặc số phòng

---

### 2.3. Lấy Danh Sách Hóa Đơn (General)
**GET** `/bills`

**Roles**: `tenant`, `landlord`

**Query Parameters**: Tương tự `QueryBillDto` (xem 2.1)

**Response**: `PaginatedBillResponseDto`

**Lưu ý**: 
- Tenant chỉ thấy bills của mình
- Landlord chỉ thấy bills của buildings mình sở hữu

---

### 2.4. Lấy Chi Tiết Hóa Đơn
**GET** `/bills/:id`

**Roles**: `tenant`, `landlord`

**Path Parameters**:
- `id`: string - ID của bill

**Response**: `BillResponseDto`

---

## 3. Cập Nhật Hóa Đơn

### 3.1. Cập Nhật Hóa Đơn (Basic)
**PATCH** `/bills/:id`

**Role**: `landlord`

**Path Parameters**:
- `id`: string - ID của bill

**Request Body** (`UpdateBillDto`):
```typescript
{
  status?: BillStatus;           // Optional
  discountAmount?: number;        // Optional - >= 0
  taxAmount?: number;             // Optional - >= 0
  totalAmount?: number;           // Optional - >= 0
  dueDate?: string;               // Optional - Format: "YYYY-MM-DD"
  notes?: string;                  // Optional
}
```

**Response**: `BillResponseDto`

---

### 3.2. Cập Nhật Bill Với Meter Data và Occupancy
**POST** `/bills/update-with-meter-data`

**Role**: `landlord`

**Request Body** (`UpdateBillWithMeterDataDto`):
```typescript
{
  billId: string;                 // Required
  occupancyCount: number;        // Required - >= 1
  meterData: Array<{             // Required
    roomCostId: string;           // ID của room cost (metered type)
    currentReading: number;       // >= 0
    lastReading: number;          // >= 0
  }>;
}
```

**Response**: `BillResponseDto`

**Lưu ý**: API này sẽ:
- Cập nhật meter readings trong RoomCost
- Cập nhật occupancyCount trong Bill
- Tính lại tất cả bill items
- Cập nhật totals (subtotal, totalAmount, remainingAmount)

---

### 3.3. Cập Nhật Meter Data Cho Bill Cụ Thể
**POST** `/bills/:id/meter-data`

**Role**: `landlord`

**Path Parameters**:
- `id`: string - ID của bill

**Request Body**: `MeterDataDto[]`
```typescript
[
  {
    roomCostId: string;           // Required
    currentReading: number;        // Required - >= 0
    lastReading: number;          // Required - >= 0
  }
]
```

**Response**: `BillResponseDto`

**Lưu ý**: Chỉ cập nhật meter data, không cập nhật occupancy.

---

## 4. Đánh Dấu Thanh Toán

### 4.1. Đánh Dấu Hóa Đơn Đã Thanh Toán
**POST** `/bills/:id/mark-paid`

**Role**: `landlord`

**Path Parameters**:
- `id`: string - ID của bill

**Response**: `BillResponseDto`

**Lưu ý**: 
- Tự động cập nhật `status = paid`
- Tự động cập nhật `paidDate = now()`
- Tự động cập nhật `paidAmount = totalAmount`

---

## 5. Xóa Hóa Đơn

### 5.1. Xóa Hóa Đơn
**DELETE** `/bills/:id`

**Role**: `landlord`

**Path Parameters**:
- `id`: string - ID của bill

**Response**: `204 No Content`

**Lưu ý**: 
- Chỉ cho phép xóa bills ở trạng thái `draft` hoặc `pending`
- Không thể xóa bills đã thanh toán (`paid`)

---

## Data Models

### BillStatus Enum
```typescript
enum BillStatus {
  draft = 'draft',        // Nháp
  pending = 'pending',    // Chờ thanh toán
  paid = 'paid',          // Đã thanh toán
  overdue = 'overdue',    // Quá hạn
  cancelled = 'cancelled' // Đã hủy
}
```

### BillResponseDto
```typescript
{
  id: string;
  rentalId: string;
  roomInstanceId: string;
  billingPeriod: string;          // "YYYY-MM"
  billingMonth: number;           // 1-12
  billingYear: number;
  periodStart: Date;
  periodEnd: Date;
  rentalStartDate?: Date;         // Ngày bắt đầu rental trong kỳ
  rentalEndDate?: Date;           // Ngày kết thúc rental trong kỳ
  occupancyCount?: number;        // Số người ở
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: BillStatus;
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  isAutoGenerated: boolean;
  requiresMeterData: boolean;     // Có cần nhập meter data không
  createdAt: Date;
  updatedAt: Date;
  billItems: BillItemDto[];
  rental?: {
    id: string;
    monthlyRent: number;
    roomInstance: {
      roomNumber: string;
      room: {
        name: string;
      };
    };
  };
  meteredCostsToInput?: Array<{     // Danh sách metered costs cần nhập data
    roomCostId: string;             // ID để truyền lên khi update meter data
    name: string;                   // Tên cost (VD: "Điện", "Nước")
    unit: string;                    // Đơn vị (VD: "kWh", "m³")
  }>;
}
```

### PaginatedBillResponseDto
```typescript
{
  data: BillResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    itemCount: number;
  };
}
```

---

## Best Practices

### 1. Tạo Bills Tháng
1. Gọi `POST /bills/generate-monthly-bills-for-building` để tạo draft bills cho tháng
2. Lấy danh sách bills: `GET /bills/landlord/by-month?status=draft`
3. Với mỗi bill có `requiresMeterData = true`, cập nhật meter data:
   - `POST /bills/update-with-meter-data` hoặc
   - `POST /bills/:id/meter-data`
4. Sau khi cập nhật xong, bills sẽ tự động tính lại totals

### 2. Xử Lý Bills
1. Xem danh sách bills: `GET /bills/landlord/by-month`
2. Filter theo building, room, status, v.v.
3. Xem chi tiết: `GET /bills/:id`
4. Cập nhật nếu cần: `PATCH /bills/:id`
5. Đánh dấu thanh toán: `POST /bills/:id/mark-paid`

### 3. Tenant Xem Bills
1. Xem danh sách: `GET /bills/tenant/my-bills`
2. Filter theo status, billing period, v.v.
3. Xem chi tiết: `GET /bills/:id`

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 400 | Bad Request - Validation errors |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Bill/Rental/Building not found |
| 409 | Conflict - Bill already exists for this period |

---

## Response Mẫu

### Response Mẫu - Bill cần nhập Meter Data

```json
{
  "id": "bill-123",
  "rentalId": "rental-456",
  "roomInstanceId": "room-instance-789",
  "billingPeriod": "2025-01",
  "billingMonth": 1,
  "billingYear": 2025,
  "periodStart": "2025-01-01",
  "periodEnd": "2025-01-31",
  "subtotal": 3000000,
  "discountAmount": 0,
  "taxAmount": 0,
  "totalAmount": 3000000,
  "paidAmount": 0,
  "remainingAmount": 3000000,
  "status": "draft",
  "dueDate": "2025-01-31",
  "notes": "Auto-generated bill for 2025-01",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z",
  "billItems": [
    {
      "id": "item-1",
      "itemType": "utility",
      "itemName": "Tiền thuê phòng",
      "description": "Tiền thuê phòng (100% tháng)",
      "quantity": 1,
      "unitPrice": 3000000,
      "amount": 3000000,
      "currency": "VND",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "rental": {
    "id": "rental-456",
    "monthlyRent": 3000000,
    "roomInstance": {
      "roomNumber": "101",
      "room": {
        "name": "Phòng đôi"
      }
    }
  },
  "meteredCostsToInput": [
    {
      "roomCostId": "room-cost-1",
      "name": "Điện",
      "unit": "kWh"
    },
    {
      "roomCostId": "room-cost-2",
      "name": "Nước",
      "unit": "m³"
    }
  ]
}
```

### Request Mẫu - Update Meter Data

```json
{
  "billId": "bill-123",
  "occupancyCount": 2,
  "meterData": [
    {
      "roomCostId": "room-cost-1",
      "currentReading": 1500.5,
      "lastReading": 1200.0
    },
    {
      "roomCostId": "room-cost-2",
      "currentReading": 150.5,
      "lastReading": 120.0
    }
  ]
}
```

**Lưu ý về `meteredCostsToInput`**:
- Chỉ trả về các metered costs **chưa có readings** (cần nhập)
- Frontend dùng `roomCostId` để truyền lên khi update meter data
- Sau khi update meter data:
  - Hệ thống sẽ tính lại bill items với meter readings mới
  - Tự động cập nhật status: `draft` → `pending` (nếu có metered costs)
  - Phòng không có metered costs: status = `pending` ngay từ khi tạo

---

## Notes

- Tất cả dates sử dụng ISO 8601 format: `YYYY-MM-DD`
- Billing period format: `YYYY-MM`
- Tất cả amounts là số dương (>= 0)
- Pagination: `page` bắt đầu từ 1, `limit` tối đa 100
- Unique constraint: Mỗi `rentalId` + `billingPeriod` chỉ có 1 bill
- **Metered Costs**: 
  - Response chỉ trả về `meteredCostsToInput` (chỉ những metered costs chưa có readings)
  - Phòng không có metered costs: status = `pending` ngay từ khi tạo
  - Phòng có metered costs chưa có readings: status = `draft`
  - Sau khi nhập đủ meter data: status tự động chuyển từ `draft` → `pending`

