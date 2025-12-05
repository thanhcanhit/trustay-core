-- 1) How many rooms are currently available?
SELECT COUNT(*) AS available_rooms
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ri.status = 'available'
  AND b.owner_id = :owner_id;

-- 2) List all rooms in building "Nha tro Minh Phat Quan 9".
SELECT r.*, rp.base_price_monthly
FROM rooms r
LEFT JOIN room_pricing rp ON rp.room_id = r.id
JOIN buildings b ON b.id = r.building_id
WHERE b.name = 'Nha tro Minh Phat Quan 9'
  AND b.owner_id = :owner_id
ORDER BY r.name;

-- 3) Show rooms under maintenance.
SELECT b.name AS building_name, r.name AS room_name, ri.room_number
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ri.status = 'maintenance'
  AND b.owner_id = :owner_id;

-- 4) Which building has the most available rooms?
SELECT b.id, b.name, COUNT(*) AS available_rooms
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ri.status = 'available'
  AND b.owner_id = :owner_id
GROUP BY b.id, b.name
ORDER BY available_rooms DESC
LIMIT 1;

-- 5) What is the status of room 101 in building "Toa nha A"?
SELECT ri.status, ri.is_active, ri.updated_at
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ri.room_number = '101'
  AND b.name = 'Toa nha A'
  AND b.owner_id = :owner_id;

-- 6) How many room types are "sleepbox"?
SELECT COUNT(*) AS sleepbox_room_types
FROM rooms r
JOIN buildings b ON b.id = r.building_id
WHERE r.room_type = 'sleepbox'
  AND b.owner_id = :owner_id;

-- 7) Rooms with rent under 3,000,000.
SELECT b.name AS building_name, r.name AS room_name, ri.room_number, rp.base_price_monthly
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
JOIN room_pricing rp ON rp.room_id = r.id
WHERE rp.base_price_monthly < 3000000
  AND b.owner_id = :owner_id
  AND ri.status IN ('available', 'reserved');

-- 8) Rooms with area greater than 25 sqm.
SELECT b.name AS building_name, r.name AS room_name, r.area_sqm
FROM rooms r
JOIN buildings b ON b.id = r.building_id
WHERE r.area_sqm > 25
  AND b.owner_id = :owner_id
ORDER BY r.area_sqm DESC;

-- 9) Rooms reserved (deposit placed, tenant not moved in).
SELECT b.name AS building_name, r.name AS room_name, ri.room_number
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ri.status = 'reserved'
  AND b.owner_id = :owner_id;

-- 10) Total number of room instances managed by this landlord.
SELECT COUNT(*) AS total_room_instances
FROM room_instances ri
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
WHERE b.owner_id = :owner_id;

-- 11) Who is renting room 205?
SELECT u.id AS tenant_id, u.first_name, u.last_name, u.phone, rnt.status
FROM rentals rnt
JOIN users u ON u.id = rnt.tenant_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '205'
  AND rnt.status = 'active'
  AND b.owner_id = :owner_id;

-- 12) Phone number of tenant named "Nguyen Van A" (only within this landlord's properties).
SELECT DISTINCT u.first_name, u.last_name, u.phone, u.email
FROM users u
JOIN rentals rnt ON rnt.tenant_id = u.id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE u.role = 'tenant'
  AND (u.first_name || ' ' || u.last_name) ILIKE '%Nguyen Van A%'
  AND b.owner_id = :owner_id;

-- 13) Count male vs female tenants (scoped to this landlord).
SELECT u.gender, COUNT(DISTINCT u.id) AS tenant_count
FROM users u
JOIN rentals rnt ON rnt.tenant_id = u.id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE rnt.status = 'active'
  AND b.owner_id = :owner_id
GROUP BY u.gender;

-- 14) Tenants without verified identity (scoped to this landlord).
SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.phone
FROM users u
JOIN rentals rnt ON rnt.tenant_id = u.id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE u.role = 'tenant'
  AND u.is_verified_identity = FALSE
  AND b.owner_id = :owner_id;

-- 15) Which tenant has stayed the longest (active rentals only)?
SELECT u.id, u.first_name, u.last_name, rnt.contract_start_date,
       AGE(current_date, rnt.contract_start_date) AS stay_duration
