# Checklist: Decimal to Number Conversion trong src/api

## ✅ Đã hoàn thành

### Services đã cập nhật
- [x] `bills/bills.service.ts` - 30+ chỗ dùng `convertDecimalToNumber()`
- [x] `payments/payments.service.ts` - 4 chỗ
- [x] `rooms/rooms.service.ts` - 10+ chỗ
- [x] `users/users.service.ts` - 2 chỗ (overallRating)
- [x] `buildings/buildings.service.ts` - 2 chỗ (latitude, longitude)
- [x] `dashboard/dashboard.service.ts` - 6 chỗ (qua helper `toNumber()`)
- [x] `contracts/contracts-new.service.ts` - 2 chỗ
- [x] `roommate-seeking-post/roommate-seeking-post.service.ts` - 3 chỗ
- [x] `roommate-application/roommate-application.service.ts` - 1 chỗ
- [x] `tenant-preferences/tenant-preferences.service.ts` - 2 chỗ
- [x] `rentals/rentals.service.ts` - 2 chỗ
- [x] `listing/listing.service.ts` - 5 chỗ
- [x] `listing/listing-elasticsearch.helper.ts` - 5 chỗ

### Response DTOs đã cập nhật
- [x] `payments/dto/payment-response.dto.ts` - amount, monthlyRent: Decimal → number
- [x] `contracts/dto/contract-response.dto.ts` - areaSqm, monthlyRent, depositAmount, electricityRate, waterRate: Decimal → number
- [x] `bills/dto/bill-response.dto.ts` - Transform decorator đã convert monthlyRent

### Transform Decorators đã cập nhật
- [x] `rooms/dto/room-response.dto.ts` - 12 chỗ dùng `convertDecimalToNumber()`
- [x] `buildings/dto/building-response.dto.ts` - 2 chỗ dùng `convertDecimalToNumber()`
- [x] `bills/dto/bill-response.dto.ts` - 1 chỗ dùng `convertDecimalToNumber()`

## ✅ ĐÃ SỬA THÊM

### Services đã sửa thêm
- [x] `room-invitations/room-invitations.service.ts` - Line 24-25: Đã thay `.toString()` bằng `convertDecimalToNumber()`
- [x] `room-booking/room-booking.service.ts` - Line 432-433: Đã convert monthlyRent, depositAmount từ pricing
- [x] `room-seeking-post/room-seeking-post.service.ts` - Line 123-127: Đã thay `Number()` bằng `convertDecimalToNumber()`

## ⚠️ CẦN KIỂM TRA VÀ SỬA

### Services cần kiểm tra
- [ ] `landlord/landlord.service.ts` - Không có Decimal fields (OK)
- [ ] `rating/rating.service.ts` - Không có Decimal fields (OK)
- [ ] `notifications/notifications.service.ts` - Không có Decimal fields (OK)
- [ ] `chat/chat.service.ts` - Không có Decimal fields (OK)
- [ ] `room-issues/room-issues.service.ts` - Cần kiểm tra
- [ ] `reference/reference.service.ts` - Cần kiểm tra
- [ ] `provinces/**/*.service.ts` - Cần kiểm tra
- [ ] `payments/payos.service.ts` - Cần kiểm tra
- [ ] `payments/payos-webhook.service.ts` - Cần kiểm tra

### Response DTOs cần kiểm tra
- [ ] `rentals/dto/rental-response.dto.ts` - monthlyRent, depositPaid là string (OK)
- [ ] `roommate-seeking-post/dto/roommate-seeking-post-response.dto.ts` - Đã convert trong service (OK)
- [ ] `room-invitations/dto/room-invitation-response.dto.ts` - Cần kiểm tra
- [ ] `room-booking/dto/*.dto.ts` - Cần kiểm tra
- [ ] `room-seeking-post/dto/*.dto.ts` - Cần kiểm tra
- [ ] `dashboard/dto/*.dto.ts` - Cần kiểm tra
- [ ] `users/dto/*.dto.ts` - Cần kiểm tra

## 🔍 Các pattern cần tìm và thay thế

1. `Number(value)` → `convertDecimalToNumber(value)`
2. `parseFloat(value.toString())` → `convertDecimalToNumber(value)`
3. `value.toNumber()` → `convertDecimalToNumber(value)`
4. `value.toString()` cho Decimal → `convertDecimalToNumber(value)`
5. Custom helper functions → `convertDecimalToNumber()`

## 📝 Ghi chú

- Input DTOs (create/update) có thể giữ Decimal type
- Response DTOs phải là number sau khi convert trong service
- Transform decorators trong DTOs nên dùng `convertDecimalToNumber()` để đảm bảo

