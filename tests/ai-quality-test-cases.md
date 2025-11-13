# Bộ Test Chất Lượng Trustay-AI
## 20 Test Cases để Đánh Giá Hệ Thống

---

## Nhóm 1: Truy vấn đơn giản, ngữ cảnh ngầm (7 cases)

### TC-001: Tìm phòng cơ bản
**Câu hỏi:** "Tìm phòng trọ ở Gò Vấp"
**Ngữ cảnh ngầm:** User đang ở trang chủ, chưa đăng nhập
**Kỳ vọng:** 
- SQL query đúng: SELECT từ rooms JOIN buildings JOIN districts WHERE district_name LIKE '%Gò Vấp%'
- Trả về danh sách phòng ở Gò Vấp
- Mode: LIST

### TC-002: Tìm phòng với giá
**Câu hỏi:** "Có phòng nào dưới 5 triệu không?"
**Ngữ cảnh ngầm:** User đang xem danh sách phòng
**Kỳ vọng:**
- SQL query: JOIN room_pricing WHERE base_price_monthly < 5000000
- Filter đúng giá
- Mode: LIST

### TC-003: Tìm phòng với tiện ích
**Câu hỏi:** "Phòng nào có máy lạnh và wifi?"
**Ngữ cảnh ngầm:** User đang tìm kiếm phòng
**Kỳ vọng:**
- SQL query: JOIN room_amenities JOIN amenities WHERE amenities.name IN ('máy lạnh', 'wifi')
- Filter đúng tiện ích
- Mode: LIST

### TC-004: Hóa đơn của tôi (Tenant)
**Câu hỏi:** "Hóa đơn tháng này của tôi"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=tenant
**Kỳ vọng:**
- SQL query: JOIN bills JOIN rentals WHERE rentals.tenant_id = userId AND billing_period = current_month
- Chỉ lấy hóa đơn của user hiện tại
- Mode: TABLE

### TC-005: Phòng của tôi (Landlord)
**Câu hỏi:** "Danh sách phòng của tôi"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=landlord
**Kỳ vọng:**
- SQL query: JOIN rooms JOIN buildings WHERE buildings.owner_id = userId
- Chỉ lấy phòng của landlord hiện tại
- Mode: LIST

### TC-006: Thống kê doanh thu (Landlord)
**Câu hỏi:** "Doanh thu 6 tháng qua"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=landlord
**Kỳ vọng:**
- SQL query: JOIN payments JOIN rentals WHERE rentals.owner_id = userId AND payment_date >= 6_months_ago
- GROUP BY month, SUM amount
- Mode: CHART hoặc TABLE

### TC-007: Tỷ lệ lấp đầy (Landlord)
**Câu hỏi:** "Tỷ lệ lấp đầy phòng của tôi"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=landlord
**Kỳ vọng:**
- SQL query: JOIN room_instances JOIN rooms JOIN buildings WHERE buildings.owner_id = userId
- Tính: COUNT(occupied) / COUNT(total) * 100
- Mode: TABLE hoặc CHART

---

## Nhóm 2: Logic nghiệp vụ, chuỗi JOIN phức tạp (4 cases)

### TC-008: Phòng đang có hợp đồng sắp hết hạn
**Câu hỏi:** "Phòng nào có hợp đồng sắp hết hạn trong 30 ngày tới?"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=landlord
**Kỳ vọng:**
- SQL query phức tạp: 
  - JOIN rentals JOIN room_instances JOIN rooms JOIN buildings
  - WHERE rentals.owner_id = userId 
  - AND rentals.contract_end_date BETWEEN NOW() AND NOW() + 30 days
  - AND rentals.status = 'active'
- JOIN đúng chuỗi quan hệ
- Mode: LIST hoặc TABLE

### TC-009: Hóa đơn chưa thanh toán của tenant
**Câu hỏi:** "Tôi còn bao nhiêu hóa đơn chưa thanh toán?"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=tenant
**Kỳ vọng:**
- SQL query phức tạp:
  - JOIN bills JOIN rentals 
  - LEFT JOIN payments ON payments.bill_id = bills.id
  - WHERE rentals.tenant_id = userId 
  - AND bills.status IN ('pending', 'overdue')
  - AND payments.id IS NULL
- Logic LEFT JOIN để tìm hóa đơn chưa có payment
- Mode: TABLE

