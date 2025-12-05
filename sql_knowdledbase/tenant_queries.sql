-- 1) Tìm cho tôi các phòng trọ ở Quận 9 giá dưới 3 triệu.
SELECT b.name AS building_name, rm.name AS room_type_name, ri.room_number, rp.base_price_monthly
FROM rooms rm
JOIN buildings b ON b.id = rm.building_id
JOIN districts d ON d.id = b.district_id
JOIN room_pricing rp ON rp.room_id = rm.id
JOIN room_instances ri ON ri.room_id = rm.id
WHERE d.name ILIKE '%Quận 9%'
  AND rp.base_price_monthly < 3000000
  AND ri.status IN ('available', 'reserved');

-- 2) Có phòng nào dạng Sleepbox gần khu Công nghệ cao không?
SELECT b.name AS building_name, ri.room_number, rp.base_price_monthly
FROM rooms rm
JOIN buildings b ON b.id = rm.building_id
JOIN districts d ON d.id = b.district_id
JOIN room_pricing rp ON rp.room_id = rm.id
JOIN room_instances ri ON ri.room_id = rm.id
WHERE rm.room_type = 'sleepbox'
  AND (d.name ILIKE '%công nghệ cao%' OR b.address_line1 ILIKE '%công nghệ cao%' OR b.name ILIKE '%công nghệ cao%')
  AND ri.status IN ('available', 'reserved');

-- 3) Liệt kê các phòng cho phép nuôi thú cưng (Pets allowed).
SELECT b.name AS building_name, ri.room_number, rm.name AS room_name
FROM room_rules rr
JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
JOIN rooms rm ON rm.id = rr.room_id
JOIN buildings b ON b.id = rm.building_id
JOIN room_instances ri ON ri.room_id = rm.id
WHERE rrt.category = 'pets'
  AND rr.is_enforced = TRUE
  AND rrt.rule_type = 'allowed'
  AND ri.status IN ('available', 'reserved');

-- 4) Tìm phòng có máy lạnh và máy nước nóng (Amenities).
SELECT DISTINCT b.name AS building_name, ri.room_number
FROM rooms rm
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
JOIN room_amenities ra1 ON ra1.room_id = rm.id
JOIN amenities a1 ON a1.id = ra1.amenity_id
JOIN room_amenities ra2 ON ra2.room_id = rm.id
JOIN amenities a2 ON a2.id = ra2.amenity_id
WHERE a1.name ILIKE '%máy lạnh%'   -- AC
  AND a2.name ILIKE '%nước nóng%' -- water heater
  AND ri.status IN ('available', 'reserved');

-- 5) Có căn hộ chung cư mini nào còn trống ở Quận 7 không?
SELECT b.name AS building_name, ri.room_number, rp.base_price_monthly
FROM rooms rm
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
JOIN districts d ON d.id = b.district_id
JOIN room_pricing rp ON rp.room_id = rm.id
WHERE rm.room_type = 'apartment'
  AND d.name ILIKE '%Quận 7%'
  AND ri.status IN ('available', 'reserved');

-- 6) Tôi muốn tìm phòng có ban công và cửa sổ thoáng mát.
SELECT DISTINCT b.name AS building_name, ri.room_number
FROM rooms rm
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
JOIN room_amenities ra1 ON ra1.room_id = rm.id
JOIN amenities a1 ON a1.id = ra1.amenity_id
JOIN room_amenities ra2 ON ra2.room_id = rm.id
JOIN amenities a2 ON a2.id = ra2.amenity_id
WHERE a1.name ILIKE '%ban công%'
  AND a2.name ILIKE '%cửa sổ%'
  AND ri.status IN ('available', 'reserved');

-- 7) Tìm các phòng trọ giờ giấc tự do (không curfew).
SELECT b.name AS building_name, ri.room_number
FROM room_rules rr
JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
JOIN rooms rm ON rm.id = rr.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE rrt.name ILIKE '%giờ tự do%' OR rrt.name_en ILIKE '%curfew%' OR rr.custom_value ILIKE '%tự do%'
  AND rr.is_enforced = TRUE
  AND ri.status IN ('available', 'reserved');

-- 8) Sắp xếp các phòng trọ ở Bình Thạnh theo giá từ thấp đến cao.
SELECT b.name AS building_name, ri.room_number, rp.base_price_monthly
FROM rooms rm
JOIN room_pricing rp ON rp.room_id = rm.id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
JOIN districts d ON d.id = b.district_id
WHERE d.name ILIKE '%Bình Thạnh%'
  AND ri.status IN ('available', 'reserved')
