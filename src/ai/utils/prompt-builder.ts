import { SecurityHelper } from './security-helper';

/**
 * AI Configuration interface
 */
export interface AiConfig {
	temperature: number;
	maxTokens: number;
	limit: number;
	model: string;
}

/**
 * Builder for SQL generation prompts
 */
export class PromptBuilder {
	/**
	 * Build secure contextual SQL prompt with conversation history, user context and security
	 * @param query - User query
	 * @param schema - Database schema
	 * @param recentMessages - Recent conversation messages
	 * @param userId - User ID
	 * @param userRole - User role
	 * @param aiConfig - AI configuration
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted secure contextual prompt
	 */
	static buildSecureContextualSqlPrompt(
		query: string,
		schema: string,
		recentMessages: string,
		userId: string,
		userRole: string,
		aiConfig: AiConfig,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax
- Include proper WHERE clauses for user authorization

`
			: '';
		const userWhereClauses = SecurityHelper.generateUserWhereClauses(userId, userRole, query);
		const securityContext = userWhereClauses
			? `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- MANDATORY WHERE clauses: ${userWhereClauses}
- ALWAYS include these WHERE clauses to ensure user can only access their own data
- For sensitive data (bills, payments, rentals), user can ONLY see their own records

`
			: '';
		return `
Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Dựa vào schema database, ngữ cảnh hội thoại, ngữ cảnh người dùng và câu hỏi, hãy tạo câu lệnh SQL chính xác và AN TOÀN.

${schema}

${securityContext}${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC BẢO MẬT:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${aiConfig.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng
8. QUAN TRỌNG: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
9. Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role
10. Xem xét ngữ cảnh hội thoại để hiểu rõ ý định người dùng

SQL:`;
	}

	/**
	 * Build contextual SQL prompt with conversation history and error context
	 * @param query - User query
	 * @param schema - Database schema
	 * @param recentMessages - Recent conversation messages
	 * @param aiConfig - AI configuration
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted contextual prompt
	 */
	static buildContextualSqlPrompt(
		query: string,
		schema: string,
		recentMessages: string,
		aiConfig: AiConfig,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax

`
			: '';
		return `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào schema database, ngữ cảnh hội thoại và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${schema}

${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${aiConfig.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng

SQL:`;
	}

	/**
	 * Build secure SQL prompt with user context and security
	 * @param query - User query
	 * @param schema - Database schema
	 * @param userId - User ID
	 * @param userRole - User role
	 * @param aiConfig - AI configuration
	 * @param lastError - Previous error
	 * @param attempt - Current attempt
	 * @returns Enhanced prompt with security context
	 */
	static buildSecureSqlPrompt(
		query: string,
		schema: string,
		userId: string,
		userRole: string,
		aiConfig: AiConfig,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax
- Include proper WHERE clauses for user authorization

`
			: '';
		const userWhereClauses = SecurityHelper.generateUserWhereClauses(userId, userRole, query);
		const securityContext = userWhereClauses
			? `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- MANDATORY WHERE clauses: ${userWhereClauses}
- ALWAYS include these WHERE clauses to ensure user can only access their own data
- For sensitive data (bills, payments, rentals), user can ONLY see their own records

`
			: '';
		return `
Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Dựa vào schema database, ngữ cảnh người dùng và câu hỏi, hãy tạo câu lệnh SQL chính xác và AN TOÀN.

${schema}

${securityContext}${errorContext}Câu hỏi người dùng: "${query}"

QUY TẮC BẢO MẬT:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${aiConfig.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng
8. QUAN TRỌNG: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
9. Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role

SQL:`;
	}

	/**
	 * Build SQL generation prompt with error context (for anonymous users)
	 * @param query - User query
	 * @param schema - Database schema
	 * @param aiConfig - AI configuration
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted prompt
	 */
	static buildSqlPrompt(
		query: string,
		schema: string,
		aiConfig: AiConfig,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax

`
			: '';
		return `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào schema database và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${schema}

${errorContext}Câu hỏi người dùng: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${aiConfig.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng

SQL:`;
	}

	/**
	 * Build secure contextual SQL prompt with RAG context
	 * @param query - User query
	 * @param schema - Database schema (fallback)
	 * @param recentMessages - Recent conversation messages
	 * @param userId - User ID
	 * @param userRole - User role
	 * @param aiConfig - AI configuration
	 * @param ragContext - RAG retrieved context
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted secure contextual prompt with RAG
	 */
	static buildSecureContextualSqlPromptWithRAG(
		query: string,
		schema: string,
		recentMessages: string,
		userId: string,
		userRole: string,
		aiConfig: AiConfig,
		ragContext: string,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax
- Include proper WHERE clauses for user authorization

`
			: '';
		const userWhereClauses = SecurityHelper.generateUserWhereClauses(userId, userRole, query);
		const securityContext = userWhereClauses
			? `
SECURITY REQUIREMENTS:
- User ID: ${userId}
- User Role: ${userRole}
- MANDATORY WHERE clauses: ${userWhereClauses}
- ALWAYS include these WHERE clauses to ensure user can only access their own data
- For sensitive data (bills, payments, rentals), user can ONLY see their own records

`
			: '';
		const ragSection = ragContext ? `${ragContext}\n` : `COMPLETE DATABASE SCHEMA:\n${schema}\n\n`;
		return `
Bạn là chuyên gia SQL PostgreSQL với trách nhiệm bảo mật cao. Dựa vào ngữ cảnh schema (từ vector search), ngữ cảnh hội thoại, ngữ cảnh người dùng và câu hỏi, hãy tạo câu lệnh SQL chính xác và AN TOÀN.

${ragSection}${securityContext}${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC BẢO MẬT:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${aiConfig.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng
8. QUAN TRỌNG: Luôn bao gồm WHERE clauses để đảm bảo user chỉ truy cập dữ liệu của chính họ
9. Đối với dữ liệu nhạy cảm (bills, payments, rentals), BẮT BUỘC phải có WHERE clauses theo user role
10. Xem xét ngữ cảnh hội thoại và RAG context để hiểu rõ ý định người dùng

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
  -- ) LIMIT ${aiConfig.limit};
  -- Amenities by name_en
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_amenities ra
  --   JOIN amenities a ON a.id = ra.amenity_id
  --   WHERE ra.room_id = r.id AND a.name_en = 'wifi'
  -- ) LIMIT ${aiConfig.limit};
  -- Room Costs by cost type template
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_costs rc
  --   JOIN cost_type_templates ctt ON ctt.id = rc.cost_type_template_id
  --   WHERE rc.room_id = r.id AND ctt.name_en = 'electricity'
  -- ) LIMIT ${aiConfig.limit};

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
  -- LIMIT ${aiConfig.limit};
- Khi không chắc bảng/column tồn tại, chọn cột từ schema thực (rooms/buildings/room_pricing) và tránh cột không có như title, pricing, meta.

SQL:`;
	}

	/**
	 * Build contextual SQL prompt with RAG context (for anonymous users)
	 * @param query - User query
	 * @param schema - Database schema (fallback)
	 * @param recentMessages - Recent conversation messages
	 * @param aiConfig - AI configuration
	 * @param ragContext - RAG retrieved context
	 * @param lastError - Previous error message
	 * @param attempt - Current attempt number
	 * @returns Formatted contextual prompt with RAG
	 */
	static buildContextualSqlPromptWithRAG(
		query: string,
		schema: string,
		recentMessages: string,
		aiConfig: AiConfig,
		ragContext: string,
		lastError: string = '',
		attempt: number = 1,
	): string {
		const errorContext = lastError
			? `
PREVIOUS ERROR (Attempt ${attempt - 1}):
${lastError}

Please fix the SQL query based on this error. Common issues:
- Column names are snake_case (not camelCase)
- Use proper table aliases
- Check foreign key relationships
- Verify column existence in schema
- Use correct JOIN syntax

`
			: '';
		const ragSection = ragContext ? `${ragContext}\n` : `COMPLETE DATABASE SCHEMA:\n${schema}\n\n`;
		return `
Bạn là chuyên gia SQL PostgreSQL. Dựa vào ngữ cảnh schema (từ vector search), ngữ cảnh hội thoại và câu hỏi của người dùng, hãy tạo câu lệnh SQL chính xác.

${ragSection}${recentMessages ? `NGỮ CẢNH HỘI THOẠI:\n${recentMessages}\n\n` : ''}

${errorContext}Câu hỏi hiện tại: "${query}"

QUY TẮC:
1. Chỉ trả về câu lệnh SQL, không giải thích
2. Sử dụng PostgreSQL syntax
3. Chỉ sử dụng SELECT (không DELETE, UPDATE, INSERT)
4. Sử dụng JOIN khi cần thiết
5. Thêm LIMIT ${aiConfig.limit} để tránh quá nhiều kết quả
6. Sử dụng snake_case cho tên cột và bảng
7. Kiểm tra kỹ tên cột trong schema trước khi sử dụng
8. Xem xét ngữ cảnh hội thoại và RAG context để hiểu rõ ý định người dùng

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
  -- ) LIMIT ${aiConfig.limit};
  -- Amenities by name_en
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_amenities ra
  --   JOIN amenities a ON a.id = ra.amenity_id
  --   WHERE ra.room_id = r.id AND a.name_en = 'wifi'
  -- ) LIMIT ${aiConfig.limit};
  -- Room Costs by cost type template
  -- SELECT r.* FROM rooms r
  -- WHERE EXISTS (
  --   SELECT 1 FROM room_costs rc
  --   JOIN cost_type_templates ctt ON ctt.id = rc.cost_type_template_id
  --   WHERE rc.room_id = r.id AND ctt.name_en = 'electricity'
  -- ) LIMIT ${aiConfig.limit};

MẸO TRUY VẤN PHỔ BIẾN:
- "giá rẻ" => ORDER BY room_pricing.base_price_monthly ASC NULLS LAST
- Lọc theo quận/huyện tên (ví dụ "Gò Vấp"):
  -- SELECT r.* , b.name AS building_name, rp.base_price_monthly
  -- FROM rooms r
  -- JOIN buildings b ON b.id = r.building_id
  -- JOIN districts d ON d.id = b.district_id
  -- LEFT JOIN room_pricing rp ON rp.room_id = r.id
  -- WHERE d.district_name ILIKE '%gò vấp%'
  --   AND r.is_active = true
  -- ORDER BY rp.base_price_monthly ASC NULLS LAST
  -- LIMIT ${aiConfig.limit};

SQL:`;
	}
}
