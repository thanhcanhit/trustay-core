# 🗺️ Trustay Development Roadmap

## 📋 Tổng quan
Roadmap phát triển hệ thống Trustay theo thứ tự ưu tiên, tập trung vào các hành động thuê, đặt, mời của tenant và landlord.

---

## 🎯 Phase 1: Core Booking System (Sprint 1-2)
**Mục tiêu**: Xây dựng hệ thống booking cơ bản cho tenant và landlord

### Milestone 1.1: Booking Request System
**Thời gian**: 1 sprint (2 tuần)

#### Backend Tasks:
- [ ] **Booking Request Module**
  - [ ] Create `booking-requests` module structure
  - [ ] Design BookingRequest DTOs (Create, Update, Query, Response)
  - [ ] Implement BookingRequestService với methods:
    - `createBookingRequest()`
    - `getBookingRequests()` (for landlords)
    - `getMyBookingRequests()` (for tenants)
    - `approveBookingRequest()`
    - `rejectBookingRequest()`
    - `cancelBookingRequest()`
  - [ ] Create BookingRequestController với endpoints
  - [ ] Integrate notification system cho booking events

#### Database Schema Updates:
```sql
-- Already exists in Prisma schema
model BookingRequest {
  id              String           @id @default(uuid())
  tenantId        String
  roomInstanceId  String
  requestDate     DateTime         @default(now())
  checkInDate     DateTime
  checkOutDate    DateTime?
  messageToOwner  String?
  ownerNotes      String?
  status          BookingStatus    @default(pending)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

#### Frontend Integration Points:
- [ ] API endpoints for booking requests
- [ ] Real-time notifications for booking status changes
- [ ] Booking request forms and management UI

### Milestone 1.2: Room Invitation System  
**Thời gian**: 1 sprint (2 tuần)

#### Backend Tasks:
- [ ] **Room Invitation Module**
  - [ ] Create `room-invitations` module
  - [ ] Design RoomInvitation DTOs
  - [ ] Implement RoomInvitationService:
    - `createInvitation()` (landlord to tenant)
    - `getReceivedInvitations()` (tenant)
    - `getSentInvitations()` (landlord)
    - `acceptInvitation()`
    - `declineInvitation()`
    - `expireInvitations()` (scheduled job)
  - [ ] Integrate với notification system
  - [ ] Add invitation expiry logic

#### Notification Integration:
- [ ] `notifyRoomInvitation()` - khi landlord gửi invitation
- [ ] `notifyInvitationAccepted()` - khi tenant chấp nhận
- [ ] `notifyInvitationDeclined()` - khi tenant từ chối
- [ ] Bulk expiry notifications

---

## 🏠 Phase 2: Rental Management System (Sprint 3-4)
**Mục tiêu**: Xây dựng hệ thống quản lý hợp đồng thuê

### Milestone 2.1: Rental Contract Management
**Thời gian**: 1.5 sprints (3 tuần)

#### Backend Tasks:
- [ ] **Rental Module**
  - [ ] Create `rentals` module structure
  - [ ] Design Rental DTOs (Create, Update, Status)
  - [ ] Implement RentalService:
    - `createRental()` (from approved booking/invitation)
    - `getMyRentals()` (tenant view)
    - `getMyRentalsAsOwner()` (landlord view)
    - `updateRentalStatus()`
    - `terminateRental()`
    - `renewRental()`
    - `getRentalDetails()`
  - [ ] Auto-creation từ approved bookings
  - [ ] Rental status management workflow

#### Business Logic:
```typescript
// Rental Creation Flow
BookingRequest (approved) -> Rental (active)
RoomInvitation (accepted) -> Rental (active)