ORDER BY rp.base_price_monthly ASC;

-- 9) Có phòng nào miễn phí tiền gửi xe (Parking cost) không?
SELECT DISTINCT b.name AS building_name, ri.room_number, rm.name AS room_name
FROM room_costs rc
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN rooms rm ON rm.id = rc.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE ct.category = 'parking'
  AND rc.is_active = TRUE
  AND (rc.included_in_rent = TRUE OR COALESCE(rc.fixed_amount, 0) = 0);

-- 10) Tìm phòng trọ dành cho nữ (Female only) ở khu vực Cầu Giấy.
SELECT DISTINCT b.name AS building_name, ri.room_number, rm.name AS room_name
FROM rooms rm
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
JOIN districts d ON d.id = b.district_id
LEFT JOIN room_rules rr ON rr.room_id = rm.id
LEFT JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
WHERE d.name ILIKE '%Cầu Giấy%'
  AND ri.status IN ('available', 'reserved')
  AND (
    (rrt.name ILIKE '%nữ%' OR rr.custom_value ILIKE '%nữ%')
    OR (rm.description ILIKE '%nữ%')
  );

-- 11) Những phòng nào đang có ưu đãi giảm giá cọc (Deposit amount < 1 tháng).
SELECT b.name AS building_name, ri.room_number, rp.base_price_monthly, rp.deposit_amount, rp.deposit_months
FROM room_pricing rp
JOIN rooms rm ON rm.id = rp.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE rp.deposit_amount < rp.base_price_monthly
  AND ri.status IN ('available', 'reserved');

-- 12) Liệt kê các phòng có diện tích lớn hơn 30m2 cho gia đình nhỏ.
SELECT b.name AS building_name, ri.room_number, rm.area_sqm, rm.max_occupancy
FROM rooms rm
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE rm.area_sqm > 30
  AND rm.max_occupancy >= 3
  AND ri.status IN ('available', 'reserved');

-- 13) Tìm nhà nguyên căn có 3 phòng ngủ.
SELECT b.name AS building_name, rm.description, rm.total_rooms
FROM rooms rm
JOIN buildings b ON b.id = rm.building_id
WHERE rm.room_type = 'whole_house'
  AND rm.total_rooms >= 3;

-- 14) Phòng nào có bếp riêng (Kitchen amenity) trong phòng?
SELECT DISTINCT b.name AS building_name, ri.room_number
FROM room_amenities ra
JOIN amenities a ON a.id = ra.amenity_id
JOIN rooms rm ON rm.id = ra.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE a.category = 'kitchen' AND (a.name ILIKE '%bếp%' OR a.name_en ILIKE '%kitchen%')
  AND ri.status IN ('available', 'reserved');

-- 15) Có phòng nào mới đăng trong 7 ngày qua không?
SELECT b.name AS building_name, ri.room_number, rm.created_at
FROM rooms rm
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE rm.created_at >= (current_date - INTERVAL '7 days')
  AND ri.status IN ('available', 'reserved')
ORDER BY rm.created_at DESC;

-- 16) Tìm phòng có an ninh tốt, có camera giám sát hoặc bảo vệ.
SELECT DISTINCT b.name AS building_name, ri.room_number
FROM room_amenities ra
JOIN amenities a ON a.id = ra.amenity_id
JOIN rooms rm ON rm.id = ra.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE (a.name ILIKE '%camera%' OR a.name ILIKE '%bảo vệ%' OR a.category = 'safety')
  AND ri.status IN ('available', 'reserved');

-- 17) Cho tôi xem các phòng được đánh giá 5 sao bởi những người thuê trước.
SELECT DISTINCT b.name AS building_name, ri.room_number, AVG(rt.rating) AS avg_rating
FROM ratings rt
JOIN rooms rm ON rm.id = rt.target_id AND rt.target_type = 'room'
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
GROUP BY b.name, ri.room_number
HAVING AVG(rt.rating) >= 4.8;

-- 18) Có ai đang tìm nam ở ghép tại Quận 10 không?
SELECT rsp.id, rsp.title, rsp.monthly_rent, rsp.remaining_slots,
       COALESCE(dext.name, dint.name) AS district_name
