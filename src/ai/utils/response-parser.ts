/**
 * Response parser utility - Parse response text with ---END delimiter
 */

export interface ParsedResponse {
	message: string;
	list: any[] | null;
	table: any | null;
	chart: any | null;
}

/**
 * Parse response text according to ---END pattern
 * Format: message text ---END LIST: [] TABLE: {} CHART: {}
 * @param responseText - Full response text with ---END delimiter
 * @returns Parsed response with message and structured data
 */
export function parseResponseText(responseText: string): ParsedResponse {
	const endIndex = responseText.indexOf('---END');
	if (endIndex === -1) {
		// No ---END delimiter found, return entire text as message
		return {
			message: responseText.trim(),
			list: null,
			table: null,
			chart: null,
		};
	}

	// Extract message (before ---END)
	const message = responseText.substring(0, endIndex).trim();

	// Extract structured data (after ---END)
	const dataSection = responseText.substring(endIndex + 6).trim(); // +6 for "---END"

	// Parse LIST, TABLE, CHART - using regex to match each section
	let list: any[] | null = null;
	let table: any | null = null;
	let chart: any | null = null;

	// Parse LIST - match "LIST: " followed by JSON or "null"
	const listMatch = dataSection.match(/LIST:\s*(.+?)(?=\n(?:TABLE:|CHART:)|$)/s);
	if (listMatch) {
		const listValue = listMatch[1].trim();
		if (listValue !== 'null' && listValue !== '') {
			try {
				list = JSON.parse(listValue);
			} catch (error) {
				// If parsing fails, log warning but continue
				console.warn('Failed to parse LIST as JSON:', error);
			}
		}
	}

	// Parse TABLE - match "TABLE: " followed by JSON or "null"
	const tableMatch = dataSection.match(/TABLE:\s*(.+?)(?=\n(?:LIST:|CHART:)|$)/s);
	if (tableMatch) {
		const tableValue = tableMatch[1].trim();
		if (tableValue !== 'null' && tableValue !== '') {
			try {
				table = JSON.parse(tableValue);
			} catch (error) {
				console.warn('Failed to parse TABLE as JSON:', error);
			}
		}
	}

	// Parse CHART - match "CHART: " followed by JSON or "null"
	const chartMatch = dataSection.match(/CHART:\s*(.+?)(?=\n(?:LIST:|TABLE:)|$)/s);
	if (chartMatch) {
		const chartValue = chartMatch[1].trim();
		if (chartValue !== 'null' && chartValue !== '') {
			try {
				chart = JSON.parse(chartValue);
			} catch (error) {
				console.warn('Failed to parse CHART as JSON:', error);
			}
		}
	}

	return {
		message,
		list,
		table,
		chart,
	};
}
