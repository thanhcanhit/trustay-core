/**
 * Business narrative document (Vietnamese)
 */
export const businessDocument: string = `

1. Giới thiệu và động lực
1.1 Lý do chọn đề tài
Trong bối cảnh đô thị hóa nhanh, nhu cầu thuê trọ tăng mạnh tại Việt Nam. Tuy nhiên hoạt động tìm kiếm và quản lý còn rời rạc, thiếu xác thực, tốn thời gian. Sự phát triển của AI mở ra cơ hội số hóa toàn bộ quy trình thuê trọ (tìm kiếm, liên hệ, ký hợp đồng, thanh toán).
1.2 Mục tiêu
- Xây dựng nền tảng quản lý và tìm kiếm phòng trọ thông minh (Trustay).
- Tối ưu tìm kiếm bằng AI Text2SQL và Elasticsearch.
- Số hóa quy trình: yêu cầu thuê, hợp đồng điện tử, hoá đơn và thanh toán.
1.3 Phạm vi
- Người dùng: Chủ trọ, Người thuê, Khách (chưa đăng nhập).
- Nghiệp vụ: tìm kiếm, lời mời/yêu cầu thuê, hợp đồng, hoá đơn-thanh toán, nhắn tin.
- Kỹ thuật: Next.js (FE), NestJS (BE), PostgreSQL, Prisma, Redis, Elasticsearch, Zalo Mini App.

2. Bối cảnh và nghiên cứu liên quan
- Một số nền tảng hiện có (Phongtro123, Chotot Nhà trọ) tập trung đăng tin, thiếu AI hỗ trợ quản lý và chưa tích hợp hợp đồng điện tử/TT trực tuyến.
- Trustay kế thừa ưu điểm, thêm AI Text2SQL + Elasticsearch để cải thiện độ chính xác và tốc độ.

3. Chức năng hệ thống
3.1 Chức năng chung
- Đăng ký/Đăng nhập/Đăng xuất, đổi mật khẩu
- Quản lý thông tin cá nhân
- Tìm kiếm & xem phòng trọ
3.2 Chức năng cho Chủ trọ
- Quản lý tòa nhà, phòng trọ, trạng thái phòng
- Duyệt/Từ chối yêu cầu thuê; Gửi lời mời thuê trọ
- Quản lý hợp đồng điện tử
- Quản lý hoá đơn (tạo, gửi, xác nhận thanh toán)
- Đăng/Quản lý tin cho thuê; Nhắn tin với người thuê
3.3 Chức năng cho Người thuê
- Tìm kiếm và xem chi tiết phòng
- Gửi yêu cầu thuê; Ký hợp đồng điện tử
- Quản lý chỗ thuê; Xem hoá đơn và lịch sử thanh toán
- Đăng tin tìm trọ/tìm người ở ghép; Nhắn tin với chủ trọ

4. Tác nhân hệ thống
4.1 Danh sách tác nhân
- Người thuê (Tenant): tìm phòng, gửi yêu cầu/ở ghép, quản lý cá nhân, thanh toán, tra cứu hoá đơn
- Chủ trọ (Landlord): quản lý dãy/phòng, hợp đồng, hoá đơn, lời mời thuê, thống kê

5. Use Case chính
- UC001: Đăng nhập (Người thuê, Chủ trọ)
- UC002: Thêm dãy trọ (Chủ trọ)
- UC003: Thêm phòng trọ (Chủ trọ)
- UC004: Tạo hợp đồng thuê trọ (Chủ trọ)
- UC005: Ký hợp đồng thuê trọ (Chủ trọ, Người thuê)
- UC006: Tạo hoá đơn thuê trọ (Chủ trọ)
- UC007: Gửi yêu cầu thuê trọ (Người thuê)
- UC008: Gửi yêu cầu ở ghép (Người thuê)
- UC009: Gửi lời mời thuê trọ (Chủ trọ)
- UC010: Nhắn tin (Chủ trọ, Người thuê)
- UC011: Tìm kiếm & xem thông tin phòng (Chủ trọ, Người thuê)
- UC012: Đăng tin tìm trọ (Người thuê)
- UC013: Đăng tin tìm người ở ghép (Người thuê)
- UC014: Xử lý yêu cầu thuê trọ (Chủ trọ)
- UC015: Xử lý yêu cầu ở ghép (Người thuê)
- UC016: Xử lý lời mời thuê trọ (Người thuê)

6. Ghi chú triển khai
- AI Text2SQL hỗ trợ truy vấn tiếng Việt tự nhiên (ví dụ: “Phòng chưa thanh toán tháng này”).
- Zalo Mini App tăng khả năng tiếp cận cho sinh viên/người lao động.
- Ưu tiên bảo mật, xác thực, phân quyền; tối ưu hiệu năng truy vấn.

7. Luồng nghiệp vụ chính (bám sát schema.prisma)
7.1 Đăng tài sản và đăng tin cho thuê (Chủ trọ)
- Chủ trọ tạo Building (toà nhà) và các Room (loại/phân hạng phòng)
- Chủ trọ tạo RoomInstance (phòng cụ thể: 101, 102) nếu cho thuê theo phòng đơn lẻ
- Chủ trọ đăng tin hoặc gửi lời mời thuê (RoomInvitation) cho người thuê tiềm năng

7.2 Đăng tin tìm phòng và tìm người ở ghép (Người thuê)
- Người thuê đăng RoomSeekingPost (tìm trọ): nhu cầu, ngân sách, khu vực mong muốn
- Người thuê đăng RoommateSeekingPost (tìm người ở ghép): mức giá, số slot cần, yêu cầu roommate

7.3 Yêu cầu/Phản hồi giữa hai phía (song phương)
- RoomBooking (Người thuê → Chủ trọ): yêu cầu thuê phòng (Room) hoặc RoomInstance
- RoomInvitation (Chủ trọ → Người thuê): lời mời thuê một Room/RoomInstance cụ thể
- RoommateApplication (Tenant ↔ Tenant): ứng tuyển ở ghép vào một RoommateSeekingPost

7.4 Chuyển hoá yêu cầu thành hợp đồng và chỗ thuê
- Khi RoomBooking được landlord chấp nhận hoặc RoomInvitation được tenant chấp nhận:
  → Tạo Rental (ràng buộc tenant ↔ owner ↔ room_instance)
  → (Tùy chọn) Tạo Contract (hợp đồng điện tử) gắn với Rental

7.5 Lập hoá đơn và thanh toán định kỳ
- Hệ thống tạo Bill theo kỳ (billing_month/year, period_start/end)
- BillItem tổng hợp các chi phí (tiền phòng, điện nước, dịch vụ, …) từ RoomCost/RoomPricing
- Người thuê thực hiện Payment (khoản thanh toán) cho Bill/Rental

7.6 Quan hệ dữ liệu then chốt
- Building.ownerId → User.id
- Room.buildingId → Building.id; RoomInstance.roomId → Room.id
- RoomBooking.roomId → Room.id; RoomInvitation.roomId → Room.id
- Rental.roomInstanceId → RoomInstance.id; Rental.tenantId/ownerId → User.id
- Bill.rentalId → Rental.id; Payment.rentalId → Rental.id; Payment.billId → Bill.id

`;