FROM roommate_seeking_posts rsp
LEFT JOIN districts dext ON dext.id = rsp.external_district_id
LEFT JOIN room_instances ri ON ri.id = rsp.room_instance_id
LEFT JOIN rooms rm ON rm.id = ri.room_id
LEFT JOIN buildings b ON b.id = rm.building_id
LEFT JOIN districts dint ON dint.id = b.district_id
WHERE rsp.status = 'active'
  AND rsp.preferred_gender = 'male'
  AND COALESCE(dext.name, dint.name) ILIKE '%Quận 10%';

-- 19) Tìm các bài đăng tìm người ở ghép giá khoảng 1.5 triệu/người.
SELECT rsp.id, rsp.title, rsp.monthly_rent, rsp.remaining_slots,
       (rsp.monthly_rent / NULLIF(rsp.max_occupancy,0)) AS estimated_per_person
FROM roommate_seeking_posts rsp
WHERE rsp.status = 'active'
  AND (rsp.monthly_rent / NULLIF(rsp.max_occupancy,0)) <= 1500000;

-- 20) Phòng nào đang cần tìm người ở ghép nhưng không hút thuốc?
SELECT rsp.id, rsp.title, rsp.remaining_slots, ri.room_number
FROM roommate_seeking_posts rsp
JOIN room_instances ri ON ri.id = rsp.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN room_rules rr ON rr.room_id = rm.id
JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
WHERE rsp.status = 'active'
  AND rsp.remaining_slots > 0
  AND rrt.category = 'smoking'
  AND rrt.rule_type = 'forbidden';

-- 21) Có bài đăng tìm roommate nào yêu cầu người đi làm (công sở) không?
SELECT rsp.id, rsp.title, rsp.additional_requirements, rsp.monthly_rent
FROM roommate_seeking_posts rsp
WHERE rsp.status = 'active'
  AND (rsp.additional_requirements ILIKE '%đi làm%' OR rsp.additional_requirements ILIKE '%công sở%');

-- 22) Tìm các phòng đang thiếu 1 slot ở ghép dạng Ký túc xá (Dormitory).
SELECT rsp.id, rsp.title, rsp.remaining_slots, ri.room_number
FROM roommate_seeking_posts rsp
JOIN room_instances ri ON ri.id = rsp.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
WHERE rsp.status = 'active'
  AND rsp.remaining_slots = 1
  AND rm.room_type = 'dormitory';

-- 23) Liệt kê các bài đăng tìm bạn cùng phòng vừa mới đăng hôm qua.
SELECT rsp.id, rsp.title, rsp.monthly_rent, rsp.created_at
FROM roommate_seeking_posts rsp
WHERE rsp.created_at::date = current_date - INTERVAL '1 day';

-- 24) Phòng 301 có đang tuyển thêm người ở ghép không?
SELECT rsp.id, rsp.title, rsp.remaining_slots, rsp.status
FROM roommate_seeking_posts rsp
JOIN room_instances ri ON ri.id = rsp.room_instance_id
WHERE ri.room_number = '301';

-- 25) Hóa đơn tiền nhà tháng này của tôi là bao nhiêu?
SELECT bll.id, bll.total_amount, bll.paid_amount, bll.remaining_amount
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND bll.billing_month = EXTRACT(MONTH FROM current_date)
  AND bll.billing_year = EXTRACT(YEAR FROM current_date);

-- 26) Cho tôi xem chi tiết tiền điện và tiền nước tháng 11.
SELECT bi.item_name, bi.amount, bll.billing_month, bll.billing_year
FROM bill_items bi
JOIN bills bll ON bll.id = bi.bill_id
JOIN rentals rnt ON rnt.id = bll.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND bll.billing_month = 11
  AND bi.item_type = 'utility'
  AND (bi.item_name ILIKE '%điện%' OR bi.item_name ILIKE '%nước%');

-- 27) Tôi còn nợ tiền phòng tháng nào chưa đóng không?
SELECT bll.billing_period, bll.total_amount, bll.paid_amount, bll.remaining_amount, bll.status
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND bll.remaining_amount > 0
  AND bll.status IN ('pending', 'overdue');

-- 28) Hạn chót thanh toán của hóa đơn tháng này là ngày mấy?
SELECT bll.due_date
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND bll.billing_month = EXTRACT(MONTH FROM current_date)
  AND bll.billing_year = EXTRACT(YEAR FROM current_date);

