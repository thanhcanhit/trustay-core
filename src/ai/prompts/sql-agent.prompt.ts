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
	lastError?: string;
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
		lastError = '',
		attempt = 1,
		limit,
	} = params;

	// Build error context
	const errorContext = lastError
		? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax${userId ? '\n- Include proper WHERE clauses for user authorization' : ''}

`
		: '';

	// Build security context if authenticated - let AI generate WHERE clauses
	let securityContext = '';
	if (userId && userRole) {
		securityContext = `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- BẮT BUỘC: Phải thêm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
- Quy tắc WHERE clauses theo role và loại dữ liệu:
  * Nếu query về bills/hóa đơn:
    - tenant: WHERE rentals.tenant_id = '${userId}' (và JOIN với rentals)
    - landlord: WHERE rentals.owner_id = '${userId}' (và JOIN với rentals)
  * Nếu query về payments/thanh toán: WHERE payments.payer_id = '${userId}'
  * Nếu query về rentals/thuê:
    - tenant: WHERE rentals.tenant_id = '${userId}'
    - landlord: WHERE rentals.owner_id = '${userId}'
  * Nếu query về buildings/tòa nhà (landlord): WHERE buildings.owner_id = '${userId}'
  * Nếu query về bookings/đặt phòng: WHERE room_bookings.tenant_id = '${userId}'
- Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role
- CHỈ landlords mới được truy cập statistics/thống kê
- CHỈ landlords mới được tạo/quản lý rooms

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
		? `Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Dựa vào ${ragContext ? 'ngữ cảnh schema (từ vector search)' : 'schema database'}, ngữ cảnh nghiệp vụ${businessContext ? ' (từ Orchestrator Agent)' : ''}, ngữ cảnh hội thoại${userId ? ', ngữ cảnh người dùng' : ''} và câu hỏi, hãy tạo câu lệnh SQL chính xác và AN TOÀN.`
		: `Bạn là chuyên gia SQL PostgreSQL. Dựa vào ${ragContext ? 'ngữ cảnh schema (từ vector search)' : 'schema database'}, ngữ cảnh nghiệp vụ${businessContext ? ' (từ Orchestrator Agent)' : ''}${recentMessages ? ', ngữ cảnh hội thoại' : ''} và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.`;

	return `${role}

${schemaSection}${businessContextSection}${securityContext}${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC${userId ? ' BẢO MẬT' : ''}:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. KIỂM TRA KỸ TÊN CỘT TRONG SCHEMA TRƯỚC KHI SỬ DỤNG - QUAN TRỌNG:
   * Table rooms có cột name (KHÔNG có title). Phải dùng r.name AS title khi cần.
   * Table rooms có cột description (KHÔNG có content hay body).
   * Table rooms KHÔNG có cột: title, pricing, meta, content, body.
   * Chỉ dùng các cột có trong schema. Nếu cần alias (như title), phải alias từ cột thực tế (name).${userId ? '\n8. QUAN TRỌNG: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ\n9. Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role' : ''}${recentMessages || ragContext ? '\n10. Xem xét ngữ cảnh hội thoại và RAG context để hiểu rõ ý định người dùng' : ''}

QUY TẮC LIÊN KẾT (BẮT BUỘC):
- Chỉ join qua cột FK được định nghĩa trong schema. KHÔNG join trực tiếp entity với bảng lookup theo name.
- Ưu tiên dùng khóa kỹ thuật (id, *_id). Nếu lọc theo tên/label, dùng EXISTS qua bảng quan hệ.
- Mẫu đúng:
  -- Room Rules by name
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_rules rr
  --   JOIN room_rule_templates rrt ON rrt.id = rr.rule_template_id
  --   WHERE rr.room_id = r.id AND rrt.name = 'Không hút thuốc trong phòng'
  -- ) LIMIT ${limit};
  -- Amenities by name_en
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_amenities ra
  --   JOIN amenities a ON a.id = ra.amenity_id
  --   WHERE ra.room_id = r.id AND a.name_en = 'wifi'
  -- ) LIMIT ${limit};
  -- Room Costs by cost type template
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_costs rc
  --   JOIN cost_type_templates ctt ON ctt.id = rc.cost_type_template_id
  --   WHERE rc.room_id = r.id AND ctt.name_en = 'electricity'
  -- ) LIMIT ${limit};

MẸO THỰC THI TRUY VẤN PHỔ BIẾN:
- Lọc theo quận/huyện (ví dụ "Gò Vấp") và giá rẻ:
  -- SELECT r.* , b.name AS building_name, rp.base_price_monthly
  -- FROM rooms r
  -- JOIN buildings b ON b.id = r.building_id
  -- JOIN districts d ON d.id = b.district_id
  -- LEFT JOIN room_pricing rp ON rp.room_id = r.id
  -- WHERE d.district_name ILIKE '%gò vấp%'
  --   AND r.is_active = true
  -- ORDER BY rp.base_price_monthly ASC NULLS LAST
  -- LIMIT ${limit};
- QUAN TRỌNG: Khi không chắc bảng/column tồn tại, chọn cột từ schema thực (rooms/buildings/room_pricing).
- Table rooms có cột: id, name, description, slug, building_id, floor_number, room_type, area_sqm, max_occupancy, total_rooms, view_count, is_active, created_at, updated_at.
- Table rooms KHÔNG có cột: title, pricing, meta, content, body.
- Nếu cần "title", phải dùng r.name AS title (KHÔNG dùng r.title vì không tồn tại).

YÊU CẦU TRUY VẤN DỮ LIỆU (BẮT BUỘC):
1. Phân biệt loại câu hỏi:
   - THỐNG KÊ/HÓA ĐƠN/REVENUE (từ khóa: thống kê, hóa đơn, doanh thu, revenue, invoice, tổng, theo tháng/năm, top):
     * Dùng aggregate functions: SUM(), COUNT(), AVG(), MAX(), MIN()
     * GROUP BY theo nhóm (ví dụ: theo tháng, theo loại, theo trạng thái)
     * SELECT: label (nhóm), value (số liệu aggregate), alias rõ ràng: label, value
     * ORDER BY value DESC
     * LIMIT 10
     * KHÔNG trả về danh sách phòng/bài đăng chi tiết
     * Ví dụ: SELECT DATE_TRUNC('month', created_at) AS label, SUM(amount) AS value FROM invoices GROUP BY label ORDER BY value DESC LIMIT 10;
   
   - TÌM KIẾM DANH SÁCH (từ khóa: tìm, phòng, room, bài đăng, post, ở, gần):
     * QUAN TRỌNG: Trong schema, table rooms có cột name (KHÔNG phải title). Phải dùng r.name AS title.
     * Chỉ SELECT các trường gọn nhẹ: id, name AS title (KHÔNG dùng title trực tiếp, phải alias), thumbnail_url/image_url (nếu có)
     * BẮT BUỘC: Bổ sung constant column: 'room' AS entity (cho rooms), 'post' AS entity (cho posts), hoặc 'room_seeking_post' AS entity (cho room_seeking_posts)
     * Path sẽ được backend tự động thêm từ entity + id. KHÔNG cần SELECT path.
     * KHÔNG SELECT: description, content, body, hay bất kỳ trường text dài nào
     * LIMIT ${Math.max(1, Math.min(50, limit))}
     * Ví dụ ĐÚNG: SELECT r.id, r.name AS title, ri.room_number, rp.base_price_monthly, 'room' AS entity FROM rooms r LEFT JOIN room_instances ri ON ri.room_id = r.id LEFT JOIN room_pricing rp ON rp.room_id = r.id WHERE r.is_active = true LIMIT ${Math.max(1, Math.min(50, limit))};
     * Ví dụ SAI: SELECT r.id, r.title, ... (KHÔNG có column title trong rooms table!)

2. Luôn dùng alias nhất quán: title cho tiêu đề, thumbnail cho ảnh, url cho liên kết, entity cho loại, label cho nhóm, value cho số liệu.

3. Tuyệt đối không trả về dữ liệu nhạy cảm hoặc không cần thiết.

SQL:`;
}
