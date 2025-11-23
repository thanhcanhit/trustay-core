  # API Room Publishing với AI

  ## Tổng quan

  API này cho phép người dùng đăng phòng trọ thông qua cuộc trò chuyện với AI. AI sẽ tự động hỏi các thông tin cần thiết (giá cả, vị trí, hình ảnh) và tự động tạo các thông tin khác (tên phòng, mô tả, loại phòng, số phòng).

  ## Endpoint

  ### POST `/api/ai/room-publish`

  **Mô tả**: Endpoint chuyên dụng cho room publishing flow, tách biệt hoàn toàn khỏi chat flow thông thường.

  **Authentication**: Bắt buộc (JWT Bearer Token)

  **Request Body**:

  ```typescript
  {
    message: string;        // Tin nhắn của người dùng về thông tin phòng
    buildingId?: string;    // (Optional) ID của building nếu đã biết. Nếu có, sẽ bỏ qua bước tìm/select building
    images?: string[];      // (Optional) Danh sách đường dẫn hình ảnh phòng
  }
  ```

  **Ví dụ Request**:

  ```json
  {
    "message": "1 phòng 2 triệu, cọc 1 triệu. Điện 3k nước 5k",
    "buildingId": "02a927ba-c5e4-40e3-a64c-0187c9b35e33",
    "images": ["/images/photo1.jpg", "/images/photo2.jpg"]
  }
  ```

  **Lưu ý về `buildingId`**:
  - Nếu frontend đã biết building ID (ví dụ: user đang ở trang building detail), có thể truyền vào để bỏ qua bước tìm/select building
  - Nếu không truyền `buildingId`, AI sẽ tự động hỏi về tên tòa nhà và địa điểm để tìm/select building

  **Response**:

  #### 1. Khi đang thu thập thông tin (chưa đủ thông tin)

  **Status**: `200 OK`

  ```typescript
  {
    success: true,
    data: {
      kind: 'CONTENT',
      sessionId: string,
      timestamp: string,
      message: string,  // Câu hỏi từ AI (ví dụ: "Mình cần thêm thông tin về giá thuê/tháng...")
      payload: {
        mode: 'CONTENT'
      },
      meta: {
        stage: string  // 'capture-context' | 'ensure-building' | 'collect-room-core' | 'enrich-room' | 'finalize-room'
      }
    }
  }
  ```

  **Ví dụ Response**:

  ```json
  {
    "success": true,
    "data": {
      "kind": "CONTENT",
      "sessionId": "user_02a927ba-c5e4-40e3-a64c-0187c9b35e33",
      "timestamp": "2025-11-22T15:18:05.000Z",
      "message": "Mình cần thêm một số thông tin để hoàn tất đăng phòng. Bạn có thể cung cấp tất cả cùng lúc được không?\n\n• Giá thuê mỗi tháng (ví dụ: 2 triệu, 3000000)\n• Địa điểm (ví dụ: Quận 1 TP.HCM, Gò Vấp Hồ Chí Minh)",
      "payload": {
        "mode": "CONTENT"
      },
      "meta": {
        "stage": "collect-room-core"
      }
    }
  }
  ```

  #### 2. Khi đã đủ thông tin (sẵn sàng tạo phòng)

  **Status**: `200 OK`

  ```typescript
  {
    success: true,
    data: {
      kind: 'CONTROL',
      sessionId: string,
      timestamp: string,
      message: string,  // Thông báo xác nhận từ AI
      payload: {
        mode: 'ROOM_PUBLISH',
        plan: {
          shouldCreateBuilding: boolean,  // true nếu cần tạo building mới
          buildingId?: string,            // ID building nếu dùng building có sẵn
          buildingPayload?: CreateBuildingDto,  // Payload để tạo building (nếu shouldCreateBuilding = true)
          roomPayload: CreateRoomDto,     // Payload để tạo room
          description: string             // Mô tả về execution plan
        }
      },
      meta: {
        stage: 'finalize-room',
        planReady: true,
        shouldCreateBuilding: boolean
      }
    }
  }
  ```

  **Ví dụ Response**:

  ```json
  {
    "success": true,
    "data": {
      "kind": "CONTROL",
      "sessionId": "user_02a927ba-c5e4-40e3-a64c-0187c9b35e33",
      "timestamp": "2025-11-22T15:20:00.000Z",
      "message": "Kiểm tra lại thông tin, mình sẽ gửi sang hệ thống để tạo phòng ngay. Có cần mình rà soát lại trước khi gửi đi không?",
      "payload": {
        "mode": "ROOM_PUBLISH",
        "plan": {
          "shouldCreateBuilding": true,
          "buildingPayload": {
            "name": "Kahn",
            "addressLine1": "123 Đường ABC",
            "districtId": 1,
            "provinceId": 1,
            "wardId": 1,
            "country": "Vietnam"
          },
          "roomPayload": {
            "name": "Phòng trọ Kahn",
            "description": "Phòng trọ 2 triệu tại Gò Vấp Hồ Chí Minh. Điện 3k/số, nước 5k/người. Giá hợp lý, tiện nghi.",
            "roomType": "boarding_house",
            "totalRooms": 1,
            "pricing": {
              "basePriceMonthly": 2000000,
              "depositAmount": 1000000
            },
            "costs": [
              {
                "systemCostTypeId": "electricity_cost_id",
                "value": 3000,
                "costType": "ELECTRICITY",
                "unit": "per_kwh",
                "billingCycle": "MONTHLY"
              },
              {
                "systemCostTypeId": "water_cost_id",
                "value": 5000,
                "costType": "WATER",
                "unit": "per_person",
                "billingCycle": "MONTHLY"
              }
            ],
            "images": {
              "images": ["/images/photo1.jpg", "/images/photo2.jpg"]
            }
          },
          "description": "Tạo building mới 'Kahn' và room 'Phòng trọ Kahn'"
        }
      },
      "meta": {
        "stage": "finalize-room",
        "planReady": true,
        "shouldCreateBuilding": true
      }
    }
  }
  ```

  #### 3. Khi có lỗi

  **Status**: `400 Bad Request` hoặc `401 Unauthorized`

  ```typescript
  {
    success: false,
    error: string,      // Mô tả lỗi
    message: string     // Chi tiết lỗi
  }
  ```

  **Ví dụ Response**:

  ```json
  {
    "success": false,
    "error": "Authentication required",
    "message": "Bạn cần đăng nhập để đăng phòng"
  }
  ```

  ## Flow hoạt động

  ### 1. Bắt đầu đăng phòng

  **Request**:
  ```json
  {
    "message": "Đăng phòng trọ"
  }
  ```

  **Response**: AI sẽ hỏi về thông tin cần thiết (giá, vị trí)

  ### 2. Cung cấp thông tin

  **Request**:
  ```json
  {
    "message": "1 phòng 2 triệu, cọc 1 triệu, toà nhà Kahn, gò vấp hồ chí minh. Điện 3k nước 5k",
    "images": ["/images/photo1.jpg"]
  }
  ```

  **Response**: 
  - Nếu thiếu thông tin: AI sẽ hỏi lại những gì còn thiếu
  - Nếu đủ thông tin: AI sẽ trả về execution plan (`kind: 'CONTROL'`, `mode: 'ROOM_PUBLISH'`)

  ### 3. Xác nhận và tạo phòng

  Khi nhận được response với `kind: 'CONTROL'` và `mode: 'ROOM_PUBLISH'`, frontend cần:

  1. **Hiển thị thông tin xác nhận** cho user
  2. **Gọi API tạo building** (nếu `plan.shouldCreateBuilding === true`):
    - Endpoint: `POST /api/buildings`
    - Body: `plan.buildingPayload`
  3. **Gọi API tạo room**:
    - Endpoint: `POST /api/rooms`
    - Body: `plan.roomPayload` (cập nhật `buildingId` nếu cần)

  ## Lưu ý quan trọng

  ### Thông tin bắt buộc (AI sẽ hỏi nếu thiếu)
  - **Giá thuê/tháng** (`basePriceMonthly`)
  - **Building ID hoặc thông tin building**:
    - Nếu frontend truyền `buildingId` → Không cần hỏi
    - Nếu không có `buildingId` → AI sẽ hỏi về **Vị trí địa lý** (`building.location` - districtId, provinceId) và **Tên tòa nhà** (`building.name`) để tìm/select building

  ### Thông tin tự động tạo (AI không hỏi)
  - **Tên phòng** (`room.name`) - tự tạo dựa trên tên tòa nhà
  - **Loại phòng** (`room.roomType`) - mặc định `boarding_house`
  - **Số lượng phòng** (`room.totalRooms`) - mặc định `1`
  - **Mô tả** (`room.description`) - tự tạo dựa trên giá, vị trí, tiện ích

  ### Thông tin khuyến khích (không bắt buộc)
  - **Hình ảnh** (`images`) - AI sẽ gợi ý nhưng không bắt buộc
  - **Giá điện/nước** (`costs`) - Nếu user cung cấp, AI sẽ tự động parse

  ## Session Management

  - Mỗi user có một session riêng (dựa trên `userId`)
  - Session được lưu trong memory, timeout sau 30 phút không hoạt động
  - Tối đa 10 tin nhắn mỗi session (để tránh memory leak)
  - Frontend không cần quản lý session, chỉ cần gửi `message` và nhận response

  ## Ví dụ sử dụng (Frontend)

  ### TypeScript/React Example

  ```typescript
  interface RoomPublishRequest {
    message: string;
    buildingId?: string;  // Optional: ID của building nếu đã biết
    images?: string[];
  }

  interface RoomPublishResponse {
    success: boolean;
    data?: {
      kind: 'CONTENT' | 'CONTROL';
      sessionId: string;
      message: string;
      payload?: {
        mode: 'CONTENT' | 'ROOM_PUBLISH';
        plan?: {
          shouldCreateBuilding: boolean;
          buildingId?: string;
          buildingPayload?: any;
          roomPayload: any;
          description: string;
        };
      };
      meta?: {
        stage: string;
        planReady?: boolean;
        shouldCreateBuilding?: boolean;
      };
    };
    error?: string;
  }

  async function publishRoom(
    message: string, 
    buildingId?: string, 
    images?: string[]
  ): Promise<RoomPublishResponse> {
    const response = await fetch('/api/ai/room-publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // JWT token
      },
      body: JSON.stringify({ message, buildingId, images })
    });
    
    return response.json();
  }

  // Sử dụng - Không có buildingId (AI sẽ hỏi về building)
  const result = await publishRoom(
    "1 phòng 2 triệu, cọc 1 triệu, toà nhà Kahn, gò vấp hồ chí minh. Điện 3k nước 5k",
    undefined,  // buildingId
    ["/images/photo1.jpg"]
  );

  // Sử dụng - Có buildingId (bỏ qua bước tìm/select building)
  const resultWithBuilding = await publishRoom(
    "1 phòng 2 triệu, cọc 1 triệu. Điện 3k nước 5k",
    "02a927ba-c5e4-40e3-a64c-0187c9b35e33",  // buildingId
    ["/images/photo1.jpg"]
  );

  if (result.success && result.data?.kind === 'CONTROL' && result.data.payload?.mode === 'ROOM_PUBLISH') {
    const plan = result.data.payload.plan;
    
    // Tạo building nếu cần
    let buildingId = plan.buildingId;
    if (plan.shouldCreateBuilding && plan.buildingPayload) {
      const buildingResponse = await fetch('/api/buildings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(plan.buildingPayload)
      });
      const building = await buildingResponse.json();
      buildingId = building.id;
    }
    
    // Tạo room
    const roomPayload = {
      ...plan.roomPayload,
      buildingId: buildingId || plan.buildingId
    };
    
    const roomResponse = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(roomPayload)
    });
    
    const room = await roomResponse.json();
    console.log('Room created:', room);
  }
  ```

  ## Error Handling

  ### Authentication Error (401)
  ```json
  {
    "success": false,
    "error": "Authentication required",
    "message": "Bạn cần đăng nhập để đăng phòng"
  }
  ```

  ### Validation Error (400)
  ```json
  {
    "success": false,
    "error": "Failed to process room publishing",
    "message": "Invalid request format"
  }
  ```

  ### Server Error (500)
  ```json
  {
    "success": false,
    "error": "Failed to process room publishing",
    "message": "Internal server error"
  }
  ```

  ## Best Practices

  1. **Luôn kiểm tra `success` field** trước khi xử lý response
  2. **Kiểm tra `kind` và `mode`** để biết response type:
    - `kind: 'CONTENT'` → Đang hỏi thông tin, hiển thị message cho user
    - `kind: 'CONTROL'` + `mode: 'ROOM_PUBLISH'` → Đã đủ thông tin, hiển thị xác nhận và tạo phòng
  3. **Xử lý `plan.shouldCreateBuilding`** để quyết định có cần tạo building không
  4. **Cập nhật `buildingId`** trong `roomPayload` trước khi gọi API tạo room
  5. **Hiển thị loading state** khi đang xử lý
  6. **Xử lý lỗi** một cách graceful, hiển thị thông báo thân thiện cho user

