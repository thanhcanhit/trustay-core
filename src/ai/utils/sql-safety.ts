/**
 * SQL Safety utilities - Enforce LIMIT and allow-list tables
 * Simple regex-based validation for MVP (có thể nâng cấp với AST parser sau)
 */

/**
 * Allowed tables for SQL queries (allow-list)
 */
const ALLOWED_TABLES = [
	'users',
	'buildings',
	'rooms',
	'rentals',
	'bills',
	'payments',
	'room_bookings',
	'notifications',
	'districts',
	'amenities',
	'cost_type_templates',
	'room_rule_templates',
	'room_seeking_posts',
	'room_pricing',
	'room_amenities',
	'room_costs',
	'room_rules',
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

	// Check 4: Allow-list tables
	const tableMatches = sql.match(/FROM\s+(\w+)/gi);
	if (tableMatches) {
		const usedTables = tableMatches.map((match) =>
			match
				.replace(/FROM\s+/i, '')
				.toLowerCase()
				.trim(),
		);
		const disallowedTables = usedTables.filter((table) => !ALLOWED_TABLES.includes(table));
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
	const sqlUpper = sqlTrimmed.toUpperCase();

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
