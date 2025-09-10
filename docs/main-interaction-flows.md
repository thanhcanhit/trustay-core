# Main Tenant-Landlord Interaction Flows

## 1. Complete System Flow với Auto Contract Generation

```mermaid
flowchart TD
    A[Tenant] --> B{Tìm phòng}
    B -->|Có phòng| C[Gửi Booking Request]
    B -->|Không có| D[Tạo Room Seeking Post]
    
    C --> E[Landlord Review]
    E -->|Approve| F[Tự động tạo Rental + Contract]
    E -->|Reject| G[Thông báo từ chối]
    
    D --> H[Landlord xem Post]
    H --> I[Gửi Room Invitation]
    I --> J[Tenant Review]
    J -->|Accept| K[Tự động tạo Rental + Contract]
    J -->|Decline| L[Thông báo từ chối]
    
    F --> M[Rental + Contract Active]
    K --> M
    M --> N[Quản lý Contract]
    
    style F fill:#90EE90
    style K fill:#90EE90
    style M fill:#87CEEB
```

## 2. Booking Request Flow

```mermaid
sequenceDiagram
    participant T as Tenant
    participant L as Landlord
    participant S as System
    
    T->>S: Gửi Booking Request
    S->>L: Thông báo có request mới
    L->>S: Approve Request
    S->>S: Tự động tạo Rental
    S->>S: Tự động tạo Contract
    S->>T: Thông báo thành công + Contract
    S->>L: Thông báo thành công + Contract
```

## 3. Room Invitation Flow

```mermaid
sequenceDiagram
    participant L as Landlord  
    participant T as Tenant
    participant S as System
    
    L->>S: Gửi Room Invitation
    S->>T: Thông báo có invitation
    T->>S: Accept Invitation
    S->>S: Tự động tạo Rental
    S->>S: Tự động tạo Contract
    S->>L: Thông báo thành công + Contract
    S->>T: Thông báo thành công + Contract
```

## 4. Room Seeking Post Flow

```mermaid
flowchart LR
    A[Tenant tạo Seeking Post] --> B[Post đăng công khai]
    B --> C[Landlord xem Post]
    C --> D[Landlord gửi Invitation]
    D --> E[Tenant Accept]
    E --> F[Tự động đóng Post]
    F --> G[Tạo Rental + Contract]
    
    style G fill:#90EE90
```

## 5. Contract Auto-Generation Process

```mermaid
flowchart TD
    A[Booking Approved / Invitation Accepted] --> B[Tạo Rental]
    B --> C[Tự động trigger Contract Generation]
    C --> D[Tạo Contract Number]
    D --> E[Lấy dữ liệu từ Rental]
    E --> F[Tạo nội dung Contract tiếng Việt]
    F --> G[Gửi thông báo]
    G --> H[Contract sẵn sàng sử dụng]
    
    C --> I{Lỗi?}
    I -->|Có| J[Log error - Rental vẫn tạo]
    I -->|Không| D
    
    style H fill:#90EE90
    style J fill:#FFB347
```

## 6. Key Integration Points

- **BookingRequestsService**: Line 307-332 - Auto-create rental + contract khi approve
- **RoomInvitationsService**: Line 375-395 - Auto-create rental + contract khi accept  
- **RentalsService**: Line 191-197 - Auto-create contract khi tạo rental
- **ContractsService**: autoCreateContractFromRental() - Core contract generation logic

## 7. Error Handling Strategy

- Tất cả auto-generation đều có try-catch
- Không làm fail main flow nếu contract generation lỗi
- Log errors để debug
- Graceful degradation: Rental vẫn tạo được ngay cả khi contract fail