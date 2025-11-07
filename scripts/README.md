# Database Scripts

Thư mục này chứa các script JavaScript để quản lý dữ liệu trong database.

## Scripts có sẵn

### 1. Import Reference Data
```bash
# Import tất cả dữ liệu tham chiếu
node scripts/import-reference-data.js

# Hoặc sử dụng npm script (nếu đã cấu hình)
npm run import:reference-data
```

**Chức năng:**
- Import danh sách tiện ích hệ thống (SystemAmenity)
- Import danh sách loại chi phí hệ thống (SystemCostType)
- Tự động skip nếu dữ liệu đã tồn tại
- Hiển thị progress và summary

### 2. Clear Reference Data
```bash
# Xóa tất cả dữ liệu tham chiếu
node scripts/clear-reference-data.js
```

**Chức năng:**
- Xóa tất cả SystemAmenity
- Xóa tất cả SystemCostType
- Sử dụng khi cần reset database

### 3. Setup Statistics Test Data
```bash
# Tạo dữ liệu test cho thống kê
node scripts/setup-stats-test-data.js

# Xóa dữ liệu test
node scripts/setup-stats-test-data.js clear
```

**Chức năng:**
- Tạo landlord: `budget.student@trustay.com`
- Tạo 4 phòng trọ với cấu hình khác nhau
- Tạo 4 tenant (sinh viên) để ở các phòng
- Tạo rentals cho các phòng
- Tạo hóa đơn cho 3 tháng gần nhất (2 tháng đã trả, 1 tháng chưa trả)
- Tạo payments cho các hóa đơn đã trả
- Tạo ratings từ tenants
- Dữ liệu phù hợp để test các tính năng thống kê

**Dữ liệu được tạo:**
- **Building**: Nhà trọ Sinh viên Quận 1
- **Rooms**: 4 phòng (101, 102, 201, 202) với giá từ 1.5M - 3M VND
- **Tenants**: 4 sinh viên với thông tin đầy đủ
- **Bills**: 12 hóa đơn (4 phòng × 3 tháng)
- **Payments**: 8 payments (2 tháng đã trả)
- **Ratings**: 4 ratings từ tenants

## Dữ liệu được import

### System Amenities (43 items)
- **Basic**: Điều hòa, quạt trần, tủ lạnh, giường, bàn ghế...
- **Kitchen**: Bếp gas/điện, lò vi sóng, bồn rửa bát...
- **Bathroom**: Vòi sen, bồn tắm, toilet riêng, nước nóng...
- **Entertainment**: TV, truyền hình cáp, âm thanh...
- **Safety**: Khóa an toàn, camera, bảo vệ, báo cháy...
- **Connectivity**: WiFi, internet cáp quang, điện thoại...
- **Building**: Thang máy, máy giặt, parking, gym, hồ bơi...

### System Cost Types (25 items)
- **Utility**: Điện, nước, gas, internet, truyền hình...
- **Service**: Dọn dẹp, giặt ủi, bảo vệ, quản lý tòa nhà...
- **Parking**: Gửi xe máy/ô tô theo tháng/giờ...
- **Maintenance**: Sửa chữa, bảo trì, sơn sửa, khử trùng...

## Cấu trúc dữ liệu

### SystemAmenity
```javascript
{
  name: 'Tên tiếng Việt',
  nameEn: 'english_name',
  category: 'basic|kitchen|bathroom|entertainment|safety|connectivity|building',
  description: 'Mô tả chi tiết',
  sortOrder: 1,
  isActive: true
}
```

### SystemCostType
```javascript
{
  name: 'Tên tiếng Việt',
  nameEn: 'english_name', 
  category: 'utility|service|parking|maintenance',
  defaultUnit: 'kWh|m³|tháng|lần',
  description: 'Mô tả chi tiết',
  sortOrder: 1,
  isActive: true
}
```

## Thêm vào package.json

Thêm các script sau vào `package.json`:

```json
{
  "scripts": {
    "import:reference-data": "node scripts/import-reference-data.js",
    "clear:reference-data": "node scripts/clear-reference-data.js"
  }
}
```

## Lưu ý
- Scripts sử dụng Prisma Client để kết nối database
- Cần có DATABASE_URL trong .env file
- Script sẽ tự động tạo UUID cho các record mới
- Sử dụng nameEn làm unique key để tránh duplicate