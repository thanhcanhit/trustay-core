/**
 * SQL Safety utilities - Enforce LIMIT and allow-list tables
 * Simple regex-based validation for MVP (có thể nâng cấp với AST parser sau)
 */

/**
 * Allowed tables for SQL queries (allow-list)
 * Danh sách đầy đủ các bảng từ schema.prisma để đảm bảo AI có thể query tất cả dữ liệu cần thiết
 */
const ALLOWED_TABLES = [
	// User Management
	'users',
	'verification_codes',
	'refresh_tokens',
	'user_addresses',
	// Building & Room Management
	'buildings',
	'rooms',
	'room_instances', // QUAN TRỌNG: Bảng này cần thiết cho queries về occupancy rate, rentals
	'room_images',
	'room_pricing',
	'room_amenities',
	'room_costs',
	'room_rules',
	'room_instance_meter_readings', // Đồng hồ điện/nước cho từng phòng cụ thể
	// Room Rules & Amenities & Costs Templates
	'room_rule_templates',
	'amenities',
	'cost_type_templates',
	// Booking & Rental Management
	'room_bookings',
	'room_invitations',
	'rentals',
	// Billing & Payment
	'bills',
	'bill_items',
	'payments',
	// Rating & Reviews
	'ratings',
	// Room Request (Bài đăng tìm trọ)
	'room_requests',
	// Roommate Seeking System
	'roommate_seeking_posts',
	'roommate_applications',
	// Tenant Preferences
	'tenant_room_preferences',
	'tenant_roommate_preferences',
	// Chat & Messaging
	'conversations',
	'messages',
	'message_attachments',
	// Electronic Contract System
	'contracts',
	'contract_signatures',
	'contract_audit_logs',
	// System & Notifications
	'notifications',
	'error_logs',
	// Location Tables
	'provinces',
	'districts',
	'wards',
];

/**
 * Denied SQL keywords (DDL/DML operations)
 */
const DENIED_KEYWORDS = [
	'DELETE',
	'UPDATE',
	'INSERT',
	'DROP',
	'ALTER',
	'CREATE',
	'TRUNCATE',
	'GRANT',
	'REVOKE',
	'EXECUTE',
	'EXEC',
	'CALL',
];

/**
 * SQL safety validation result
 */
export interface SqlSafetyResult {
	isValid: boolean;
	violations: string[];
	enforcedSql?: string; // SQL with enforced LIMIT if needed
}

/**
 * Validate SQL query for safety
 * @param sql - SQL query to validate
 * @param isAggregate - Whether this is an aggregate query (GROUP BY, COUNT, SUM, etc.)
 * @returns Safety validation result
 */
export function validateSqlSafety(sql: string, isAggregate: boolean = false): SqlSafetyResult {
	const violations: string[] = [];
	const sqlUpper = sql.toUpperCase().trim();

	// Check 1: Must be SELECT only
	if (!sqlUpper.startsWith('SELECT')) {
		violations.push('Query must be SELECT only');
		return { isValid: false, violations };
	}

	// Check 2: Deny DDL/DML keywords
	for (const keyword of DENIED_KEYWORDS) {
		if (sqlUpper.includes(` ${keyword} `) || sqlUpper.includes(`\n${keyword} `)) {
			violations.push(`Query contains disallowed keyword: ${keyword}`);
			return { isValid: false, violations };
		}
	}

	// Check 3: Deny SELECT * (except in subqueries or specific cases)
	const hasSelectStar = /SELECT\s+\*\s+FROM/i.test(sql);
	if (hasSelectStar && !isAggregate) {
		// Allow SELECT * only in subqueries or aggregate contexts
		const isInSubquery = /SELECT\s+\*\s+FROM.*\)/i.test(sql);
		if (!isInSubquery) {
			violations.push('Query contains SELECT * (use explicit columns)');
		}
	}

	// Check 4: Allow-list tables (parse FROM and JOIN clauses)
	// Parse tables from FROM, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, FULL JOIN
	const tablePatterns = [/FROM\s+(\w+)/gi, /(?:LEFT|RIGHT|INNER|FULL)?\s*JOIN\s+(\w+)/gi];
	const usedTables = new Set<string>();
	for (const pattern of tablePatterns) {
		const matches = sql.match(pattern);
		if (matches) {
			for (const match of matches) {
				// Extract table name (handle aliases like "table_name alias" or "table_name AS alias")
				const tableName = match
					.replace(/(?:FROM|LEFT|RIGHT|INNER|FULL)?\s*JOIN\s+/i, '')
					.replace(/FROM\s+/i, '')
					.split(/\s+/)[0] // Take first word (table name before alias)
					.toLowerCase()
					.trim();
				if (tableName && !tableName.match(/^(on|using|where|group|order|having|limit)$/i)) {
					usedTables.add(tableName);
				}
			}
		}
	}
	if (usedTables.size > 0) {
		const disallowedTables = Array.from(usedTables).filter(
			(table) => !ALLOWED_TABLES.includes(table),
		);
		if (disallowedTables.length > 0) {
			violations.push(`Query contains disallowed tables: ${disallowedTables.join(', ')}`);
		}
	}

	// Check 5: Enforce LIMIT for non-aggregate queries
	const hasLimit = /LIMIT\s+\d+/i.test(sql);
	if (!isAggregate && !hasLimit) {
		// Auto-enforce LIMIT 50 for non-aggregate queries
		const enforcedSql = enforceLimit(sql, 50);
		if (violations.length === 0) {
			// Only return enforced SQL if no other violations
			return { isValid: true, violations: [], enforcedSql };
		}
	}

	if (violations.length > 0) {
		return { isValid: false, violations };
	}

	return { isValid: true, violations: [] };
}

/**
 * Enforce LIMIT clause on SQL query
 * @param sql - SQL query
 * @param limit - Limit value to enforce
 * @returns SQL with LIMIT clause added
 */
export function enforceLimit(sql: string, limit: number): string {
	const sqlTrimmed = sql.trim();

	// Remove existing LIMIT if present
	const withoutLimit = sqlTrimmed.replace(/\s+LIMIT\s+\d+(\s*;)?$/i, '').trim();

	// Add LIMIT at the end
	const hasSemicolon = withoutLimit.endsWith(';');
	const baseSql = hasSemicolon ? withoutLimit.slice(0, -1).trim() : withoutLimit;

	return `${baseSql} LIMIT ${limit}${hasSemicolon ? ';' : ''}`;
}

/**
 * Detect if SQL is an aggregate query
 * @param sql - SQL query
 * @returns True if query contains aggregate functions
 */
export function isAggregateQuery(sql: string): boolean {
	const sqlUpper = sql.toUpperCase();
	const aggregatePatterns = [
		/\bCOUNT\(/,
		/\bSUM\(/,
		/\bAVG\(/,
		/\bMAX\(/,
		/\bMIN\(/,
		/\bGROUP\s+BY\b/,
		/\bHAVING\b/,
	];

	return aggregatePatterns.some((pattern) => pattern.test(sqlUpper));
}
