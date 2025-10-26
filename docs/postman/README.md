# Postman Collection for Billing API

## Tổng quan

Collection này bao gồm tất cả các API endpoints cho hệ thống billing mới với auto-generation và prorated calculation.

## Files

- `BILLING_API.postman_collection.json` - Collection chính
- `BILLING_API.postman_environment.json` - Environment template
- `README.md` - Hướng dẫn sử dụng

## Cài đặt

### 1. Import Collection
1. Mở Postman
2. Click "Import" 
3. Chọn file `BILLING_API.postman_collection.json`
4. Click "Import"

### 2. Import Environment
1. Click "Environments" tab
2. Click "Import"
3. Chọn file `BILLING_API.postman_environment.json`
4. Click "Import"

### 3. Cấu hình Environment
1. Chọn environment "Billing API Environment"
2. Cập nhật các giá trị:
   - `base_url`: URL của API server
   - `rental_id`: ID của rental để test
   - `room_instance_id`: ID của room instance
   - `room_id`: ID của room
   - Các cost type IDs

## Cấu trúc Collection

### 1. Authentication
- **Login as Landlord**: Đăng nhập với tài khoản landlord
- **Login as Tenant**: Đăng nhập với tài khoản tenant

### 2. Bills - Auto Generation
- **Generate Bill - Full Period**: Tạo bill cho cả kỳ
- **Generate Bill - Prorated (Mid Month Start)**: Tạo bill với rental bắt đầu giữa tháng
- **Generate Bill - Prorated (Early End)**: Tạo bill với rental kết thúc sớm

### 3. Bills - Manual Creation
- **Create Bill - Manual**: Tạo bill thủ công

### 4. Bills - Meter Data
- **Update Meter Data - Electricity**: Cập nhật dữ liệu điện
- **Update Meter Data - Water**: Cập nhật dữ liệu nước
- **Update Meter Data - Multiple**: Cập nhật nhiều loại đồng hồ

### 5. Bills - CRUD Operations
- **Get Bills - All**: Lấy tất cả bills
- **Get Bills - By Rental**: Lấy bills theo rental
- **Get Bills - By Status**: Lấy bills theo trạng thái
- **Get Bills - By Period**: Lấy bills theo kỳ
- **Get Bills - Date Range**: Lấy bills theo khoảng thời gian
- **Get Bill by ID**: Lấy chi tiết bill
- **Update Bill**: Cập nhật bill
- **Mark Bill as Paid**: Đánh dấu đã thanh toán
- **Delete Bill**: Xóa bill

### 6. Bills - Error Cases
- **Generate Bill - Duplicate Period**: Test lỗi trùng kỳ
- **Generate Bill - Unauthorized**: Test lỗi không có quyền
- **Update Meter Data - Invalid Reading**: Test lỗi dữ liệu đồng hồ không hợp lệ

### 7. Room Costs - Setup
- **Create Fixed Cost**: Tạo cost cố định
- **Create Per Person Cost**: Tạo cost theo người
- **Create Metered Cost**: Tạo cost theo đồng hồ

## Workflow Testing

### 1. Setup Test Data
```bash
# 1. Login as landlord
POST /auth/login
{
  "email": "landlord@example.com",
  "password": "password123"
}

# 2. Create room costs
POST /rooms/{room_id}/costs
# - Fixed cost (Internet)
# - Per person cost (Cleaning)  
# - Metered cost (Electricity)
```

### 2. Test Auto-Generation
```bash
# 1. Generate bill for full period
POST /bills/generate
{
  "rentalId": "rental-id",
  "roomInstanceId": "room-instance-id",
  "billingPeriod": "2025-01",
  "occupancyCount": 2
}

# 2. Check if requiresMeterData = true
# 3. Update meter data if needed
POST /bills/{bill_id}/meter-data
[
  {
    "roomCostId": "electricity-cost-id",
    "currentReading": 1500.5,
    "lastReading": 1200.0
  }
]
```