FROM rentals rnt
JOIN users u ON u.id = rnt.tenant_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE rnt.status = 'active'
  AND b.owner_id = :owner_id
ORDER BY rnt.contract_start_date ASC
LIMIT 1;

-- 16) Tenants with home address in "Nghe An" (scoped to this landlord).
SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.phone
FROM users u
JOIN user_addresses ua ON ua.user_id = u.id
JOIN provinces p ON p.id = ua.province_id
JOIN rentals rnt ON rnt.tenant_id = u.id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE u.role = 'tenant'
  AND p.name ILIKE '%Nghe An%'
  AND b.owner_id = :owner_id;

-- 17) How many tenants moved in this month?
SELECT COUNT(*) AS new_tenants_this_month
FROM rentals rnt
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE rnt.contract_start_date >= date_trunc('month', current_date)
  AND rnt.contract_start_date < (date_trunc('month', current_date) + INTERVAL '1 month')
  AND b.owner_id = :owner_id;

-- 18) Tenants sharing room 301 (active).
SELECT rnt.id AS rental_id, u.first_name, u.last_name, u.phone, rnt.status
FROM rentals rnt
JOIN users u ON u.id = rnt.tenant_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '301'
  AND rnt.status = 'active'
  AND b.owner_id = :owner_id;

-- 19) Total number of active tenants across all buildings.
SELECT COUNT(*) AS active_tenants
FROM rentals rnt
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE rnt.status = 'active'
  AND b.owner_id = :owner_id;

-- 20) Contact info of contract representative for room 402.
SELECT u.id AS tenant_id, u.first_name, u.last_name, u.email, u.phone
FROM contracts c
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
JOIN users u ON u.id = c.tenant_id
WHERE ri.room_number = '402'
  AND b.owner_id = :owner_id;

-- 21) Total revenue last month.
SELECT COALESCE(SUM(p.amount), 0) AS revenue_last_month
FROM payments p
JOIN rentals rnt ON rnt.id = p.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE p.payment_status = 'completed'
  AND p.payment_date >= date_trunc('month', current_date - INTERVAL '1 month')
  AND p.payment_date < date_trunc('month', current_date)
  AND b.owner_id = :owner_id;

-- 22) Rooms that have not fully paid this month's rent.
SELECT ri.room_number, rm.name AS room_name, b.name AS building_name,
       bll.total_amount, bll.paid_amount, (bll.total_amount - bll.paid_amount) AS outstanding
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE bll.billing_month = EXTRACT(MONTH FROM current_date)
  AND bll.billing_year = EXTRACT(YEAR FROM current_date)
  AND bll.paid_amount < bll.total_amount
  AND bll.status <> 'paid'
  AND b.owner_id = :owner_id;

-- 23) Outstanding amount for room 105.
SELECT ri.room_number, COALESCE(SUM(bll.remaining_amount), 0) AS remaining_amount
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '105'
  AND bll.status IN ('pending', 'overdue')
  AND b.owner_id = :owner_id
GROUP BY ri.room_number;

-- 24) Total electricity charges to collect in November 2025.
SELECT COALESCE(SUM(bi.amount), 0) AS electricity_amount
FROM bill_items bi
JOIN bills bll ON bll.id = bi.bill_id
JOIN rentals rnt ON rnt.id = bll.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE bll.billing_month = 11
  AND bll.billing_year = 2025
  AND bi.item_type = 'utility'
  AND (bi.item_name ILIKE '%dien%' OR bi.item_name ILIKE '%electric%')
  AND b.owner_id = :owner_id;

-- 25) Which invoices are overdue?
SELECT bll.id, bll.billing_period, ri.room_number, u.first_name, u.last_name,
       bll.total_amount, bll.remaining_amount
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
JOIN users u ON u.id = rnt.tenant_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE bll.status = 'overdue'
  AND b.owner_id = :owner_id
ORDER BY bll.due_date ASC;

