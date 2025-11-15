/**
 * SQL Safety utilities - Enforce LIMIT and allow-list tables
 * Uses AST parser (node-sql-parser) for accurate SQL parsing and validation
 */
import { AST, Parser } from 'node-sql-parser';

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

// Note: DENIED_KEYWORDS removed - now using AST parser to detect operations
// AST parser can accurately detect UNION, DELETE, UPDATE, INSERT, etc. from AST node types

/**
 * Dangerous PostgreSQL functions that should be blocked
 */
const DENIED_FUNCTIONS = [
	'pg_read_file',
	'pg_ls_dir',
	'pg_read_binary_file',
	'pg_execute',
	'lo_import',
	'lo_export',
	'pg_stat_file',
];

/**
 * System schema patterns that should be blocked
 */
const DENIED_SCHEMA_PATTERNS = [
	/information_schema\./i,
	/pg_catalog\./i,
	/pg_/i, // All PostgreSQL system tables (pg_shadow, pg_user, etc.)
];

/**
 * PostgreSQL functions/constants to ignore when parsing table names
 * These are not tables, so should not be validated against allow-list
 */
const POSTGRES_FUNCTIONS_AND_CONSTANTS = [
	'current_date',
	'current_time',
	'current_timestamp',
	'now',
	'date_trunc',
	'extract',
	'date_part',
	'coalesce',
	'nullif',
	'case',
	'cast',
	'to_char',
	'to_date',
	'to_timestamp',
	'age',
	'interval',
	'generate_series',
	'array_agg',
	'string_agg',
	'json_agg',
	'jsonb_agg',
	'unnest',
	'array',
	'row',
	'values',
];

/**
 * SQL safety validation result
 */
export interface SqlSafetyResult {
	isValid: boolean;
	violations: string[];
	enforcedSql?: string; // SQL with enforced LIMIT if needed
	sanitizedSql?: string; // SQL after stripping comments
}

/**
 * SQL Parser instance
 */
const parser = new Parser();

/**
 * Strip SQL comments to prevent comment-based injection attacks
 * @param sql - SQL query
 * @returns SQL without comments
 */
function stripSqlComments(sql: string): string {
	return sql
		.replace(/--[^\n]*/g, '') // Remove -- comments
		.replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
		.trim();
}

/**
 * Extract all table names from SQL AST
 * Recursively traverses AST to find all table references
 * @param ast - SQL AST node
 * @param tables - Set to collect table names
 */
function extractTablesFromAST(ast: AST | AST[], tables: Set<string>): void {
	if (!ast) {
		return;
	}
	if (Array.isArray(ast)) {
		ast.forEach((node) => extractTablesFromAST(node, tables));
		return;
	}
	const node = ast as any;
	// Extract table from FROM clause (table type)
	if (node.type === 'table') {
		if (typeof node.table === 'string') {
			const tableName = node.table.toLowerCase();
			// Remove schema prefix if present (e.g., "schema.table" -> "table")
			const tableWithoutSchema = tableName.split('.').pop() || tableName;
			if (
				tableWithoutSchema &&
				!tableWithoutSchema.startsWith('(') &&
				tableWithoutSchema !== 'select'
			) {
				tables.add(tableWithoutSchema);
			}
		} else if (node.table && typeof node.table === 'object') {
			// Recursive if table is an object (subquery)
			extractTablesFromAST(node.table, tables);
		}
	}
	// Extract table from JOIN clauses
	if (node.type === 'join') {
		if (node.table) {
			if (typeof node.table === 'string') {
				const tableName = node.table.toLowerCase();
				const tableWithoutSchema = tableName.split('.').pop() || tableName;
				if (tableWithoutSchema && !tableWithoutSchema.startsWith('(')) {
					tables.add(tableWithoutSchema);
				}
			} else if (typeof node.table === 'object') {
				extractTablesFromAST(node.table, tables);
			}
		}
	}
	// Extract tables from WITH clause (CTE)
	if (node.type === 'with') {
		if (Array.isArray(node.value)) {
			node.value.forEach((cte: any) => {
				if (cte.stmt) {
					extractTablesFromAST(cte.stmt, tables);
				}
			});
		} else if (node.value) {
			extractTablesFromAST(node.value, tables);
		}
	}
	// Extract tables from SELECT statements (including subqueries)
	if (node.type === 'select') {
		if (node.from) {
			extractTablesFromAST(node.from, tables);
		}
	}
	// Extract tables from UNION/INTERSECT/EXCEPT
	if (node.type === 'union' || node.type === 'except' || node.type === 'intersect') {
		if (node.left) {
			extractTablesFromAST(node.left, tables);
		}
		if (node.right) {
			extractTablesFromAST(node.right, tables);
		}
	}
	// Recursively process all object children
	Object.keys(node).forEach((key) => {
		if (key !== 'type' && typeof node[key] === 'object' && node[key] !== null) {
			extractTablesFromAST(node[key], tables);
		}
	});
}

/**
 * Extract all function names from SQL AST
 * @param ast - SQL AST node
 * @param functions - Set to collect function names
 */
function extractFunctionsFromAST(ast: AST | AST[], functions: Set<string>): void {
	if (!ast) {
		return;
	}
	if (Array.isArray(ast)) {
		ast.forEach((node) => extractFunctionsFromAST(node, functions));
		return;
	}
	const node = ast as any;
	// Extract function calls
	if (node.type === 'function' && node.name) {
		const funcName = node.name.toLowerCase();
		functions.add(funcName);
	}
	// Recursively process all children
	Object.keys(node).forEach((key) => {
		if (key !== 'type' && typeof node[key] === 'object') {
			extractFunctionsFromAST(node[key], functions);
		}
	});
}

