/**
 * SQL Safety utilities - Enforce read-only queries and security constraints
 */
export class SqlSafety {
	/**
	 * Enforce SELECT-only queries and add LIMIT if missing
	 * @param sql - SQL query string
	 * @param maxLimit - Maximum allowed limit (default: 200)
	 * @returns Sanitized SQL query
	 */
	static enforceReadOnly(sql: string, maxLimit: number = 200): string {
		let cleaned = sql.trim();

		// Remove trailing semicolons for parsing
		if (cleaned.endsWith(';')) {
			cleaned = cleaned.slice(0, -1).trim();
		}

		// Convert to lowercase for checking
		const sqlLower = cleaned.toLowerCase();

		// Deny DDL/DML operations
		const dangerousKeywords = [
			'drop',
			'delete',
			'update',
			'insert',
			'alter',
			'create',
			'truncate',
			'grant',
			'revoke',
			'exec',
			'execute',
		];

		for (const keyword of dangerousKeywords) {
			if (sqlLower.includes(keyword)) {
				throw new Error(`Dangerous SQL operation detected: ${keyword.toUpperCase()}`);
			}
		}

		// Must start with SELECT
		if (!sqlLower.startsWith('select')) {
			throw new Error('Only SELECT queries are allowed for security reasons');
		}

		// Check for LIMIT clause
		const hasLimit = /\blimit\s+\d+/i.test(cleaned);
		const hasTop = /\btop\s+\d+/i.test(cleaned);

		if (!hasLimit && !hasTop) {
			// Add LIMIT if missing
			cleaned = `${cleaned} LIMIT ${maxLimit}`;
		} else {
			// Enforce max limit
			cleaned = cleaned.replace(/\blimit\s+(\d+)/gi, (match, limit) => {
				const limitNum = parseInt(limit, 10);
				return `LIMIT ${Math.min(limitNum, maxLimit)}`;
			});
			cleaned = cleaned.replace(/\btop\s+(\d+)/gi, (match, limit) => {
				const limitNum = parseInt(limit, 10);
				return `TOP ${Math.min(limitNum, maxLimit)}`;
			});
		}

		// Prevent multiple statements
		const statementCount = (cleaned.match(/;/g) || []).length;
		if (statementCount > 0) {
			throw new Error('Multiple SQL statements are not allowed');
		}

		// Prevent SQL injection patterns
		const injectionPatterns = [/--/g, /\/\*/g, /\*\//g, /;/g, /union.*select/gi, /exec\s*\(/gi];

		const testSql = cleaned.toLowerCase();
		if (/union.*select/gi.test(testSql) && !sqlLower.includes('union all select')) {
			// Allow UNION ALL SELECT but warn about UNION SELECT
			SqlSafety.logWarning('Potential SQL injection pattern detected: UNION SELECT');
		}

		return cleaned;
	}

	/**
	 * Validate SQL query for execution
	 * @param sql - SQL query string
	 * @returns Validation result
	 */
	static validateQuery(sql: string): { isValid: boolean; error?: string } {
		try {
			SqlSafety.enforceReadOnly(sql);
			return { isValid: true };
		} catch (error) {
			return { isValid: false, error: error.message };
		}
	}

	/**
	 * Extract table names from SQL query
	 * @param sql - SQL query string
	 * @returns Array of table names
	 */
	static extractTableNames(sql: string): string[] {
		const tableRegex = /\bfrom\s+(\w+)/gi;
		const joinRegex = /\bjoin\s+(\w+)/gi;
		const tables: string[] = [];

		let match;
		while ((match = tableRegex.exec(sql)) !== null) {
			tables.push(match[1].toLowerCase());
		}
		while ((match = joinRegex.exec(sql)) !== null) {
			tables.push(match[1].toLowerCase());
		}

		return [...new Set(tables)];
	}

	/**
	 * Check if query accesses sensitive tables
	 * @param sql - SQL query string
	 * @param sensitiveTables - Array of sensitive table names
	 * @returns True if query accesses sensitive tables
	 */
	static accessesSensitiveTables(
		sql: string,
		sensitiveTables: string[] = ['users', 'payments', 'bills'],
	): boolean {
		const accessedTables = SqlSafety.extractTableNames(sql);
		return accessedTables.some((table) => sensitiveTables.includes(table.toLowerCase()));
	}

	private static logWarning(message: string): void {
		// In production, use proper logger
		if (process.env.NODE_ENV !== 'production') {
			console.warn(`[SqlSafety] ${message}`);
		}
	}
}
