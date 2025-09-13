# Room Detail với SEO, Breadcrumb và Similar Rooms

## Tổng quan

Room Detail Service đã được cập nhật để hỗ trợ:
- SEO metadata (title, description, keywords)
- Breadcrumb navigation
- Similar rooms (8 phòng tương tự cùng huyện và tỉnh)

## API Endpoint

### Room Detail với SEO, Breadcrumb và Similar Rooms

**Endpoint:** `GET /rooms/public/slug/:slug`

**Response Structure:**
```json
{
  "success": true,
  "message": "Room retrieved successfully",
  "data": {
    "id": "billhanhquan-binh-thanh-phong-5",
    "slug": "billhanhquan-binh-thanh-phong-5",
    "name": "Cho Thuê phòng trọ: 20 Trần Bình Trọng- P.5- Q. Bình Thạnh",
    "roomType": "boarding_house",
    "areaSqm": "20",
    "maxOccupancy": 2,
    "isVerified": false,
    "buildingName": "Nhà trọ Billhanh",
    "buildingVerified": false,
    "address": "Đường Trần Bình Trọng",
    "availableRooms": 1,
    "owner": {
      "name": "Vũ Thị Linh",
      "gender": "female",
      "email": "premium.business@trustay.com",
      "phone": "0901234574",
      "verifiedPhone": true,
      "verifiedEmail": true,
      "verifiedIdentity": false,
      "totalBuildings": 11,
      "totalRoomInstances": 16
    },
    "location": {
      "provinceId": 50,
      "provinceName": "Thành phố Hồ Chí Minh",
      "districtId": 539,
      "districtName": "Quận Bình Thạnh",
      "wardId": 8232,
      "wardName": "Phường 5"
    },
    "images": [...],
    "amenities": [...],
    "costs": [...],
    "pricing": {
      "basePriceMonthly": "3000000",
      "depositAmount": "3000000",
      "utilityIncluded": false
    },
    "rules": [],
    "description": "...",
    "floorNumber": 1,
    "totalRooms": 1,
    "isActive": true,
    "buildingDescription": "Nhà trọ được quản lý bởi Vũ Thị Linh",
    "addressLine2": "20",
    "viewCount": 0,
    "lastUpdated": "2025-09-10T16:09:29.474Z",
    
    // NEW: SEO metadata
    "seo": {
      "title": "Cho Thuê phòng trọ: 20 Trần Bình Trọng- P.5- Q. Bình Thạnh - nhà trọ tại Quận Bình Thạnh 3.0 triệu/tháng | Trustay",
      "description": "Cho Thuê phòng trọ: 20 Trần Bình Trọng- P.5- Q. Bình Thạnh - nhà trọ chất lượng cao tại Quận Bình Thạnh với giá 3.0 triệu/tháng. Xem chi tiết, đặt phòng ngay!",
      "keywords": "Cho Thuê phòng trọ: 20 Trần Bình Trọng- P.5- Q. Bình Thạnh, nhà trọ, phòng trọ, thuê phòng, Quận Bình Thạnh, giá rẻ, đầy đủ tiện nghi, chất lượng cao"
    },
    
    // NEW: Breadcrumb navigation
    "breadcrumb": {
      "items": [
        { "title": "Trang chủ", "path": "/" },
        { "title": "Tìm phòng trọ", "path": "/rooms" },
        { "title": "Phường 5", "path": "/rooms?wardId=8232" },
        { "title": "Quận Bình Thạnh", "path": "/rooms?districtId=539" },
        { "title": "Nhà trọ", "path": "/rooms?roomType=boarding_house" },
        { "title": "Cho Thuê phòng trọ: 20 Trần Bình Trọng- P.5- Q. Bình Thạnh", "path": "/rooms/billhanhquan-binh-thanh-phong-5" }
      ]
    },
    
    // NEW: Similar rooms (8 phòng tương tự)
    "similarRooms": [
      {
        "id": "room-2-id",
        "slug": "room-2-slug",
        "name": "Phòng trọ đẹp Quận Bình Thạnh",
        "roomType": "boarding_house",
        "areaSqm": "25",
        "maxOccupancy": 2,
        "isVerified": false,
        "buildingName": "Nhà trọ ABC",
        "buildingVerified": false,
        "address": "Đường ABC",
        "availableRooms": 3,
        "owner": {
          "name": "Nguyễn Văn A",
          "gender": "male",
          "email": "owner@example.com",
          "phone": "0901234567",
          "verifiedPhone": true,
          "verifiedEmail": true,
          "verifiedIdentity": false,
          "totalBuildings": 5,
          "totalRoomInstances": 12
        },
        "location": {
          "provinceId": 50,
          "provinceName": "Thành phố Hồ Chí Minh",
          "districtId": 539,
          "districtName": "Quận Bình Thạnh",
          "wardId": 8233,
          "wardName": "Phường 6"
        },
        "images": [
          {
            "url": "https://example.com/image.jpg",
            "alt": "Phòng trọ đẹp",
            "isPrimary": true,
            "sortOrder": 0
          }
        ],
        "amenities": [
          {
            "id": "amenity-1",
            "name": "Điều hòa",
            "category": "basic",
            "customValue": null,
            "notes": null
          }
        ],
        "costs": [
          {
            "id": "cost-1",
            "name": "Tiền điện",
            "value": "3500",
            "category": "utility",
            "notes": null
          }
        ],
        "pricing": {
          "basePriceMonthly": "2800000",
          "depositAmount": "2800000",
          "utilityIncluded": false
        },
        "rules": [],
        "description": "Phòng trọ đẹp, thoáng mát...",
        "floorNumber": 2,
        "totalRooms": 5,
        "isActive": true,
        "buildingDescription": "Nhà trọ được quản lý bởi Nguyễn Văn A",
        "addressLine2": "123",
        "viewCount": 15,
        "lastUpdated": "2025-09-12T10:30:00.000Z"
      }
      // ... 7 phòng tương tự khác
    ]
  },
  "timestamp": "2025-09-13T15:38:47.607Z"
}
```

