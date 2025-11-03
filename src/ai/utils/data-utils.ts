import { EntityType, ListItem, TableCell, TableColumn } from '../types/chat.types';
import { buildQuickChartUrl } from '../utils/chart';
import { buildEntityPath } from '../utils/entity-route';

export function isListLike(rows: ReadonlyArray<Record<string, unknown>>): boolean {
	const sample = rows[0] ?? {};
	const keys = Object.keys(sample).map((k) => k.toLowerCase());
	const hasTitle = keys.some((k) => ['title', 'name'].includes(k));
	const hasUrlOrImage = keys.some((k) =>
		['url', 'link', 'href', 'image', 'imageurl', 'thumbnail'].includes(k),
	);
	const hasEntityId = keys.includes('id') && keys.includes('entity');
	return hasTitle && (hasUrlOrImage || hasEntityId);
}

export function toListItems(rows: ReadonlyArray<Record<string, unknown>>): ListItem[] {
	return rows.map((r) => toListItem(r));
}

export function toListItem(row: Record<string, unknown>): ListItem {
	const obj = toLowerKeys(row);
	const rawId = (obj.id as unknown) ?? (obj.slug as unknown) ?? (obj.uuid as unknown) ?? '';
	const id = String(rawId ?? '').trim();
	const entityExplicit = (obj.entity as EntityType | undefined) ?? undefined;
	// MVP: Infer entity from id pattern or explicit entity
	let inferredEntity: EntityType | undefined = entityExplicit;
	if (!inferredEntity && id) {
		// Infer entity from slug pattern or default to 'room'
		if (id.includes('room-seeking') || id.includes('tìm-phòng')) {
			inferredEntity = 'room_seeking_post';
		} else if (id.includes('post') || id.includes('bài-đăng')) {
			inferredEntity = 'post';
		} else {
			// Default to 'room' for most cases (rooms are most common)
			inferredEntity = 'room';
		}
	}
	const path = inferredEntity && id ? buildEntityPath(inferredEntity, id) : undefined;
	const extUrl =
		(obj.url as string | undefined) ??
		(obj.link as string | undefined) ??
		(obj.href as string | undefined);
	const imageUrl =
		(obj.imageurl as string | undefined) ??
		(obj.image as string | undefined) ??
		(obj.thumbnail as string | undefined);
	return {
		id:
			id ||
			(obj.uuid as string | undefined) ||
			(obj.slug as string | undefined) ||
			String(Math.random()).slice(2),
		title: String(obj.title ?? obj.name ?? 'Untitled'),
		description: obj.description ? String(obj.description) : undefined,
		thumbnailUrl: imageUrl,
		entity: inferredEntity,
		path,
		externalUrl: extUrl,
	};
}

export function toLowerKeys(obj: Record<string, unknown>): Record<string, unknown> {
	return Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
		acc[k.toLowerCase()] = v;
		return acc;
	}, {});
}

export function inferColumns(rows: ReadonlyArray<Record<string, unknown>>): TableColumn[] {
	const sample = rows[0] ?? {};
	return Object.keys(sample).map((key) => {
		const v = (sample as Record<string, unknown>)[key];
		const type: TableColumn['type'] =
			typeof v === 'number'
				? 'number'
				: v instanceof Date
					? 'date'
					: typeof v === 'boolean'
						? 'boolean'
						: /url|link|href/i.test(key)
							? 'url'
							: /image|thumbnail/i.test(key)
								? 'image'
								: 'string';
		return { key, label: key, type };
	});
}

export function normalizeRows(
	rows: ReadonlyArray<Record<string, unknown>>,
	columns: ReadonlyArray<TableColumn>,
): ReadonlyArray<Record<string, TableCell>> {
	return rows.map((row) =>
		columns.reduce<Record<string, TableCell>>((acc, c) => {
			const v = row[c.key];
			if (v === null || v === undefined) {
				acc[c.key] = null;
				return acc;
			}
			if (c.type === 'date') {
				acc[c.key] = v instanceof Date ? v.toISOString() : String(v);
				return acc;
			}
			if (c.type === 'number') {
				acc[c.key] = Number(v);
				return acc;
			}
			if (c.type === 'boolean') {
				acc[c.key] = Boolean(v);
				return acc;
			}
			acc[c.key] = String(v);
			return acc;
		}, {}),
	);
}

export function toLabel(key: string): string {
	return key
		.replace(/_/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\s+/g, ' ')
		.replace(/^./, (s) => s.toUpperCase());
}

export function selectImportantColumns(
	columns: ReadonlyArray<TableColumn>,
	rows: ReadonlyArray<Record<string, unknown>>,
): TableColumn[] {
	const PRIORITY_KEYS = [
		'id',
		'name',
		'title',
		'price',
		'area',
		'count',
		'total',
		'created_at',
		'createdAt',
		'updated_at',
		'updatedAt',
		'room',
		'post',
		'url',
		'link',
		'href',
	];
	const MAX_COLUMNS = 8;
	const isNonEmpty = (key: string): boolean =>
		rows
			.slice(0, 50)
			.some((r) => r[key] !== null && r[key] !== undefined && String(r[key]).trim() !== '');
	const primitiveColumns = columns.filter((c) => {
		const v = rows[0]?.[c.key];
		const t = typeof v;
		return v === null || v === undefined || t === 'string' || t === 'number' || t === 'boolean';
	});
	const nonEmpty = primitiveColumns.filter((c) => isNonEmpty(c.key));
	const prioritized = [
		...nonEmpty.filter((c) => PRIORITY_KEYS.includes(c.key)),
		...nonEmpty.filter((c) => !PRIORITY_KEYS.includes(c.key)),
	];
	return prioritized.slice(0, MAX_COLUMNS);
}

export function tryBuildChart(
	rows: ReadonlyArray<Record<string, unknown>>,
): { url: string; width: number; height: number } | null {
	if (rows.length === 0) {
		return null;
	}
	const sample = rows[0];
	const keys = Object.keys(sample);
	const isNumericLike = (v: unknown): boolean => {
		if (typeof v === 'number') return true;
		if (typeof v === 'string') {
			const n = Number(v);
			return Number.isFinite(n);
		}
		return false;
	};
	const numericKeys = keys.filter((k) => isNumericLike((sample as Record<string, unknown>)[k]));
	if (numericKeys.length === 0) {
		return null;
	}
	const labelKey =
		keys.find((k) => /name|title|label|category/i.test(k)) ??
		keys.find((k) => !numericKeys.includes(k));
	if (!labelKey) {
		return null;
	}
	const valueKey = numericKeys[0];
	const statLike = keys.some((k) => /count|sum|avg|total|min|max/i.test(k));
	const numericRatio = numericKeys.length / Math.max(keys.length, 1);
	if (!statLike && numericRatio < 0.6) {
		return null;
	}
	const pairs = rows.map((r) => {
		const raw = (r as Record<string, unknown>)[valueKey];
		const num = typeof raw === 'number' ? raw : Number(raw);
		return {
			label: String((r as Record<string, unknown>)[labelKey] ?? ''),
			value: Number.isFinite(num) ? num : 0,
		};
	});
	pairs.sort((a, b) => b.value - a.value);
	const top = pairs.slice(0, 10);
	const labels: string[] = top.map((p) => p.label);
	const data: number[] = top.map((p) => p.value);
	const { url, width, height } = buildQuickChartUrl({
		labels,
		datasetLabel: toLabel(valueKey),
		data,
		type: 'bar',
		width: 800,
		height: 400,
	});
	return { url, width, height };
}