/**
 * Check if AST contains denied keywords/operations
 * @param ast - SQL AST node
 * @returns Array of violations
 */
function checkDeniedOperations(ast: AST | AST[]): string[] {
	const violations: string[] = [];
	if (!ast) {
		return violations;
	}
	if (Array.isArray(ast)) {
		ast.forEach((node) => violations.push(...checkDeniedOperations(node)));
		return violations;
	}
	const node = ast as any;
	// Check for UNION, INTERSECT, EXCEPT
	if (node.type === 'union' || node.type === 'except' || node.type === 'intersect') {
		violations.push(`Query contains disallowed set operation: ${node.type.toUpperCase()}`);
	}
	// Check for DELETE, UPDATE, INSERT
	if (node.type === 'delete' || node.type === 'update' || node.type === 'insert') {
		violations.push(`Query contains disallowed operation: ${node.type.toUpperCase()}`);
	}
	// Recursively check children
	Object.keys(node).forEach((key) => {
		if (key !== 'type' && typeof node[key] === 'object') {
			violations.push(...checkDeniedOperations(node[key]));
		}
	});
	return violations;
}

/**
 * Validate SQL query for safety
 * @param sql - SQL query to validate
 * @param isAggregate - Whether this is an aggregate query (GROUP BY, COUNT, SUM, etc.)
 * @returns Safety validation result
 */
export function validateSqlSafety(sql: string, isAggregate: boolean = false): SqlSafetyResult {
	const violations: string[] = [];

	// Step 0: Strip comments first to prevent comment-based injection
	const sanitizedSql = stripSqlComments(sql);
	const sqlUpper = sanitizedSql.toUpperCase().trim();

	// Check 1: Must be SELECT only (check first statement only)
	// Handle multiple statements separated by semicolons
	const firstStatement = sqlUpper.split(';')[0].trim();
	if (!firstStatement.startsWith('SELECT')) {
		violations.push('Query must be SELECT only');
		return { isValid: false, violations, sanitizedSql };
	}

	// Check 1.5: Only allow single SELECT statement (no multiple statements)
	if (sanitizedSql.split(';').filter((s) => s.trim().length > 0).length > 1) {
		violations.push('Multiple statements are not allowed');
		return { isValid: false, violations, sanitizedSql };
	}

	// Step 2: Parse SQL using AST parser
	let ast: AST | AST[];
	try {
		const parseResult = parser.astify(sanitizedSql, { database: 'PostgreSQL' });
		ast = parseResult;
	} catch (error) {
		// If parsing fails, fallback to regex-based validation
		violations.push(`Invalid SQL syntax: ${(error as Error).message}`);
		return { isValid: false, violations, sanitizedSql };
	}

	// Check 2: Check for denied operations using AST
	const deniedOps = checkDeniedOperations(ast);
	if (deniedOps.length > 0) {
		violations.push(...deniedOps);
		return { isValid: false, violations, sanitizedSql };
	}

	// Check 2.5: Extract and validate functions using AST
	const usedFunctions = new Set<string>();
	extractFunctionsFromAST(ast, usedFunctions);
	for (const func of usedFunctions) {
		if (DENIED_FUNCTIONS.includes(func)) {
			violations.push(`Query contains disallowed function: ${func}`);
			return { isValid: false, violations, sanitizedSql };
		}
	}

	// Check 2.6: Deny system schemas (information_schema, pg_catalog, pg_*)
	// Check in original SQL (before stripping) to catch schema prefixes
	for (const pattern of DENIED_SCHEMA_PATTERNS) {
		if (pattern.test(sql)) {
			violations.push('Access to system schemas is not allowed');
			return { isValid: false, violations, sanitizedSql };
		}
	}

	// Check 3: Warn about SELECT * but don't block (allow for flexibility)
	// SELECT * is allowed but not recommended - we'll just log a warning
	// This allows normal operations while still encouraging best practices
	const hasSelectStar = /SELECT\s+\*\s+FROM/i.test(sanitizedSql);
	if (hasSelectStar && !isAggregate) {
		// Allow SELECT * - just log warning, don't block
		// This is more permissive for normal operations
		// Note: In production, you might want to log this for monitoring
	}

	// Check 4: Extract and validate tables using AST (more accurate than regex)
	const usedTables = new Set<string>();
	extractTablesFromAST(ast, usedTables);
	// Filter out PostgreSQL functions/constants that might be parsed as tables
	const validTables = Array.from(usedTables).filter(
		(table) => !POSTGRES_FUNCTIONS_AND_CONSTANTS.includes(table),
	);
	if (validTables.length > 0) {
		const disallowedTables = validTables.filter((table) => !ALLOWED_TABLES.includes(table));
		if (disallowedTables.length > 0) {
			violations.push(`Query contains disallowed tables: ${disallowedTables.join(', ')}`);
		}
	}

	// Check 5: Enforce LIMIT for non-aggregate queries
	const hasLimit = /\bLIMIT\s+\d+/i.test(sanitizedSql);
	if (!isAggregate && !hasLimit) {
		// Auto-enforce LIMIT 50 for non-aggregate queries
		const enforcedSql = enforceLimit(sanitizedSql, 50);
		if (violations.length === 0) {
			// Only return enforced SQL if no other violations
			return { isValid: true, violations: [], enforcedSql, sanitizedSql };
		}
	}

	if (violations.length > 0) {
		return { isValid: false, violations, sanitizedSql };
	}

	return { isValid: true, violations: [], sanitizedSql };
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