## Features

### 1. SEO Metadata
- **Dynamic Title**: "[Room Name] - [Room Type] tại [Location] [Price] | Trustay"
- **Dynamic Description**: Bao gồm tên phòng, loại phòng, vị trí, giá tiền
- **Keywords**: Tự động generate từ thông tin phòng

### 2. Breadcrumb Navigation
- **Base**: Trang chủ → Tìm phòng trọ
- **Location**: Province → District → Ward (nếu có)
- **Room Type**: Loại phòng nếu có
- **Current**: Tên phòng (trang hiện tại)

### 3. Similar Rooms
- **Criteria**: Cùng district và province
- **Exclusion**: Loại trừ phòng hiện tại
- **Limit**: 8 phòng tương tự
- **Ordering**: Popular rooms first (viewCount desc), then newest (createdAt desc)
- **Format**: Sử dụng `RoomListItemOutputDto` (giống listing page)

## Frontend Integration

### SEO Integration
```typescript
// Set page title
document.title = response.seo.title;

// Set meta description
document.querySelector('meta[name="description"]').content = response.seo.description;

// Set meta keywords
document.querySelector('meta[name="keywords"]').content = response.seo.keywords;
```

### Breadcrumb Integration
```typescript
// Render breadcrumb navigation
const breadcrumbItems = response.breadcrumb.items.map(item => ({
  label: item.title,
  href: item.path,
  isActive: item.isActive
}));
```

### Similar Rooms Integration
```typescript
// Render similar rooms
const similarRooms = response.similarRooms.map(room => ({
  id: room.id,
  name: room.name,
  price: room.pricing.basePriceMonthly,
  image: room.images[0]?.url,
  location: `${room.location.wardName}, ${room.location.districtName}`,
  // ... other fields
}));
```

## Database Query Optimization

### Similar Rooms Query
```sql
SELECT * FROM rooms 
WHERE id != :currentRoomId 
  AND isActive = true 
  AND buildingId IN (
    SELECT id FROM buildings 
    WHERE districtId = :districtId 
      AND provinceId = :provinceId
  )
ORDER BY viewCount DESC, createdAt DESC
LIMIT 8;
```

### Performance Notes
- Similar rooms query được optimize với indexes trên `districtId` và `provinceId`
- Chỉ fetch primary image cho similar rooms để giảm data transfer
- Sử dụng `formatRoomListItem` để đảm bảo consistency với listing page