-- 29) Kiểm tra xem khoản chuyển khoản hôm qua của tôi đã được xác nhận chưa.
SELECT p.id, p.amount, p.payment_status, p.payment_date
FROM payments p
JOIN rentals rnt ON rnt.id = p.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND p.payment_method = 'bank_transfer'
  AND p.payment_date::date = current_date - INTERVAL '1 day';

-- 30) Tháng này tôi dùng hết bao nhiêu số điện (kWh)?
SELECT SUM(COALESCE(rimr.meter_reading,0) - COALESCE(rimr.last_meter_reading,0)) AS kwh_used
FROM room_instance_meter_readings rimr
JOIN room_costs rc ON rc.id = rimr.room_cost_id
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN room_instances ri ON ri.id = rimr.room_instance_id
JOIN rentals rnt ON rnt.room_instance_id = ri.id
WHERE rnt.tenant_id = :tenant_id
  AND ct.name ILIKE '%điện%'
  AND date_trunc('month', rimr.created_at) = date_trunc('month', current_date);

-- 31) So sánh tiền điện tháng này với tháng trước xem có tăng không.
WITH monthly AS (
  SELECT date_trunc('month', rimr.created_at) AS month,
         SUM(COALESCE(rimr.meter_reading,0) - COALESCE(rimr.last_meter_reading,0)) AS usage_kwh
  FROM room_instance_meter_readings rimr
  JOIN room_costs rc ON rc.id = rimr.room_cost_id
  JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
  JOIN room_instances ri ON ri.id = rimr.room_instance_id
  JOIN rentals rnt ON rnt.room_instance_id = ri.id
  WHERE rnt.tenant_id = :tenant_id
    AND ct.name ILIKE '%điện%'
    AND rimr.created_at >= date_trunc('month', current_date - INTERVAL '1 month')
  GROUP BY month
)
SELECT curr.usage_kwh AS this_month_kwh, prev.usage_kwh AS last_month_kwh,
       (curr.usage_kwh - prev.usage_kwh) AS diff_kwh
FROM monthly curr
LEFT JOIN monthly prev ON prev.month = date_trunc('month', current_date - INTERVAL '1 month')
WHERE curr.month = date_trunc('month', current_date);

-- 32) Giá điện hiện tại chủ nhà đang tính là bao nhiêu một số?
SELECT rc.unit_price, rc.unit
FROM rentals rnt
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN room_costs rc ON rc.room_id = rm.id
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
WHERE rnt.tenant_id = :tenant_id
  AND ct.name ILIKE '%điện%'
  AND rc.is_active = TRUE
LIMIT 1;

-- 33) Tổng số tiền tôi đã thanh toán cho chủ nhà từ đầu năm đến giờ.
SELECT COALESCE(SUM(p.amount),0) AS total_paid_ytd
FROM payments p
JOIN rentals rnt ON rnt.id = p.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND p.payment_status = 'completed'
  AND p.payment_date >= date_trunc('year', current_date);

-- 34) Tiền cọc của tôi đang được lưu là bao nhiêu?
SELECT rnt.deposit_paid
FROM rentals rnt
WHERE rnt.tenant_id = :tenant_id
  AND rnt.status = 'active';

-- 35) Khi nào hợp đồng thuê phòng của tôi hết hạn?
SELECT c.contract_code, c.end_date
FROM contracts c
JOIN rentals rnt ON rnt.id = c.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND c.status IN ('active', 'fully_signed');

-- 36) Tôi muốn xem lại các điều khoản về chấm dứt hợp đồng sớm.
SELECT c.contract_code, c.contract_data
FROM contracts c
JOIN rentals rnt ON rnt.id = c.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND c.status IN ('active', 'fully_signed');

-- 37) Chủ nhà đã xác nhận yêu cầu gia hạn hợp đồng của tôi chưa?
SELECT rnt.id AS rental_id, rnt.status, rnt.contract_end_date, rnt.contract_start_date
FROM rentals rnt
WHERE rnt.tenant_id = :tenant_id
  AND rnt.status = 'pending_renewal';

-- 38) Gửi cho tôi link file PDF hợp đồng đã ký.
SELECT c.contract_code, c.pdf_url
FROM contracts c
JOIN rentals rnt ON rnt.id = c.rental_id
WHERE rnt.tenant_id = :tenant_id
  AND c.pdf_url IS NOT NULL;

