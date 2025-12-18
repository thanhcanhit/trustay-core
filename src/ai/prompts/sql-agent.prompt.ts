/**
 * SQL Agent prompt - Single unified prompt builder with RAG support
 */

export interface SqlPromptParams {
	query: string;
	schema: string;
	ragContext?: string;
	recentMessages?: string;
	userId?: string;
	userRole?: string;
	businessContext?: string;
	sessionSummary?: string; // Long-term conversation summary
	intentAction?: 'search' | 'own' | 'stats'; // Intent action: search (toàn hệ thống), own (cá nhân), stats (thống kê)
	filtersHint?: string; // Filters hint from orchestrator (e.g., "rooms.slug='tuyenquan-go-vap-phong-ap1443'")
	lastError?: string;
	lastSql?: string;
	attempt?: number;
	limit: number;
}

/**
 * Build SQL generation prompt with RAG context
 * Single function handles all cases (secure/anonymous, with/without context)
 */
export function buildSqlPrompt(params: SqlPromptParams): string {
	const {
		query,
		schema,
		ragContext,
		recentMessages,
		userId,
		userRole,
		businessContext,
		sessionSummary,
		intentAction,
		filtersHint,
		lastError = '',
		lastSql = '',
		attempt = 1,
		limit,
	} = params;

	// Build error context
	const errorContext = lastError
		? `
═══════════════════════════════════════════════════════════════
LỖI TRƯỚC ĐÓ (Attempt ${attempt - 1}):
═══════════════════════════════════════════════════════════════
${lastError}${lastSql ? `\n\nSQL CŨ (CÓ LỖI - CẦN SỬA):\n${lastSql}` : ''}

HƯỚNG DẪN SỬA LỖI (BẮT BUỘC PHẢI LÀM THEO):

1. NẾU LỖI "relation does not exist" (42P01):
   - BẮT BUỘC: Kiểm tra lại tên bảng trong SCHEMA section ở trên
   - Tên bảng PHẢI đúng với schema (ví dụ: "room_requests" ✅, "room_seeking_posts" ❌)
   - Nếu schema có "room_requests" nhưng SQL dùng "room_seeking_posts" → PHẢI sửa thành "room_requests"
   - KHÔNG BAO GIỜ đoán mò tên bảng - PHẢI kiểm tra trong schema trước
   - Lưu ý: Prisma model có thể khác tên bảng thực tế (ví dụ: RoomSeekingPost → room_requests)

2. NẾU LỖI "column does not exist" (42703):
   - BẮT BUỘC: Kiểm tra lại tên cột trong SCHEMA section ở trên
   - Tên cột PHẢI đúng với schema (ví dụ: "name" ✅, "title" ❌ nếu bảng không có cột title)
   - Nếu cần "title" nhưng bảng không có → PHẢI dùng alias: r.name AS title
   - KHÔNG BAO GIỜ đoán mò tên cột - PHẢI kiểm tra trong schema trước
   - QUAN TRỌNG: Nếu SQL cũ dùng cột sai (ví dụ: rent.room_id), PHẢI tìm cột ĐÚNG trong schema
     * Ví dụ: rentals table có room_instance_id (KHÔNG phải room_id)
     * Nếu SQL cũ: SELECT * FROM rentals rent WHERE rent.room_id = ...
     * SQL ĐÚNG: SELECT * FROM rentals rent WHERE rent.room_instance_id = ...
     * PHẢI sửa tất cả chỗ dùng cột sai trong SQL cũ

3. NẾU LỖI "syntax error" hoặc "invalid":
   - Kiểm tra lại cú pháp PostgreSQL
   - Kiểm tra JOIN syntax
   - Kiểm tra WHERE clauses
   - Kiểm tra LIMIT clause

4. CÁC LỖI KHÁC:
   - Column names are snake_case (not camelCase)
   - Use proper table aliases
   - Check foreign key relationships
   - Verify column existence in schema
   - Use correct JOIN syntax${userId ? '\n   - Include proper WHERE clauses for user authorization' : ''}

QUAN TRỌNG: Trước khi tạo SQL mới, PHẢI:
1. ĐỌC KỸ SCHEMA section để xác nhận tên bảng và cột
2. SO SÁNH tên bảng/cột trong SQL cũ với schema
3. SỬA LẠI tên bảng/cột cho đúng với schema
4. KIỂM TRA lại SQL trước khi trả về

`
		: '';

	// Build security context if authenticated - let AI generate WHERE clauses
	let securityContext = '';
	if (userId && userRole) {
		// QUAN TRỌNG: Chỉ filter theo userId khi INTENT_ACTION=own (dữ liệu cá nhân)
		// Khi INTENT_ACTION=search (tìm kiếm toàn hệ thống), KHÔNG filter theo userId
		const shouldFilterByUser = intentAction === 'own';
		const intentNote =
			intentAction === 'search'
				? '\n- QUAN TRỌNG: INTENT_ACTION=search → Đây là câu hỏi TÌM KIẾM TOÀN HỆ THỐNG\n- KHÔNG BAO GIỜ filter theo userId/owner_id khi INTENT_ACTION=search\n- User đang tìm kiếm dữ liệu công khai trên toàn hệ thống, không phải dữ liệu cá nhân\n- Ví dụ: "tìm phòng", "phòng ở Gò Vấp", "phòng dưới 4 triệu" → KHÔNG filter theo owner_id'
				: intentAction === 'own'
					? '\n- QUAN TRỌNG: INTENT_ACTION=own → Đây là câu hỏi về DỮ LIỆU CÁ NHÂN\n- BẮT BUỘC phải filter theo userId để đảm bảo user chỉ truy cập dữ liệu của chính họ\n- Ví dụ: "phòng của tôi", "hóa đơn của tôi", "doanh thu của tôi" → PHẢI filter theo userId/owner_id'
					: '';

		securityContext = `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- Intent Action: ${intentAction || 'not specified'}${intentNote}
- QUAN TRỌNG: Nếu user hỏi về role/thông tin của chính họ, PHẢI SELECT từ bảng users WHERE id = '${userId}'
- KHÔNG BAO GIỜ hardcode role như SELECT '${userRole}' AS user_role - PHẢI query từ database
${
	shouldFilterByUser
		? `- BẮT BUỘC: Phải thêm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
- Quy tắc WHERE clauses theo role và loại dữ liệu (CHỈ ÁP DỤNG KHI INTENT_ACTION=own):
  * Nếu query về bills/hóa đơn:
    - tenant: WHERE rentals.tenant_id = '${userId}' (và JOIN với rentals)
    - landlord: WHERE rentals.owner_id = '${userId}' (và JOIN với rentals)
  * Nếu query về payments/thanh toán: WHERE payments.payer_id = '${userId}'
  * Nếu query về rentals/thuê:
    - tenant: WHERE rentals.tenant_id = '${userId}'
    - landlord: WHERE rentals.owner_id = '${userId}'
  * Nếu query về buildings/tòa nhà/dãy trọ (landlord): WHERE buildings.owner_id = '${userId}'
  * Nếu query về rooms/phòng trọ (landlord): 
    - BẮT BUỘC: JOIN rooms → buildings → WHERE buildings.owner_id = '${userId}'
    - Path: rooms.building_id = buildings.id → buildings.owner_id = '${userId}'
  * Nếu query về room_instances/phòng cụ thể (landlord):
    - BẮT BUỘC: JOIN room_instances → rooms → buildings → WHERE buildings.owner_id = '${userId}'
    - Path: room_instances.room_id = rooms.id → rooms.building_id = buildings.id → buildings.owner_id = '${userId}'
  * QUAN TRỌNG: KHÔNG BAO GIỜ dùng WHERE EXISTS với rentals để filter owner cho rooms/room_instances
    - SAI: WHERE EXISTS (SELECT 1 FROM rentals WHERE rentals.owner_id = '${userId}') ❌
    - Lý do: rentals.owner_id là owner của rental contract, KHÔNG phải owner của room
    - Chỉ tính phòng đã có rental, bỏ qua phòng chưa có rental → kết quả sai
    - ĐÚNG: JOIN buildings ON rooms.building_id = buildings.id WHERE buildings.owner_id = '${userId}' ✅
  * Nếu query về bookings/đặt phòng: WHERE room_bookings.tenant_id = '${userId}'
- Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role (CHỈ KHI INTENT_ACTION=own)
- CHỈ landlords mới được truy cập statistics/thống kê (CHỈ KHI INTENT_ACTION=own hoặc stats)
- CHỈ landlords mới được tạo/quản lý rooms`
		: `- QUAN TRỌNG: INTENT_ACTION=search → KHÔNG filter theo userId/owner_id
- User đang tìm kiếm dữ liệu công khai trên toàn hệ thống
- Ví dụ: Tenant tìm phòng → KHÔNG filter theo owner_id, query tất cả phòng trong hệ thống
- Ví dụ: "phòng ở Gò Vấp", "phòng dưới 4 triệu" → KHÔNG filter theo owner_id`
}

`;
	} else {
		// User chưa đăng nhập - nhấn mạnh KHÔNG query dữ liệu cá nhân
		securityContext = `
SECURITY REQUIREMENTS (USER CHƯA ĐĂNG NHẬP):
- QUAN TRỌNG: User chưa đăng nhập (userId không có)
- KHÔNG BAO GIỜ query dữ liệu cá nhân khi userId không có
- Nếu câu hỏi có ý định "own" (dữ liệu cá nhân) như "tôi có", "của tôi", "mà tôi":
  * KHÔNG BAO GIỜ tạo SQL query dữ liệu cá nhân
  * SQL này sẽ KHÔNG được thực thi - orchestrator đã phải chặn ở bước trước
  * Nếu vẫn đến đây, đây là lỗi hệ thống - KHÔNG tạo SQL
- CHỈ query dữ liệu công khai (rooms, room_requests) khi user chưa đăng nhập
- KHÔNG query: buildings (của landlord), rentals, bills, payments, bookings (cần userId)

`;
	}

	// Build schema section (RAG or fallback)
	const schemaSection = ragContext ? `${ragContext}\n` : `COMPLETE DATABASE SCHEMA:\n${schema}\n\n`;

	// Build business context section if provided
	const businessContextSection = businessContext
		? `NGỮ CẢNH NGHIỆP VỤ (từ Orchestrator Agent):\n${businessContext}\n\n`
		: '';

	// Build role based on security
	const role = userId
		? `Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Nhiệm vụ của bạn là tạo câu lệnh SQL chính xác và AN TOÀN dựa trên schema database, ngữ cảnh nghiệp vụ và câu hỏi của người dùng.`
		: `Bạn là chuyên gia SQL PostgreSQL. Nhiệm vụ của bạn là tạo câu lệnh SQL chính xác dựa trên schema database, ngữ cảnh nghiệp vụ và câu hỏi của người dùng.`;

	return `${role}

${schemaSection}${businessContextSection}${securityContext}${sessionSummary ? `TÓM TẮT NGỮ CẢNH DÀI HẠN (từ các cuộc hội thoại trước):\n${sessionSummary}\n\nQUAN TRỌNG: Sử dụng tóm tắt này để hiểu ngữ cảnh và ý định của người dùng từ các câu hỏi trước. Kết hợp với recentMessages để có context đầy đủ.\n\n` : ''}${recentMessages ? `NGỮ CẢNH HỘI THOẠI GẦN ĐÂY:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

═══════════════════════════════════════════════════════════════
BƯỚC 1: ĐỌC VÀ HIỂU CONTEXT (BẮT BUỘC - PHẢI LÀM TRƯỚC KHI TẠO SQL)
═══════════════════════════════════════════════════════════════

1. ĐỌC KỸ RAG CONTEXT (nếu có):
   - Đây là schema context được tìm thấy qua vector search, CHÍNH XÁC và PHÙ HỢP với câu hỏi
   - ƯU TIÊN SỬ DỤNG RAG CONTEXT thay vì đoán mò
   - Kiểm tra tên bảng, tên cột trong RAG context trước khi dùng
   - QUAN TRỌNG: Nếu có RELATIONSHIPS HINT trong RAG context, PHẢI sử dụng để hiểu cách JOIN các bảng
     * Ví dụ: "rentals→users(tenant)" nghĩa là JOIN rentals với users qua rentals.tenant_id = users.id
     * Ví dụ: "payments→rentals→users(owner)" nghĩa là JOIN payments → rentals → users, filter theo owner
     * RELATIONSHIPS HINT giúp bạn JOIN đúng các bảng theo mối quan hệ thực tế trong database

2. ĐỌC KỸ COMPLETE SCHEMA (nếu không có RAG context):
   - Schema chứa TẤT CẢ bảng và cột trong database
   - PHẢI kiểm tra schema trước khi dùng bất kỳ tên bảng/cột nào
   - KHÔNG BAO GIỜ đoán mò tên cột - PHẢI kiểm tra trong schema

3. ĐỌC KỸ BUSINESS CONTEXT (nếu có):
   - Business context giải thích nghiệp vụ hệ thống
   - Giúp hiểu rõ cách các bảng liên kết với nhau
   - Giúp hiểu cách người dùng thường query dữ liệu

4. ĐỌC KỸ SECURITY REQUIREMENTS (nếu có):
   - User ID và User Role phải được áp dụng trong WHERE clauses
   - CHỈ query dữ liệu của chính user, KHÔNG query dữ liệu của user khác

5. HIỂU RÕ CÂU HỎI:
   - Câu hỏi yêu cầu gì? (thống kê, tìm kiếm, thông tin người dùng?)
   - Entity nào được đề cập? (rooms, users, bills, payments?)
   - Filters nào được yêu cầu? (quận, giá, thời gian?)

═══════════════════════════════════════════════════════════════
BƯỚC 2: VALIDATION CHECKLIST (BẮT BUỘC - PHẢI KIỂM TRA TRƯỚC KHI TẠO SQL)
═══════════════════════════════════════════════════════════════
${
	filtersHint
		? `
🚨🚨🚨 QUAN TRỌNG CỰC KỲ - FILTERS_HINT TỪ ORCHESTRATOR (BẮT BUỘC PHẢI SỬ DỤNG - KHÔNG BAO GIỜ BỎ QUA):
═══════════════════════════════════════════════════════════════
- Orchestrator đã xác định filter cụ thể: ${filtersHint}
- ĐÂY LÀ YÊU CẦU BẮT BUỘC - PHẢI thêm WHERE clause theo FILTERS_HINT này
- Nếu FILTERS_HINT có "room.slug='...'" hoặc "rooms.slug='...'" → PHẢI có WHERE r.slug = '...'
- Nếu FILTERS_HINT có "room.id='...'" hoặc "rooms.id='...'" → PHẢI có WHERE r.id = '...'
- KHÔNG BAO GIỜ bỏ qua FILTERS_HINT - đây là yêu cầu BẮT BUỘC từ orchestrator
- KHÔNG BAO GIỜ query tất cả phòng khi có FILTERS_HINT - chỉ query 1 phòng cụ thể
- KHÔNG BAO GIỜ dùng LIMIT 100 khi có FILTERS_HINT - chỉ query 1 phòng cụ thể
- Ví dụ: FILTERS_HINT: room.slug='0847505626quan-binh-thanh-phong-30' → WHERE r.slug = '0847505626quan-binh-thanh-phong-30'
- Ví dụ: FILTERS_HINT: rooms.slug='tuyenquan-go-vap-phong-ap1443' → WHERE r.slug = 'tuyenquan-go-vap-phong-ap1443'
- Ví dụ: FILTERS_HINT: rooms.id='uuid-123' → WHERE r.id = 'uuid-123'
- LƯU Ý: FILTERS_HINT có thể dùng "room.slug" hoặc "rooms.slug" - cả hai đều phải parse thành WHERE r.slug = '...'
═══════════════════════════════════════════════════════════════

`
		: ''
}
Trước khi tạo SQL, PHẢI kiểm tra:

1. ✅ TÊN BẢNG: Tên bảng có tồn tại trong schema không?
   - Ví dụ: "rooms" ✅, "room_requests" ✅, "room" ❌, "Rooms" ❌, "room_seeking_posts" ❌ (phải snake_case và đúng tên trong schema)
   - QUAN TRỌNG: Prisma model có thể khác tên bảng thực tế (ví dụ: RoomSeekingPost → room_requests, KHÔNG phải room_seeking_posts)
   - PHẢI kiểm tra tên bảng trong SCHEMA section trước khi dùng

2. ✅ TÊN CỘT: Tên cột có tồn tại trong bảng đó không?
   - Ví dụ: rooms.name ✅, rooms.title ❌ (KHÔNG có column title trong rooms)
   - Nếu cần "title", phải dùng r.name AS title

3. ✅ ENUM VALUES (QUAN TRỌNG - PHẢI DÙNG ĐÚNG):
   - Nhiều cột trong database dùng ENUM type, PHẢI dùng đúng giá trị enum
   - KHÔNG BAO GIỜ đoán mò enum values - PHẢI kiểm tra trong schema/RAG context
   - Enum values là snake_case, lowercase, không có spaces, PHẢI có quotes trong SQL string
   - Các enum quan trọng (theo schema.prisma):
     * room_instances.status: 'available', 'occupied', 'maintenance', 'reserved', 'unavailable'
     * rentals.status: 'active', 'terminated', 'expired', 'pending_renewal'
     * room_bookings.status: 'pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'
     * room_invitations.status: 'pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'
     * bills.status: 'draft', 'pending', 'paid', 'overdue', 'cancelled'
     * payments.payment_type: 'rent', 'deposit', 'utility', 'fee', 'refund'
     * payments.payment_method: 'bank_transfer', 'cash', 'e_wallet', 'card'
     * payments.payment_status: 'pending', 'completed', 'failed', 'refunded'
     * users.role: 'tenant', 'landlord'
     * rooms.room_type: 'boarding_house', 'dormitory', 'sleepbox', 'apartment', 'whole_house'
     * room_requests.status: 'active', 'paused', 'closed', 'expired'
     * roommate_seeking_posts.status: 'draft', 'pending_approval', 'active', 'paused', 'closed', 'expired'
     * roommate_applications.status: 'pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'
   - Ví dụ ĐÚNG: 
     * WHERE ri.status = 'occupied' ✅
     * WHERE b.status = 'paid' ✅
     * WHERE p.payment_status = 'completed' ✅
   - Ví dụ SAI: 
     * WHERE ri.status = 'Occupied' ❌ (sai case - phải lowercase)
     * WHERE ri.status = 'occupied ' ❌ (có space)
     * WHERE ri.status = 'full' ❌ (không phải enum value)
     * WHERE b.status = 'Paid' ❌ (sai case)
     * WHERE p.payment_type = 'Rent' ❌ (sai case)
   - QUAN TRỌNG: Nếu RAG context có enum values, PHẢI dùng đúng values đó

4. ✅ FOREIGN KEYS: JOIN đúng qua FK không?
   - Ví dụ: rooms.building_id = buildings.id ✅
   - KHÔNG join trực tiếp qua tên (ví dụ: rooms.name = buildings.name ❌)

5. ✅ USER QUERY: SQL có đáp ứng đúng câu hỏi không?
   - Nếu hỏi "thống kê" → phải dùng aggregate (SUM, COUNT, AVG)
   - Nếu hỏi "tìm phòng" → phải SELECT danh sách phòng
   - Nếu hỏi "Tôi là gì" → phải SELECT từ users WHERE id = userId

6. ✅ WHERE CLAUSES: Có WHERE clauses đúng cho user authorization không?
   - Nếu user authenticated → PHẢI có WHERE clauses để filter dữ liệu của chính họ
   - Nếu hỏi về thông tin chính họ → PHẢI SELECT từ users WHERE id = userId

7. ✅ LIMIT: Có LIMIT clause không? (trừ aggregate queries)

═══════════════════════════════════════════════════════════════
BƯỚC 3: QUY TẮC TẠO SQL (BẮT BUỘC)
═══════════════════════════════════════════════════════════════

QUY TẮC${userId ? ' BẢO MẬT' : ''}:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. ƯU TIÊN RAG CONTEXT: Nếu có RAG context, ƯU TIÊN sử dụng thông tin từ đó (chính xác hơn)
8. VALIDATE SCHEMA: PHẢI kiểm tra schema trước khi dùng bất kỳ tên bảng/cột nào
   * Table rooms có cột: id, name, description, slug, building_id, floor_number, room_type, area_sqm, max_occupancy, total_rooms, view_count, is_active, created_at, updated_at
   * Table rooms KHÔNG có cột: title, pricing, meta, content, body
   * Nếu cần "title", PHẢI dùng r.name AS title (KHÔNG dùng r.title)
   * Nếu cần "pricing", PHẢI JOIN với room_pricing table${userId ? `\n9. USER AUTHENTICATION: Nếu user hỏi về role/thông tin của chính họ, PHẢI SELECT từ bảng users WHERE id = '${userId}'\n   KHÔNG BAO GIỜ hardcode role như SELECT '${userRole}' AS user_role\n10. WHERE CLAUSES: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ\n11. SENSITIVE DATA: Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role` : ''}

QUY TẮC Ý ĐỊNH, PHỦ ĐỊNH VÀ CHẾ ĐỘ HIỂN THỊ (BẮT BUỘC):
- Phát hiện PHỦ ĐỊNH: "không", "không phải", "ngoài", "trừ" → ánh xạ sang SQL: NOT, <>, NOT ILIKE, NOT EXISTS.
- Ý định CHẾ ĐỘ:
  * Nếu người dùng yêu cầu THỐNG KÊ/VẼ/BIỂU ĐỒ → TẠO SQL AGGREGATE với 2 cột chính:
    - label: nhãn nhóm (ví dụ: quận, tháng)
    - value: số liệu aggregate (COUNT/SUM/AVG...)
    - ORDER BY value DESC LIMIT 10
  * Nếu người dùng yêu cầu DANH SÁCH → TẠO SQL không aggregate (id, name AS title, ...)
- Ý định SỞ HỮU (ví dụ: "tôi đang có phòng", "số dãy trọ mà tôi có"):
  * QUAN TRỌNG: CHỈ tạo SQL khi userId có sẵn (user đã đăng nhập)
  * Nếu userId không có → KHÔNG BAO GIỜ tạo SQL (orchestrator đã phải chặn ở bước trước)
  * Nếu userId có → BẮT BUỘC filter theo owner_id/tenant_id của user
  * Ví dụ: "số dãy trọ mà tôi có" → SELECT COUNT(*) FROM buildings WHERE owner_id = '${userId || 'USER_ID_REQUIRED'}'
- KHI NHẬN ĐƯỢC CANONICAL SQL HINT: 
  * Đây chỉ là SQL từ lần trước, có thể đã lỗi thời nếu schema thay đổi
  * PHẢI regenerate SQL MỚI dựa trên schema HIỆN TẠI trong RAG context
  * CHỈ dùng canonical SQL như tham khảo về cấu trúc/logic, KHÔNG copy y nguyên
  * TUYỆT ĐỐI KHÔNG copy lại literal filter (slug/id/UUID) từ canonical SQL
  * Nếu có FILTERS_HINT → FILTERS_HINT luôn ưu tiên hơn canonical SQL (cannonical chỉ để tham khảo JOIN/SELECT)
  * Nếu schema đã thay đổi (tên bảng/cột, relationships), PHẢI điều chỉnh SQL cho phù hợp
  * PHẢI ĐIỀU CHỈNH theo ý định/polarity/chế độ hiện tại. KHÔNG tái dùng mù quáng.

═══════════════════════════════════════════════════════════════
BƯỚC 4: CÁC TRƯỜNG HỢP ĐẶC BIỆT (BẮT BUỘC)
═══════════════════════════════════════════════════════════════

1. QUERY THÔNG TIN NGƯỜI DÙNG (BẮT BUỘC):
   - Nếu user hỏi về role/thông tin của chính họ (ví dụ: "Tôi là người dùng gì?", "Tôi là landlord hay tenant?", "Thông tin của tôi"):
     * BẮT BUỘC: SELECT từ bảng users WHERE id = '${userId || 'USER_ID'}'
     * KHÔNG BAO GIỜ hardcode role như SELECT 'landlord' AS user_role
     * PHẢI query từ database: SELECT u.role, u.name, u.email, u.phone FROM users u WHERE u.id = '${userId || 'USER_ID'}'
     * Table users có các cột: id, email, name (hoặc first_name, last_name), phone, role (tenant/landlord), avatar_url, created_at, updated_at
     * Ví dụ ĐÚNG:
       -- SELECT u.role AS user_role, u.name, u.email, u.phone FROM users u WHERE u.id = '${userId || 'USER_ID'}' LIMIT 1;
     * Ví dụ SAI (KHÔNG BAO GIỜ LÀM):
       -- SELECT 'landlord' AS user_role LIMIT 1; ❌
       -- SELECT 'tenant' AS user_role LIMIT 1; ❌

2. QUY TẮC LIÊN KẾT VÀ FILTER THEO OWNER (BẮT BUỘC - ĐỌC KỸ):
   
   A. QUY TẮC CHUNG VỀ JOIN:
   - Chỉ join qua cột FK được định nghĩa trong schema. KHÔNG join trực tiếp entity với bảng lookup theo name.
   - Ưu tiên dùng khóa kỹ thuật (id, *_id). Nếu lọc theo tên/label, dùng EXISTS qua bảng quan hệ.
   - Ví dụ ĐÚNG: rooms.building_id = buildings.id ✅
   - Ví dụ SAI: rooms.name = buildings.name ❌ (KHÔNG join qua tên)
   
   B. QUY TẮC XÁC ĐỊNH OWNER CỦA ROOMS/ROOM_INSTANCES (QUAN TRỌNG - BẮT BUỘC TUÂN THEO):
   
   RULE 1: OWNERSHIP CHAIN (theo schema.prisma):
   - Building.ownerId → User (chủ sở hữu tòa nhà)
   - Room.buildingId → Building (phòng thuộc tòa nhà)
   - RoomInstance.roomId → Room (phòng cụ thể thuộc loại phòng)
   - KẾT LUẬN: Owner của RoomInstance = Owner của Building mà Room thuộc về
   - Path: room_instances → rooms → buildings → buildings.owner_id
   
   RULE 2: FILTER THEO OWNER CHO ROOMS/ROOM_INSTANCES (BẮT BUỘC):
   - Khi filter rooms/room_instances theo owner (landlord), PHẢI JOIN theo path trên
   - Công thức BẮT BUỘC:
     * FROM room_instances ri
     * JOIN rooms r ON ri.room_id = r.id
     * JOIN buildings b ON r.building_id = b.id
     * WHERE b.owner_id = '${userId}'
   - Áp dụng cho: thống kê phòng, tỷ lệ lấp đầy, danh sách phòng của owner
   
   RULE 3: KHÔNG BAO GIỜ DÙNG RENTALS ĐỂ FILTER OWNER (QUAN TRỌNG):
   - rentals.owner_id CHỈ là owner của rental contract, KHÔNG phải owner của room
   - SAI: WHERE EXISTS (SELECT 1 FROM rentals ren WHERE ren.owner_id = '${userId}') ❌
   - Lý do SAI:
     * Chỉ tính các phòng ĐÃ CÓ rental (đã được thuê)
     * Bỏ qua các phòng CHƯA CÓ rental (chưa được thuê)
     * Kết quả: Tỷ lệ lấp đầy sai, thống kê thiếu phòng
   - Ví dụ: Owner có 10 phòng, 3 phòng đã thuê, 7 phòng trống
     * Dùng WHERE EXISTS với rentals → chỉ tính 3 phòng → tỷ lệ = 100% (SAI)
     * Dùng JOIN với buildings → tính 10 phòng → tỷ lệ = 30% (ĐÚNG)
   
   RULE 4: TỶ LỆ LẤP ĐẦY PHÒNG (OCCUPANCY RATE):
   - Công thức: occupied_count / total_count
   - occupied_count: COUNT(*) WHERE room_instances.status = 'occupied'
   - total_count: COUNT(*) của TẤT CẢ phòng của owner
   - BẮT BUỘC: Tính TẤT CẢ phòng (JOIN với buildings), không chỉ phòng có rental
   - SQL ĐÚNG:
     SELECT 
       CAST(SUM(CASE WHEN ri.status = 'occupied' THEN 1 ELSE 0 END) AS NUMERIC) / COUNT(ri.id) AS occupancy_rate
     FROM room_instances ri
     JOIN rooms r ON ri.room_id = r.id
     JOIN buildings b ON r.building_id = b.id
     WHERE b.owner_id = '${userId}'
       AND ri.is_active = true
       AND r.is_active = true
       AND b.is_active = true;
   
   RULE 5: KHI NÀO DÙNG RENTALS:
   - rentals CHỈ dùng khi query về:
     * Thống kê doanh thu (payments JOIN rentals)
     * Danh sách hợp đồng thuê (rentals table)
     * Hóa đơn (bills JOIN rentals)
   - KHÔNG dùng rentals để filter rooms/room_instances theo owner
   
   C. QUY TẮC VỀ ENUM VALUES (BẮT BUỘC - THEO SCHEMA.PRISMA):
   - Nhiều cột trong database dùng ENUM type, PHẢI dùng đúng giá trị enum
   - Enum values là snake_case, lowercase, không có spaces, PHẢI có quotes trong SQL string
   - PHẢI kiểm tra enum values trong schema/RAG context trước khi dùng
   - Các enum quan trọng thường dùng (theo schema.prisma):
     * room_instances.status: 'available', 'occupied', 'maintenance', 'reserved', 'unavailable'
     * rentals.status: 'active', 'terminated', 'expired', 'pending_renewal'
     * room_bookings.status: 'pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'
     * room_invitations.status: 'pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'
     * bills.status: 'draft', 'pending', 'paid', 'overdue', 'cancelled'
     * payments.payment_type: 'rent', 'deposit', 'utility', 'fee', 'refund'
     * payments.payment_method: 'bank_transfer', 'cash', 'e_wallet', 'card'
     * payments.payment_status: 'pending', 'completed', 'failed', 'refunded'
     * users.role: 'tenant', 'landlord'
     * rooms.room_type: 'boarding_house', 'dormitory', 'sleepbox', 'apartment', 'whole_house'
     * room_requests.status: 'active', 'paused', 'closed', 'expired'
     * roommate_seeking_posts.status: 'draft', 'pending_approval', 'active', 'paused', 'closed', 'expired'
     * roommate_applications.status: 'pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation'
   - Ví dụ ĐÚNG: 
     * WHERE ri.status = 'occupied' ✅
     * WHERE b.status = 'paid' ✅
     * WHERE p.payment_status = 'completed' AND p.payment_type = 'rent' ✅
   - Ví dụ SAI: 
     * WHERE ri.status = 'Occupied' ❌ (sai case - phải lowercase)
     * WHERE ri.status = 'occupied ' ❌ (có space)
     * WHERE ri.status = 'full' ❌ (không phải enum value)
     * WHERE ri.status = occupied ❌ (thiếu quotes)
     * WHERE b.status = 'Paid' ❌ (sai case)
     * WHERE p.payment_type = 'Rent' ❌ (sai case)
   - QUAN TRỌNG: Nếu RAG context có enum values, PHẢI dùng đúng values đó
   - LƯU Ý: bill_items.item_type là String (không phải enum), có thể là: 'rent', 'utility', 'service', 'other'
   
   D. MẪU ĐÚNG KHI FILTER THEO NAME:
   - Room Rules by name
   - SELECT r.* FROM rooms r
   - WHERE EXISTS (
   -   SELECT 1 FROM room_rules rr
   -   JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
   -   WHERE rr.room_id = r.id AND rrt.name = 'Không hút thuốc trong phòng'
   - ) LIMIT ${limit};

═══════════════════════════════════════════════════════════════
BƯỚC 5: VÍ DỤ SQL MẪU (THAM KHẢO)
═══════════════════════════════════════════════════════════════

1. Tìm phòng theo quận/huyện (ví dụ "Gò Vấp") và giá rẻ:
   -- SELECT r.id, r.name AS title, b.name AS building_name, rp.base_price_monthly, 'room' AS entity
   -- FROM rooms r
   -- JOIN buildings b ON b.id = r.building_id
   -- JOIN districts d ON d.id = b.district_id
   -- LEFT JOIN room_pricing rp ON rp.room_id = r.id
   -- WHERE d.district_name ILIKE '%gò vấp%'
   --   AND r.is_active = true
   -- ORDER BY rp.base_price_monthly ASC NULLS LAST
   -- LIMIT ${limit};

2. Tỷ lệ lấp đầy phòng của owner (landlord) - VÍ DỤ ĐÚNG:
   -- SELECT 
   --   CAST(SUM(CASE WHEN ri.status = 'occupied' THEN 1 ELSE 0 END) AS NUMERIC) / COUNT(ri.id) AS occupancy_rate
   -- FROM room_instances ri
   -- JOIN rooms r ON ri.room_id = r.id
   -- JOIN buildings b ON r.building_id = b.id
   -- WHERE b.owner_id = '${userId}'
   --   AND ri.is_active = true
   --   AND r.is_active = true
   --   AND b.is_active = true;
   -- QUAN TRỌNG: JOIN với buildings để filter owner, KHÔNG dùng WHERE EXISTS với rentals

3. Thống kê phòng của owner (landlord) - VÍ DỤ ĐÚNG:
   -- SELECT COUNT(*) AS total_rooms, 
   --        SUM(CASE WHEN ri.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_rooms
   -- FROM room_instances ri
   -- JOIN rooms r ON ri.room_id = r.id
   -- JOIN buildings b ON r.building_id = b.id
   -- WHERE b.owner_id = '${userId}'
   --   AND ri.is_active = true;

4. PHÂN BIỆT LOẠI CÂU HỎI (BẮT BUỘC):
   - THỐNG KÊ/HÓA ĐƠN/REVENUE (từ khóa: thống kê, hóa đơn, doanh thu, revenue, invoice, tổng, theo tháng/năm, top):
     * Dùng aggregate functions: SUM(), COUNT(), AVG(), MAX(), MIN()
     * GROUP BY theo nhóm (ví dụ: theo tháng, theo loại, theo trạng thái)
     * SELECT: label (nhóm), value (số liệu aggregate), alias rõ ràng: label, value
     * ORDER BY value DESC
     * LIMIT 10
     * KHÔNG trả về danh sách phòng/bài đăng chi tiết
     * Ví dụ: SELECT DATE_TRUNC('month', created_at) AS label, SUM(amount) AS value FROM invoices GROUP BY label ORDER BY value DESC LIMIT 10;
   
   - PHÂN TÍCH/ĐÁNH GIÁ PHÒNG HIỆN TẠI (từ khóa: "phân tích phòng hiện tại", "phòng này", "phòng đang xem", "đánh giá phòng này", "so sánh phòng này", "phòng này có hợp lý không"):
     * QUAN TRỌNG: Khi có FILTERS_HINT với slug hoặc id từ currentPageContext (ví dụ: rooms.slug='tuyenquan-go-vap-phong-ap1443' hoặc rooms.id='uuid-123')
     * PHẢI query chi tiết phòng CỤ THỂ theo slug hoặc id, KHÔNG phải tất cả phòng của landlord
     * "Đánh giá" nghĩa là PHÂN TÍCH về giá cả, tiện ích, điện nước rác - KHÔNG phải về rating (sao đánh giá)
     * BẮT BUỘC: Nếu có FILTERS_HINT từ orchestrator → PHẢI dùng WHERE clause theo FILTERS_HINT, KHÔNG BAO GIỜ bỏ qua
     * SELECT TẤT CẢ thông tin chi tiết để phân tích và đánh giá:
       - Thông tin phòng: r.id, r.name, r.description, r.slug, r.room_type, r.area_sqm, r.max_occupancy, r.total_rooms
       - Thông tin tòa nhà: b.name AS building_name, b.address_line_1, b.address_line_2
       - Địa chỉ: d.district_name, p.province_name
       - Giá cả (QUAN TRỌNG - ƯU TIÊN): rp.base_price_monthly, rp.deposit_amount, rp.utility_cost_per_person, rp.electricity_cost, rp.water_cost, rp.internet_cost, rp.cleaning_cost
       - Tiện ích (QUAN TRỌNG - ƯU TIÊN): Danh sách amenities với tên đầy đủ (cần JOIN với room_amenities và amenities)
       - Rating (KHÔNG QUAN TRỌNG - chỉ lấy nếu có): r.overall_rating, r.total_ratings (có thể NULL)
     * JOIN với các bảng: buildings, districts, provinces, room_pricing, amenities, room_amenities
     * WHERE clause (BẮT BUỘC từ FILTERS_HINT, KHÔNG filter theo owner_id):
       - Nếu FILTERS_HINT có rooms.slug='...' → WHERE r.slug = 'slug_value' (BẮT BUỘC)
       - Nếu FILTERS_HINT có rooms.id='...' → WHERE r.id = 'id_value' (BẮT BUỘC)
       - Ưu tiên slug nếu có, fallback về id
       - KHÔNG BAO GIỜ query tất cả phòng khi có FILTERS_HINT - chỉ query 1 phòng cụ thể
     * KHÔNG cần LIMIT (chỉ 1 phòng)
     * KHÔNG filter theo buildings.owner_id (vì đây là query phòng cụ thể công khai, không phải dữ liệu cá nhân)
     * ƯU TIÊN: Tập trung vào giá cả (base_price_monthly, utility_cost_per_person, electricity_cost, water_cost) và tiện ích (amenities)
     * Ví dụ với slug: SELECT r.id, r.name, r.description, r.slug, r.room_type, r.area_sqm, r.max_occupancy, r.total_rooms, b.name AS building_name, b.address_line_1, d.district_name, p.province_name, rp.base_price_monthly, rp.deposit_amount, rp.utility_cost_per_person, rp.electricity_cost, rp.water_cost, rp.internet_cost, rp.cleaning_cost, array_agg(DISTINCT a.name ORDER BY a.name) AS amenities FROM rooms r JOIN buildings b ON r.building_id = b.id JOIN districts d ON b.district_id = d.id JOIN provinces p ON b.province_id = p.id LEFT JOIN room_pricing rp ON rp.room_id = r.id LEFT JOIN room_amenities ra ON ra.room_id = r.id LEFT JOIN amenities a ON a.id = ra.amenity_id WHERE r.slug = 'tuyenquan-go-vap-phong-ap1443' GROUP BY r.id, b.id, d.id, p.id, rp.id;
     * Ví dụ với id: SELECT r.id, r.name, r.description, r.slug, r.room_type, r.area_sqm, r.max_occupancy, r.total_rooms, b.name AS building_name, b.address_line_1, d.district_name, p.province_name, rp.base_price_monthly, rp.deposit_amount, rp.utility_cost_per_person, rp.electricity_cost, rp.water_cost, rp.internet_cost, rp.cleaning_cost, array_agg(DISTINCT a.name ORDER BY a.name) AS amenities FROM rooms r JOIN buildings b ON r.building_id = b.id JOIN districts d ON b.district_id = d.id JOIN provinces p ON b.province_id = p.id LEFT JOIN room_pricing rp ON rp.room_id = r.id LEFT JOIN room_amenities ra ON ra.room_id = r.id LEFT JOIN amenities a ON a.id = ra.amenity_id WHERE r.id = '02a927ba-c5e4-40e3-a64c-0187c9b35e33' GROUP BY r.id, b.id, d.id, p.id, rp.id;
   
   - TÌM KIẾM DANH SÁCH (từ khóa: tìm, phòng, room, bài đăng, post, ở, gần):
     * QUAN TRỌNG: Trong schema, table rooms có cột name (KHÔNG phải title). Phải dùng r.name AS title.
     * Chỉ SELECT các trường gọn nhẹ: id, name AS title (KHÔNG dùng title trực tiếp, phải alias), thumbnail_url/image_url (nếu có)
     * BẮT BUỘC: Bổ sung constant column: 'room' AS entity (cho rooms), 'post' AS entity (cho posts), hoặc 'room_seeking_post' AS entity (cho room_requests)
     * QUAN TRỌNG: Bảng room_requests (RoomSeekingPost) - KHÔNG phải room_seeking_posts! Tên bảng thực tế là "room_requests"
     * Path sẽ được backend tự động thêm từ entity + id. KHÔNG cần SELECT path.
     * KHÔNG SELECT: description, content, body, hay bất kỳ trường text dài nào
     * LIMIT ${Math.max(1, Math.min(50, limit))}
     * Ví dụ ĐÚNG (rooms): SELECT r.id, r.name AS title, ri.room_number, rp.base_price_monthly, 'room' AS entity FROM rooms r LEFT JOIN room_instances ri ON ri.room_id = r.id LEFT JOIN room_pricing rp ON rp.room_id = r.id WHERE r.is_active = true LIMIT ${Math.max(1, Math.min(50, limit))};
     * Ví dụ ĐÚNG (room_requests): SELECT rr.id, rr.title, rr.min_budget, rr.max_budget, 'room_seeking_post' AS entity FROM room_requests rr WHERE rr.status = 'active' LIMIT ${Math.max(1, Math.min(50, limit))};
     * Ví dụ SAI: SELECT r.id, r.title, ... ❌ (KHÔNG có column title trong rooms table!)
     * Ví dụ SAI: SELECT * FROM room_seeking_posts ... ❌ (Tên bảng sai! Phải dùng room_requests)

5. ALIAS NHẤT QUÁN (BẮT BUỘC):
   - title: cho tiêu đề (phải alias từ name)
   - thumbnail: cho ảnh
   - url: cho liên kết
   - entity: cho loại (room/post/room_seeking_post)
   - label: cho nhóm (thống kê)
   - value: cho số liệu (thống kê)

6. KHÔNG TRẢ VỀ DỮ LIỆU NHẠY CẢM:
   - Tuyệt đối không trả về password, token, hay dữ liệu nhạy cảm khác
   - CHỈ trả về dữ liệu cần thiết để trả lời câu hỏi

${
	filtersHint
		? `
═══════════════════════════════════════════════════════════════
KIỂM TRA CUỐI CÙNG - FILTERS_HINT (BẮT BUỘC):
═══════════════════════════════════════════════════════════════
TRƯỚC KHI TRẢ VỀ SQL, PHẢI KIỂM TRA:
1. ✅ SQL có WHERE clause theo FILTERS_HINT: ${filtersHint} không?
2. ✅ Nếu FILTERS_HINT có slug → SQL phải có WHERE r.slug = 'slug_value'
3. ✅ Nếu FILTERS_HINT có id → SQL phải có WHERE r.id = 'id_value'
4. ✅ KHÔNG có LIMIT 100 khi có FILTERS_HINT (chỉ query 1 phòng cụ thể)
5. ✅ KHÔNG query tất cả phòng khi có FILTERS_HINT
6. ✅ Nếu SQL có slug/id literal KHÁC với FILTERS_HINT (ví dụ bị dính canonical SQL) → SQL SAI, PHẢI thay bằng FILTERS_HINT

NẾU SQL KHÔNG CÓ WHERE clause theo FILTERS_HINT → SQL SAI, PHẢI SỬA LẠI!

═══════════════════════════════════════════════════════════════
`
		: ''
}
SQL:`;
}
