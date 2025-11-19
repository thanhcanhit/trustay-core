import {
	LocationLookupInstruction,
	LocationResolutionResult,
} from '../types/room-publishing.types';

const DISTRICT_PATTERN = /(quận|quan|huyện|huyen|q\.?|district)\s+([0-9a-záàảãạâăêôơưđ\s]+)/i;
const PROVINCE_PATTERN = /(tỉnh|tinh|tp|thành phố|city)\s+([0-9a-záàảãạâăêôơưđ\s]+)/i;
const SQL_QUOTE = /'/g;

function escapeSqlLike(value: string): string {
	return value.replace(SQL_QUOTE, "''");
}

export function normalizeText(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

export function extractLocationHints(freeformText: string): {
	districtKeyword?: string;
	provinceKeyword?: string;
	rawText: string;
} {
	const normalized = normalizeText(freeformText);
	const districtMatch = normalized.match(DISTRICT_PATTERN);
	const provinceMatch = normalized.match(PROVINCE_PATTERN);
	return {
		districtKeyword: districtMatch ? districtMatch[2].trim() : undefined,
		provinceKeyword: provinceMatch ? provinceMatch[2].trim() : undefined,
		rawText: freeformText,
	};
}

export function buildLocationLookupInstruction(freeformText: string): LocationLookupInstruction {
	const hints = extractLocationHints(freeformText);
	const whereClauses: string[] = [];
	if (hints.districtKeyword) {
		whereClauses.push(`LOWER(d.name_unsigned) LIKE '%${escapeSqlLike(hints.districtKeyword)}%'`);
	}
	if (hints.provinceKeyword) {
		whereClauses.push(`LOWER(p.name_unsigned) LIKE '%${escapeSqlLike(hints.provinceKeyword)}%'`);
	}
	const sql = `
SELECT 
	d.id AS district_id,
	d.name AS district_name,
	d.province_id AS province_id,
	p.name AS province_name
FROM district d
JOIN province p ON p.id = d.province_id
${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
ORDER BY d.population DESC
LIMIT 5;
`.trim();
	return {
		normalizedDistrict: hints.districtKeyword,
		normalizedProvince: hints.provinceKeyword,
		sql,
	};
}

export function resolveLocationFromRow(row: {
	district_id?: number;
	province_id?: number;
	ward_id?: number;
	district_name?: string;
	province_name?: string;
	confidence_score?: number;
}): LocationResolutionResult {
	const confidence = row.confidence_score ?? 0.7;
	const explanation = `Matched ${row.district_name ?? 'district'} - ${row.province_name ?? 'province'}`;
	return {
		wardId: row.ward_id,
		districtId: row.district_id,
		provinceId: row.province_id,
		confidence,
		explanation,
	};
}
