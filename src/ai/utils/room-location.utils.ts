import {
	BuildingCandidate,
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

/**
 * Chuẩn hóa địa chỉ từ các format viết tắt sang format chuẩn
 * Ví dụ: "Q9, HCM" -> "Quận 9, Hồ Chí Minh"
 * Mục đích: Tăng tỷ lệ tìm được ID khi lookup
 */
export function normalizeLocationText(locationText: string): string {
	if (!locationText || locationText.trim().length === 0) {
		return locationText;
	}

	let normalized = locationText.trim();

	// Chuẩn hóa Quận/Huyện: Q1, Q.1, Q 1, q1 -> Quận 1
	normalized = normalized.replace(/\b[Qq]\.?\s*(\d+)\b/g, (_match, num) => {
		return `Quận ${num}`;
	});

	// Chuẩn hóa HCM, TP.HCM, TP HCM -> Hồ Chí Minh hoặc Thành phố Hồ Chí Minh
	normalized = normalized.replace(/\b(TP\.?\s*)?HCM\b/gi, 'Hồ Chí Minh');

	// Chuẩn hóa các thành phố phổ biến
	const cityMappings: Record<string, string> = {
		HN: 'Hà Nội',
		DN: 'Đà Nẵng',
		CT: 'Cần Thơ',
		HP: 'Hải Phòng',
		BD: 'Bình Dương',
		KH: 'Khánh Hòa',
		LA: 'Long An',
		AG: 'An Giang',
		'BR-VT': 'Bà Rịa - Vũng Tàu',
		BRVT: 'Bà Rịa - Vũng Tàu',
	};

	for (const [abbrev, fullName] of Object.entries(cityMappings)) {
		const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
		normalized = normalized.replace(regex, fullName);
	}

	// Chuẩn hóa viết hoa chữ cái đầu cho các từ khóa địa chỉ
	normalized = normalized.replace(/\b(quận|huyện|thành phố|tỉnh|phường|xã)\s+/gi, (match) => {
		return `${match.charAt(0).toUpperCase()}${match.slice(1).toLowerCase()} `;
	});

	// Chuẩn hóa "Đường" nếu thiếu
	normalized = normalized.replace(/\b(đ|đường)\s+([A-Z][a-zàáảãạâăêôơưđ]+)/gi, 'Đường $2');

	// Loại bỏ khoảng trắng thừa
	normalized = normalized.replace(/\s+/g, ' ').trim();

	return normalized;
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
		cacheKey: hints.rawText ? normalizeText(hints.rawText) : undefined,
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

export function buildOwnerBuildingLookupSql(
	userId: string,
	keyword: string,
	limit: number = 5,
): string {
	const normalizedKeyword = normalizeText(keyword);
	const safeKeyword = normalizedKeyword ? normalizedKeyword.replace(SQL_QUOTE, "''") : '';
	return `
SELECT 
	b.id,
	b.name,
	b.slug,
	b.address_line1,
	b.ward_id,
	b.district_id,
	b.province_id,
	d.name AS district_name,
	p.name AS province_name,
	0.8 AS match_score
FROM building b
LEFT JOIN district d ON d.id = b.district_id
LEFT JOIN province p ON p.id = b.province_id
WHERE b.owner_id = '${userId}'
	AND (
		LOWER(b.name) LIKE '%${safeKeyword}%'
		OR LOWER(COALESCE(b.address_line1, '')) LIKE '%${safeKeyword}%'
	)
ORDER BY b.updated_at DESC
LIMIT ${limit};
`.trim();
}

export function mapBuildingCandidates(rows: Array<Record<string, any>>): BuildingCandidate[] {
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		slug: row.slug,
		addressLine1: row.address_line1,
		wardId: row.ward_id,
		districtId: row.district_id,
		provinceId: row.province_id,
		districtName: row.district_name,
		provinceName: row.province_name,
		matchScore: typeof row.match_score === 'number' ? row.match_score : undefined,
	}));
}