-- 26) Which customers paid by bank transfer today?
SELECT DISTINCT u.id, u.first_name, u.last_name, u.phone, p.amount
FROM payments p
JOIN rentals rnt ON rnt.id = p.rental_id
JOIN users u ON u.id = rnt.tenant_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE p.payment_status = 'completed'
  AND p.payment_method = 'bank_transfer'
  AND p.payment_date::date = current_date
  AND b.owner_id = :owner_id;

-- 27) Total deposit currently held for active rentals.
SELECT COALESCE(SUM(rnt.deposit_paid), 0) AS total_deposit_held
FROM rentals rnt
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE rnt.status = 'active'
  AND b.owner_id = :owner_id;

-- 28) Compare revenue this month vs last month.
WITH revenue AS (
  SELECT 'current_month' AS period, COALESCE(SUM(p.amount), 0) AS amount
  FROM payments p
  JOIN rentals rnt ON rnt.id = p.rental_id
  JOIN room_instances ri ON ri.id = rnt.room_instance_id
  JOIN rooms rm ON rm.id = ri.room_id
  JOIN buildings b ON b.id = rm.building_id
  WHERE p.payment_status = 'completed'
    AND p.payment_date >= date_trunc('month', current_date)
    AND p.payment_date < date_trunc('month', current_date) + INTERVAL '1 month'
    AND b.owner_id = :owner_id
  UNION ALL
  SELECT 'last_month' AS period, COALESCE(SUM(p.amount), 0) AS amount
  FROM payments p
  JOIN rentals rnt ON rnt.id = p.rental_id
  JOIN room_instances ri ON ri.id = rnt.room_instance_id
  JOIN rooms rm ON rm.id = ri.room_id
  JOIN buildings b ON b.id = rm.building_id
  WHERE p.payment_status = 'completed'
    AND p.payment_date >= date_trunc('month', current_date - INTERVAL '1 month')
    AND p.payment_date < date_trunc('month', current_date)
    AND b.owner_id = :owner_id
)
SELECT *
FROM revenue;

-- 29) Payment history for room 201 in the last 3 months.
SELECT p.id AS payment_id, p.amount, p.payment_method, p.payment_status, p.payment_date
FROM payments p
JOIN rentals rnt ON rnt.id = p.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '201'
  AND p.payment_date >= current_date - INTERVAL '3 months'
  AND b.owner_id = :owner_id
ORDER BY p.payment_date DESC;

-- 30) How many electronic bills are still draft/pending?
SELECT COUNT(*) AS unsent_bills
FROM bills bll
JOIN rentals rnt ON rnt.id = bll.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE bll.status IN ('draft', 'pending')
  AND b.owner_id = :owner_id;

-- 31) What was last month's electricity meter reading for room 303?
SELECT rimr.last_meter_reading, rimr.meter_reading, rimr.created_at
FROM room_instance_meter_readings rimr
JOIN room_instances ri ON ri.id = rimr.room_instance_id
JOIN room_costs rc ON rc.id = rimr.room_cost_id
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '303'
  AND ct.name ILIKE '%dien%'
  AND date_trunc('month', rimr.created_at) = date_trunc('month', current_date - INTERVAL '1 month')
  AND b.owner_id = :owner_id
ORDER BY rimr.created_at DESC
LIMIT 1;

-- 32) Which room used the most water last month?
SELECT ri.room_number, b.name AS building_name,
       (COALESCE(rimr.meter_reading, 0) - COALESCE(rimr.last_meter_reading, 0)) AS water_usage
FROM room_instance_meter_readings rimr
JOIN room_instances ri ON ri.id = rimr.room_instance_id
JOIN room_costs rc ON rc.id = rimr.room_cost_id
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ct.name ILIKE '%nuoc%'
  AND date_trunc('month', rimr.created_at) = date_trunc('month', current_date - INTERVAL '1 month')
  AND b.owner_id = :owner_id
ORDER BY water_usage DESC NULLS LAST
LIMIT 1;

-- 33) Current electricity unit price for building "Toa nha B".
SELECT DISTINCT rc.unit_price, rc.unit, ct.name AS cost_type
FROM room_costs rc
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN rooms rm ON rm.id = rc.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE b.name = 'Toa nha B'
  AND ct.name ILIKE '%dien%'
  AND rc.is_active = TRUE
  AND b.owner_id = :owner_id;