### 3. Test Prorated Calculation
```bash
# Generate bill with rental starting mid-month
POST /bills/generate
{
  "rentalId": "rental-id",
  "roomInstanceId": "room-instance-id", 
  "billingPeriod": "2025-01",
  "rentalStartDate": "2025-01-15",
  "occupancyCount": 2
}

# Expected: Prorated calculation for fixed/per_person costs
```

### 4. Test Bill Management
```bash
# 1. Get bills
GET /bills?status=pending

# 2. Update bill
PATCH /bills/{bill_id}
{
  "discountAmount": 100000,
  "totalAmount": 4900000
}

# 3. Mark as paid
POST /bills/{bill_id}/mark-paid
```

## Variables

### Environment Variables
- `base_url`: API base URL
- `landlord_token`: JWT token cho landlord
- `tenant_token`: JWT token cho tenant
- `rental_id`: ID của rental
- `room_instance_id`: ID của room instance
- `room_id`: ID của room
- `bill_id`: ID của bill (auto-set từ response)
- `electricity_cost_id`: ID của electricity cost
- `water_cost_id`: ID của water cost
- `*_cost_type_id`: IDs của các cost types

### Auto-Set Variables
Collection có pre-request script để tự động set:
- `landlord_token` từ login response
- `bill_id` từ create/generate response
- `rental_id` từ response
- `room_instance_id` từ response

## Test Cases

### 1. Happy Path
1. Login as landlord
2. Create room costs (fixed, per_person, metered)
3. Generate bill for full period
4. Update meter data if needed
5. Verify bill calculation
6. Mark bill as paid

### 2. Prorated Calculation
1. Generate bill with rental starting mid-month
2. Verify prorated calculation for fixed/per_person costs
3. Verify metered costs not prorated

### 3. Error Handling
1. Try to generate duplicate bill
2. Try to generate bill without authorization
3. Try to update meter data with invalid readings

### 4. Edge Cases
1. Generate bill with occupancy count = 0
2. Generate bill with rental period outside billing period
3. Update meter data with negative usage

## Expected Responses

### Generate Bill Response
```json
{
  "id": "bill-uuid",
  "rentalId": "rental-uuid",
  "roomInstanceId": "room-instance-uuid",
  "billingPeriod": "2025-01",
  "billingMonth": 1,
  "billingYear": 2025,
  "periodStart": "2025-01-01T00:00:00.000Z",
  "periodEnd": "2025-01-31T00:00:00.000Z",
  "rentalStartDate": "2025-01-15T00:00:00.000Z",
  "rentalEndDate": "2025-01-31T00:00:00.000Z",
  "occupancyCount": 2,
  "subtotal": 5000000,
  "discountAmount": 0,
  "taxAmount": 0,
  "totalAmount": 5000000,
  "paidAmount": 0,
  "remainingAmount": 5000000,
  "status": "draft",
  "dueDate": "2025-01-31T00:00:00.000Z",
  "isAutoGenerated": true,
  "requiresMeterData": true,
  "billItems": [
    {
      "itemType": "rent",
      "itemName": "Tiền thuê phòng",
      "description": "Tiền thuê phòng (54.8% tháng)",
      "quantity": 1,
      "unitPrice": 2741935,
      "amount": 2741935,
      "currency": "VND"
    },
    {
      "itemType": "utility",
      "itemName": "Internet",
      "description": "Internet (54.8% tháng)",
      "quantity": 1,
      "unitPrice": 274193,
      "amount": 274193,
      "currency": "VND"
    }
  ]
}
```

## Troubleshooting

### Common Issues
1. **401 Unauthorized**: Check if token is set correctly
2. **404 Not Found**: Check if IDs are correct
3. **400 Bad Request**: Check request body format
4. **409 Conflict**: Bill already exists for this period

### Debug Steps
1. Check environment variables
2. Verify authentication token
3. Check request body format
4. Check server logs
5. Verify database data

## Notes

- Collection includes pre-request scripts for auto-setting variables
- All requests include proper error handling
- Environment variables are automatically updated from responses
- Collection covers all billing scenarios including edge cases