-- 39) Tôi cần thông tin số tài khoản ngân hàng của chủ nhà để chuyển tiền.
SELECT u.bank_account, u.bank_name, u.first_name, u.last_name, u.phone, u.email
FROM rentals rnt
JOIN users u ON u.id = rnt.owner_id
WHERE rnt.tenant_id = :tenant_id;

-- 40) Trạng thái yêu cầu trả phòng của tôi đang thế nào?
SELECT rnt.status, rnt.termination_notice_date, rnt.termination_reason, rnt.contract_end_date
FROM rentals rnt
WHERE rnt.tenant_id = :tenant_id;

-- 41) Trạng thái cái báo cáo sửa vòi nước hôm qua tôi gửi đã xong chưa?
SELECT rmi.id, rmi.status, rmi.updated_at
FROM room_issues rmi
WHERE rmi.reporter_id = :tenant_id
  AND rmi.title ILIKE '%vòi nước%'
  AND rmi.created_at::date = current_date - INTERVAL '1 day';

-- 42) Tôi muốn xem lịch sử các sự cố tôi đã báo cáo.
SELECT rmi.id, rmi.title, rmi.category, rmi.status, rmi.created_at
FROM room_issues rmi
WHERE rmi.reporter_id = :tenant_id
ORDER BY rmi.created_at DESC;

-- 43) Gửi tin nhắn cho chủ nhà báo "Mạng wifi tầng 3 bị yếu".
-- Note: action statement for testing; in production route through messaging API instead of direct INSERT.
INSERT INTO messages (conversation_id, sender_id, type, content, is_edited, sent_at)
VALUES (:conversation_id, :tenant_id, 'text', 'Mạng wifi tầng 3 bị yếu', FALSE, now());

-- 44) Tôi muốn đánh giá (Rating) phòng trọ này 4 sao.
-- Note: action statement for testing; in production route through rating service/API instead of direct INSERT.
INSERT INTO ratings (target_type, target_id, reviewer_id, rating, content, created_at, updated_at)
VALUES ('room', :room_id, :tenant_id, 4, 'Phòng ổn, wifi cần cải thiện', now(), now());

-- 45) Có thông báo mới nào từ chủ nhà về việc cắt điện nước không?
SELECT n.id, n.title, n.message, n.created_at
FROM notifications n
WHERE n.user_id = :tenant_id
  AND (n.title ILIKE '%cắt điện%' OR n.message ILIKE '%cắt điện%' OR n.message ILIKE '%cắt nước%')
ORDER BY n.created_at DESC
LIMIT 10;

-- 46) Quy định về việc dẫn bạn bè (Visitors) về phòng như thế nào?
SELECT rrt.name, rrt.description, rr.custom_value, rr.is_enforced
FROM room_rules rr
JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
JOIN rooms rm ON rm.id = rr.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN rentals rnt ON rnt.room_instance_id = ri.id
WHERE rnt.tenant_id = :tenant_id
  AND rrt.category = 'visitors';

-- 47) Xem lại chỉ số điện nước lúc tôi mới nhận phòng (bàn giao).
SELECT rimr.*
FROM room_instance_meter_readings rimr
JOIN rentals rnt ON rnt.room_instance_id = rimr.room_instance_id
WHERE rnt.tenant_id = :tenant_id
  AND rimr.created_at::date <= rnt.contract_start_date
ORDER BY rimr.created_at ASC
LIMIT 1;

-- 48) Tôi có thể nuôi mèo trong phòng hiện tại không?
SELECT rrt.rule_type, rr.custom_value, rr.is_enforced
FROM room_rules rr
JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
JOIN rooms rm ON rm.id = rr.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN rentals rnt ON rnt.room_instance_id = ri.id
WHERE rnt.tenant_id = :tenant_id
  AND rrt.category = 'pets';

-- 49) Phí dịch vụ vệ sinh hành lang là bao nhiêu tiền một tháng?
SELECT rc.fixed_amount, rc.currency
FROM room_costs rc
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN rooms rm ON rm.id = rc.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN rentals rnt ON rnt.room_instance_id = ri.id
WHERE rnt.tenant_id = :tenant_id
  AND ct.category = 'service'
  AND (ct.name ILIKE '%vệ sinh%' OR ct.name ILIKE '%cleaning%');

-- 50) Cách liên hệ nhanh nhất với bảo vệ tòa nhà hoặc chủ nhà.
SELECT u.first_name, u.last_name, u.phone, u.email
FROM rentals rnt
JOIN users u ON u.id = rnt.owner_id
WHERE rnt.tenant_id = :tenant_id;