// Status Transitions
pending -> active -> terminated/expired
active -> pending_renewal -> active
```

#### Notifications Integration:
- [ ] `notifyRentalCreated()` - hợp đồng được tạo
- [ ] `notifyRentalStatusUpdated()` - thay đổi trạng thái
- [ ] `notifyRentalTerminated()` - chấm dứt hợp đồng
- [ ] `notifyRentalExpiring()` - sắp hết hạn (30 ngày trước)

### Milestone 2.2: Payment & Billing Foundation
**Thời gian**: 1 sprint (2 tuần)

#### Backend Tasks:
- [ ] **Billing Module** (Basic)
  - [ ] Create `billing` module
  - [ ] Design MonthlyBill DTOs
  - [ ] Implement BillingService:
    - `createMonthlyBill()`
    - `getBills()` (tenant/landlord views)
    - `updateBillStatus()`
    - `generateBillItems()`
  - [ ] Monthly bill generation logic
  - [ ] Integration với RentalService

- [ ] **Payment Module** (Basic)
  - [ ] Create `payments` module  
  - [ ] Design Payment DTOs
  - [ ] Basic PaymentService:
    - `createPaymentRecord()`
    - `getPaymentHistory()`
    - `updatePaymentStatus()`
  - [ ] Payment status tracking

#### Notifications Integration:
- [ ] `notifyMonthlyBill()` - hóa đơn mới
- [ ] `notifyPaymentReceived()` - đã nhận thanh toán
- [ ] `notifyPaymentReminder()` - nhắc nhở (7 ngày trước hạn)
- [ ] `notifyPaymentOverdue()` - quá hạn

---

## 🔄 Phase 3: Advanced Features & Integration (Sprint 5-6)

### Milestone 3.1: Room Status Management
**Thời gian**: 0.5 sprint (1 tuần)

#### Backend Tasks:
- [ ] **Room Status System**
  - [ ] Update RoomsService với status management:
    - `updateRoomStatus()` (available, occupied, maintenance, reserved)
    - `bulkUpdateRoomStatus()`
    - `getRoomStatusHistory()`
  - [ ] Auto status updates based on rentals
  - [ ] Status validation rules

#### Integration Points:
- [ ] Auto-update room status khi rental active/terminated
- [ ] Notification cho status changes
- [ ] Dashboard integration

### Milestone 3.2: Review System  
**Thời gian**: 1 sprint (2 tuần)

#### Backend Tasks:
- [ ] **Review Module**
  - [ ] Create `reviews` module
  - [ ] Design Review DTOs (bidirectional reviews)
  - [ ] Implement ReviewService:
    - `createReview()` (tenant to landlord, landlord to tenant)
    - `getMyReviews()` 
    - `getReceivedReviews()`
    - `calculateRatings()`
  - [ ] Review eligibility logic (after rental completion)
  - [ ] Rating aggregation system

### Milestone 3.3: Enhanced Search & Matching
**Thời gian**: 1 sprint (2 tuần)

#### Backend Tasks:
- [ ] **Smart Matching System**
  - [ ] Enhance RoomSeekingPostService
  - [ ] Room recommendation algorithm
  - [ ] Auto-notification for matching rooms
  - [ ] Saved searches functionality

---

## 🚀 Phase 4: System Polish & Advanced Features (Sprint 7-8)

### Milestone 4.1: Advanced Payment Integration
- [ ] Payment gateway integration (VNPay, Momo, etc.)
- [ ] Automatic payment processing
- [ ] Payment reminder system
- [ ] Refund management

### Milestone 4.2: Analytics & Reporting
- [ ] Landlord dashboard với analytics
- [ ] Tenant activity tracking
- [ ] Revenue reports
- [ ] Occupancy analytics

### Milestone 4.3: Communication System
- [ ] In-app messaging
- [ ] Notification preferences
- [ ] Email/SMS integration
- [ ] Chat system

---

## 📊 Implementation Priority Matrix

### 🔴 Critical (Phase 1)
1. **Booking Request System** - Core tenant action
2. **Room Invitation System** - Core landlord action
3. **Basic Notification System** - Already implemented ✅

### 🟡 High Priority (Phase 2)  
1. **Rental Management** - Contract lifecycle
2. **Basic Billing** - Financial tracking
3. **Payment Tracking** - Money flow

### 🟢 Medium Priority (Phase 3)
1. **Room Status Management** - Operational efficiency
2. **Review System** - Trust & quality
3. **Advanced Search** - User experience

### 🔵 Nice to Have (Phase 4)
1. **Advanced Payments** - Business scaling
2. **Analytics** - Business intelligence
3. **Communication** - User engagement

---

## 🛠️ Technical Implementation Strategy

### Database First Approach
1. ✅ Prisma schema đã có sẵn - leverage existing structure
2. Focus on business logic implementation
3. Add indexes và optimizations sau

### Service Layer Pattern
```typescript
// Core Services cần implement
- BookingRequestService
- RoomInvitationService  
- RentalService
- BillingService (basic)
- PaymentService (basic)
```

### Notification Integration
- ✅ NotificationService đã implemented với all templates
- Integrate notifications vào từng business action
- Real-time updates through WebSocket (future)

### API Design Principles
- RESTful endpoints theo chuẩn
- Consistent response format
- Proper HTTP status codes  
- Swagger documentation
- Input validation với DTOs

---

## 📈 Success Metrics

### Phase 1 KPIs
- [ ] Booking request flow hoạt động end-to-end
- [ ] Invitation system functional
- [ ] 100% API coverage với tests
- [ ] All notifications working

### Phase 2 KPIs  
- [ ] Rental lifecycle management complete
- [ ] Basic billing system operational
- [ ] Payment tracking accurate
- [ ] Data consistency maintained

### Overall Success
- [ ] Tenant có thể book rooms successfully
- [ ] Landlord có thể manage bookings & rentals
- [ ] Notification system keeps all parties informed
- [ ] System scalable và maintainable

---

## 🔄 Next Immediate Steps

### Week 1-2: Booking System
1. **Day 1-2**: Create booking-requests module structure
2. **Day 3-5**: Implement BookingRequestService methods
3. **Day 6-8**: Create API endpoints và controllers  
4. **Day 9-10**: Integration testing và notification hooks

### Week 3-4: Invitation System
1. **Day 1-2**: Create room-invitations module
2. **Day 3-5**: Implement invitation logic và expiry
3. **Day 6-8**: API endpoints và business rules
4. **Day 9-10**: End-to-end testing

**Recommendation**: Bắt đầu với BookingRequestModule vì đây là action phổ biến nhất của tenant.