### TC-010: Thống kê phòng theo trạng thái và quận
**Câu hỏi:** "Thống kê số lượng phòng theo trạng thái ở từng quận của tôi"
**Ngữ cảnh ngầm:** User đã đăng nhập với role=landlord
**Kỳ vọng:**
- SQL query phức tạp:
  - JOIN room_instances JOIN rooms JOIN buildings JOIN districts
  - WHERE buildings.owner_id = userId
  - GROUP BY districts.name, room_instances.status
  - COUNT(*) AS count
- GROUP BY nhiều cột
- Mode: TABLE hoặc CHART

### TC-011: Tìm phòng có đầy đủ tiện ích và giá hợp lý
**Câu hỏi:** "Tìm phòng có gác lửng, ban công, máy lạnh, wifi, tủ lạnh, máy giặt ở Bình Thạnh dưới 6 triệu"
**Ngữ cảnh ngầm:** User chưa đăng nhập (guest)
**Kỳ vọng:**
- SQL query phức tạp:
  - JOIN rooms JOIN buildings JOIN districts JOIN room_pricing
  - JOIN room_amenities JOIN amenities (nhiều lần cho mỗi tiện ích)
  - WHERE district_name LIKE '%Bình Thạnh%'
  - AND base_price_monthly < 6000000
  - AND amenities.name IN ('gác lửng', 'ban công', 'máy lạnh', 'wifi', 'tủ lạnh', 'máy giặt')
  - GROUP BY rooms.id HAVING COUNT(DISTINCT amenities.id) = 6
- JOIN nhiều bảng với điều kiện phức tạp
- Mode: LIST

---

## Nhóm 3: Nhập nhằng, ngữ nghĩa domain (RAG) (5 cases)

### TC-012: "Phòng trọ" vs "Studio" vs "Chung cư mini"
**Câu hỏi:** "Tìm studio ở Quận 1"
**Ngữ cảnh ngầm:** User chưa đăng nhập
**Kỳ vọng:**
- RAG phải hiểu: studio = room_type = 'apartment' hoặc room_type = 'studio'
- SQL query: WHERE room_type IN ('apartment', 'studio')
- Không nhầm với "phòng trọ" (boarding_house)
- Mode: LIST

### TC-013: "Gần trường" - cần RAG để hiểu địa điểm
**Câu hỏi:** "Tìm phòng gần HUTECH"
**Ngữ cảnh ngầm:** User chưa đăng nhập
**Kỳ vọng:**
- RAG phải biết HUTECH ở quận/huyện nào (Gò Vấp hoặc Bình Thạnh)
- SQL query: WHERE district_name IN ('Gò Vấp', 'Bình Thạnh') hoặc dùng geolocation nếu có
- Hiểu được "gần" = cùng quận hoặc quận lân cận
- Mode: LIST

### TC-014: "Đầy đủ nội thất" - domain knowledge
**Câu hỏi:** "Phòng nào có đầy đủ nội thất?"
**Ngữ cảnh ngầm:** User chưa đăng nhập
**Kỳ vọng:**
- RAG phải hiểu "đầy đủ nội thất" = có nhiều tiện ích: máy lạnh, tủ lạnh, máy giặt, wifi, máy nước nóng, gác lửng (tùy chọn)
- SQL query: JOIN room_amenities JOIN amenities WHERE COUNT(amenities) >= 5-6
- GROUP BY rooms.id HAVING COUNT(DISTINCT amenities.id) >= 5
- Mode: LIST

### TC-015: "Phòng hiện tại" - context từ currentPage
**Câu hỏi:** "Đánh giá phòng hiện tại"
**Ngữ cảnh ngầm:** User đang xem trang /rooms/tuyenquan-go-vap-phong-ap1443
**Kỳ vọng:**
- Orchestrator phải detect currentPageContext: entity=room, identifier=tuyenquan-go-vap-phong-ap1443
- SQL query: WHERE rooms.slug = 'tuyenquan-go-vap-phong-ap1443'
- MODE_HINT=INSIGHT
- Phân tích chi tiết với số liệu cụ thể
- Mode: INSIGHT

### TC-016: "Giá hợp lý" - cần so sánh với thị trường
**Câu hỏi:** "Giá phòng hiện tại có hợp lý không?"
**Ngữ cảnh ngầm:** User đang xem trang /rooms/uuid-123
**Kỳ vọng:**
- SQL query: WHERE rooms.id = 'uuid-123' với đầy đủ thông tin: giá, diện tích, tiện ích, quận
- Response Generator phải:
  - Tính giá/m² = giá_thuê / diện_tích
  - So sánh với thị trường khu vực (từ RAG business context)
  - Đánh giá hợp lý với số liệu cụ thể