-- 34) Rooms missing utility meter readings this month.
SELECT ri.room_number, b.name AS building_name
FROM room_instances ri
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
JOIN room_costs rc ON rc.room_id = rm.id AND rc.cost_type = 'metered' AND rc.is_active = TRUE
LEFT JOIN room_instance_meter_readings rimr
  ON rimr.room_instance_id = ri.id
  AND rimr.room_cost_id = rc.id
  AND date_trunc('month', rimr.created_at) = date_trunc('month', current_date)
WHERE ri.is_active = TRUE
  AND b.owner_id = :owner_id
GROUP BY ri.room_number, b.name
HAVING COUNT(rimr.id) = 0;

-- 35) Monthly service costs (trash, wifi, cleaning) for room 101.
SELECT ri.room_number, b.name AS building_name,
       SUM(COALESCE(rc.fixed_amount, 0) + COALESCE(rc.per_person_amount, 0)) AS monthly_service_cost
FROM room_costs rc
JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
JOIN rooms rm ON rm.id = rc.room_id
JOIN room_instances ri ON ri.room_id = rm.id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '101'
  AND ct.category = 'service'
  AND rc.is_active = TRUE
  AND b.owner_id = :owner_id
GROUP BY ri.room_number, b.name;

-- 36) Any rooms with unusually low electricity usage this month vs last month?
WITH usage_monthly AS (
  SELECT ri.id AS room_instance_id, ri.room_number,
         date_trunc('month', rimr.created_at) AS month,
         COALESCE(rimr.meter_reading, 0) - COALESCE(rimr.last_meter_reading, 0) AS usage_kwh,
         b.owner_id
  FROM room_instance_meter_readings rimr
  JOIN room_instances ri ON ri.id = rimr.room_instance_id
  JOIN room_costs rc ON rc.id = rimr.room_cost_id
  JOIN cost_type_templates ct ON ct.id = rc.cost_type_template_id
  JOIN rooms rm ON rm.id = ri.room_id
  JOIN buildings b ON b.id = rm.building_id
  WHERE ct.name ILIKE '%dien%'
    AND b.owner_id = :owner_id
)
SELECT curr.room_number, curr.usage_kwh AS usage_this_month, prev.usage_kwh AS usage_last_month
FROM usage_monthly curr
JOIN usage_monthly prev
  ON prev.room_instance_id = curr.room_instance_id
  AND prev.month = date_trunc('month', current_date - INTERVAL '1 month')
WHERE curr.month = date_trunc('month', current_date)
  AND curr.usage_kwh < (prev.usage_kwh * 0.5);

-- 37) Contracts expiring within the next 30 days.
SELECT c.contract_code, ri.room_number, u.first_name, u.last_name, c.end_date
FROM contracts c
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
JOIN users u ON u.id = c.tenant_id
WHERE c.end_date BETWEEN current_date AND (current_date + INTERVAL '30 days')
  AND c.status IN ('active', 'fully_signed')
  AND b.owner_id = :owner_id
ORDER BY c.end_date ASC;

-- 38) How many contracts are pending signature?
SELECT COUNT(*) AS pending_signature_contracts
FROM contracts c
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE c.status = 'pending_signature'
  AND b.owner_id = :owner_id;

-- 39) Duration of the contract for room 501.
SELECT c.contract_code, c.start_date, c.end_date, (c.end_date - c.start_date) AS duration_days
FROM contracts c
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '501'
  AND b.owner_id = :owner_id;

-- 40) Find contract of tenant named "Tran Thi B".
SELECT c.contract_code, c.status, c.start_date, c.end_date, ri.room_number, b.name AS building_name
FROM contracts c
JOIN users u ON u.id = c.tenant_id
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE (u.first_name || ' ' || u.last_name) ILIKE '%Tran Thi B%'
  AND b.owner_id = :owner_id;

-- 41) Contracts terminated early this year.
SELECT c.contract_code, ri.room_number, c.start_date, c.end_date, c.terminated_at
FROM contracts c
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE c.status = 'terminated'
  AND c.terminated_at IS NOT NULL
  AND c.terminated_at < c.end_date
  AND DATE_PART('year', c.terminated_at) = DATE_PART('year', current_date)
  AND b.owner_id = :owner_id;

-- 42) Show PDF file for room 102 contract.
SELECT c.contract_code, c.pdf_url
FROM contracts c
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '102'
  AND b.owner_id = :owner_id;

-- 43) Tenants who have not renewed their contract.
SELECT DISTINCT u.id, u.first_name, u.last_name, ri.room_number, c.end_date
FROM contracts c
JOIN users u ON u.id = c.tenant_id
JOIN room_instances ri ON ri.id = c.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE c.status = 'expired'
  AND c.end_date < current_date
  AND NOT EXISTS (
    SELECT 1
    FROM contracts c2
    WHERE c2.tenant_id = c.tenant_id
      AND c2.room_instance_id = c.room_instance_id
      AND c2.status IN ('active', 'fully_signed', 'pending_signature')
      AND c2.start_date > c.end_date
  )
  AND b.owner_id = :owner_id;

-- 44) How many new issues are unprocessed?
SELECT COUNT(*) AS new_issues
FROM room_issues rmi
JOIN room_instances ri ON ri.id = rmi.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE rmi.status = 'new'
  AND b.owner_id = :owner_id;

-- 45) What issues are reported for room 202?
SELECT ri.room_number, rmi.title, rmi.category, rmi.status, rmi.created_at
FROM room_issues rmi
JOIN room_instances ri ON ri.id = rmi.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '202'
  AND b.owner_id = :owner_id;

-- 46) List issues related to electricity or water.
SELECT rmi.id, ri.room_number, b.name AS building_name, rmi.title, rmi.status, rmi.created_at
FROM room_issues rmi
JOIN room_instances ri ON ri.id = rmi.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE (rmi.category = 'utility' OR rmi.title ILIKE '%dien%' OR rmi.title ILIKE '%nuoc%')
  AND b.owner_id = :owner_id
ORDER BY rmi.created_at DESC;

-- 47) Who reported the noise issue on floor 3?
SELECT rmi.id, u.first_name, u.last_name, u.phone, ri.room_number, r.floor_number
FROM room_issues rmi
JOIN room_instances ri ON ri.id = rmi.room_instance_id
JOIN rooms r ON r.id = ri.room_id
JOIN buildings b ON b.id = r.building_id
JOIN users u ON u.id = rmi.reporter_id
WHERE rmi.category = 'noise'
  AND r.floor_number = 3
  AND b.owner_id = :owner_id;

-- 48) Which building has the most issues this month?
SELECT b.id, b.name, COUNT(*) AS issue_count
FROM room_issues rmi
JOIN room_instances ri ON ri.id = rmi.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE date_trunc('month', rmi.created_at) = date_trunc('month', current_date)
  AND b.owner_id = :owner_id
GROUP BY b.id, b.name
ORDER BY issue_count DESC
LIMIT 1;

-- 49) Has the water faucet issue in room 104 been resolved?
SELECT rmi.id, rmi.status, rmi.updated_at
FROM room_issues rmi
JOIN room_instances ri ON ri.id = rmi.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
WHERE ri.room_number = '104'
  AND rmi.title ILIKE '%voi nuoc%'
  AND b.owner_id = :owner_id;

-- 50) Low ratings (<3 stars) related to this landlord's rentals.
SELECT r.rating, r.content, r.created_at,
       CASE r.target_type
         WHEN 'tenant' THEN 'Tenant'
         WHEN 'landlord' THEN 'Landlord'
         WHEN 'room' THEN 'Room'
       END AS target_type,
       r.target_id,
       u.first_name AS reviewer_first_name,
       u.last_name AS reviewer_last_name
FROM ratings r
JOIN rentals rnt ON rnt.id = r.rental_id
JOIN room_instances ri ON ri.id = rnt.room_instance_id
JOIN rooms rm ON rm.id = ri.room_id
JOIN buildings b ON b.id = rm.building_id
JOIN users u ON u.id = r.reviewer_id
WHERE r.rating < 3
  AND b.owner_id = :owner_id
ORDER BY r.rating ASC, r.created_at DESC;