- Mode: INSIGHT

---

## Nhóm 4: Robustness (từ đồng nghĩa, typo) (4 cases)

### TC-017: Từ đồng nghĩa - "ký túc xá" vs "dormitory"
**Câu hỏi:** "Tìm ký túc xá ở Gò Vấp"
**Ngữ cảnh ngầm:** User chưa đăng nhập
**Kỳ vọng:**
- RAG/SQL phải map: "ký túc xá" = room_type = 'dormitory'
- SQL query: WHERE room_type = 'dormitory' AND district_name LIKE '%Gò Vấp%'
- Không fail vì từ khác
- Mode: LIST

### TC-018: Typo - lỗi chính tả nhẹ
**Câu hỏi:** "Tìm phòng trọ ở Gò Vấp có máy lạnh"
**Ngữ cảnh ngầm:** User chưa đăng nhập
**Lưu ý:** Câu hỏi có thể có typo nhẹ như "Gò Vấp" → "Gò Vấp" (đúng) hoặc "Gò Vấp" → "Gò Vấp" (typo)
**Kỳ vọng:**
- SQL query: WHERE district_name LIKE '%Gò Vấp%' (dùng LIKE để tolerant với typo)
- Hoặc dùng fuzzy matching nếu có
- Vẫn trả về kết quả đúng
- Mode: LIST

### TC-019: Viết tắt và từ lóng
**Câu hỏi:** "Tìm phòng ở Q1 có đầy đủ đồ"
**Ngữ cảnh ngầm:** User chưa đăng nhập
**Kỳ vọng:**
- RAG/SQL phải hiểu:
  - "Q1" = "Quận 1"
  - "đầy đủ đồ" = "đầy đủ nội thất" = nhiều tiện ích
- SQL query: WHERE district_name LIKE '%Quận 1%' AND COUNT(amenities) >= 5
- Mode: LIST

### TC-020: Câu hỏi không rõ ràng nhưng có thể suy luận
**Câu hỏi:** "Phòng nào rẻ nhất?"
**Ngữ cảnh ngầm:** User đang xem danh sách phòng ở Gò Vấp
**Kỳ vọng:**
- SQL query: JOIN room_pricing ORDER BY base_price_monthly ASC LIMIT 1
- Hoặc nếu có context về quận: WHERE district_name LIKE '%Gò Vấp%' ORDER BY base_price_monthly ASC LIMIT 1
- Trả về phòng có giá thấp nhất
- Mode: LIST hoặc TABLE

---

## Checklist Đánh Giá

Mỗi test case cần đánh giá:

- [ ] **SQL Query đúng:** Query được generate có đúng logic không?
- [ ] **JOIN đúng:** Các bảng được JOIN đúng quan hệ không?
- [ ] **Filter đúng:** WHERE clauses đúng với yêu cầu không?
- [ ] **Security:** User chỉ truy cập được dữ liệu của mình (nếu có userId)?
- [ ] **Mode đúng:** Response mode (LIST/TABLE/CHART/INSIGHT) phù hợp không?
- [ ] **Kết quả hợp lý:** Kết quả trả về có đúng với câu hỏi không?
- [ ] **RAG hiểu đúng:** Domain knowledge được hiểu đúng không?
- [ ] **Robustness:** Có xử lý được typo/từ đồng nghĩa không?

---

## Scoring

- **Nhóm 1 (TC-001 đến TC-007):** Mỗi case 1 điểm, tổng 7 điểm
- **Nhóm 2 (TC-008 đến TC-011):** Mỗi case 2 điểm, tổng 8 điểm
- **Nhóm 3 (TC-012 đến TC-016):** Mỗi case 2 điểm, tổng 10 điểm
- **Nhóm 4 (TC-017 đến TC-020):** Mỗi case 1.25 điểm, tổng 5 điểm

**Tổng điểm tối đa: 30 điểm**

**Thang đánh giá:**
- 90-100% (27-30 điểm): Excellent
- 80-89% (24-26 điểm): Good
- 70-79% (21-23 điểm): Acceptable
- <70% (<21 điểm): Needs Improvement

