import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseVectorStoreService } from '../vector-store/supabase-vector-store.service';
import { AiChunkCollection } from '../vector-store/types/vector.types';

/**
 * Service to ingest database schema from information_schema into vector store
 */
@Injectable()
export class SchemaIngestionService {
	private readonly logger = new Logger(SchemaIngestionService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly vectorStore: SupabaseVectorStoreService,
	) {}

	/**
	 * Ingest complete database schema from information_schema
	 * Creates chunks for tables, columns, constraints, and relationships
	 */
	async ingestSchemaFromDatabase(
		tenantId: string,
		dbKey: string,
		schemaName: string = 'public',
	): Promise<number[]> {
		this.logger.log(`Starting schema ingestion for tenant: ${tenantId}, db: ${dbKey}`);
		// Ensure only one truth: clear existing 'schema' collection for this tenant/db
		try {
			const deleted = await this.vectorStore.deleteChunksByCollection(
				'schema' as AiChunkCollection,
			);
			this.logger.log(`Cleared existing schema chunks: ${deleted}`);
		} catch (clearErr) {
			this.logger.warn('Failed to clear existing schema chunks before ingestion', clearErr);
		}

		const chunks: string[] = [];

		// Get all tables
		const tables = await this.getTables(schemaName);

		// Process each table
		for (const table of tables) {
			// Get columns for this table
			const columns = await this.getTableColumns(schemaName, table.table_name);
			// Get foreign keys
			const foreignKeys = await this.getForeignKeys(schemaName, table.table_name);
			// Get constraints
			const constraints = await this.getConstraints(schemaName, table.table_name);
			// Get enum values per column (if any)
			const enumMap = await this.getEnumValuesForTable(schemaName, table.table_name);
			// Get indexes
			const indexes = await this.getIndexes(schemaName, table.table_name);

			// Build table description chunk
			const tableChunk = this.buildTableChunk(
				table.table_name,
				columns,
				foreignKeys,
				constraints,
				table.table_comment,
				enumMap,
				indexes,
			);

			chunks.push(tableChunk);

			// Also create individual column chunks for important tables
			if (this.isImportantTable(table.table_name)) {
				for (const column of columns) {
					const columnChunk = this.buildColumnChunk(
						table.table_name,
						column,
						foreignKeys,
						enumMap[column.column_name],
					);
					chunks.push(columnChunk);
				}
			}
		}

		this.logger.log(`Generated ${chunks.length} schema chunks`);

		// Add chunks to vector store
		const aiChunks = chunks.map((content) => ({
			tenantId,
			collection: 'schema' as AiChunkCollection,
			dbKey,
			content,
		}));

		const chunkIds = await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});

		this.logger.log(`Successfully ingested ${chunkIds.length} chunks to vector store`);

		return chunkIds;
	}

	/**
	 * Ingest full reference data for amenities, cost type templates, room rule templates
	 * This enriches RAG with actual Vietnamese titles/descriptions from the DB.
	 */
	async ingestReferenceLookupData(tenantId: string, dbKey: string): Promise<number[]> {
		this.logger.log(`Starting reference lookup ingestion for tenant: ${tenantId}, db: ${dbKey}`);
		const [amenities, costTypes, roomRules] = await Promise.all([
			this.prisma.amenity.findMany({
				where: { isActive: true },
				orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
				select: { id: true, name: true, nameEn: true, category: true, description: true },
			}),
			this.prisma.costTypeTemplate.findMany({
				where: { isActive: true },
				orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
				select: {
					id: true,
					name: true,
					nameEn: true,
					category: true,
					defaultUnit: true,
					description: true,
				},
			}),
			this.prisma.roomRuleTemplate.findMany({
				where: { isActive: true },
				orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
				select: {
					id: true,
					name: true,
					nameEn: true,
					category: true,
					ruleType: true,
					description: true,
				},
			}),
		]);

		const mapNull = (v?: string | null): string => (v && v.trim().length > 0 ? v.trim() : '-');
		const sections: string[] = [];
		sections.push(
			[
				'# Reference: Amenities (id, name, name_en, category, description)',
				...amenities.map(
					(a) =>
						`amenities | id=${a.id} | name=${a.name} | name_en=${a.nameEn} | category=${a.category} | description=${mapNull(
							a.description,
						)}`,
				),
			].join('\n'),
		);
		sections.push(
			[
				'# Reference: Cost Type Templates (id, name, name_en, category, default_unit, description)',
				...costTypes.map(
					(c) =>
						`cost_type_templates | id=${c.id} | name=${c.name} | name_en=${c.nameEn} | category=${c.category} | default_unit=${mapNull(
							c.defaultUnit,
						)} | description=${mapNull(c.description)}`,
				),
			].join('\n'),
		);
		sections.push(
			[
				'# Reference: Room Rule Templates (id, name, name_en, category, rule_type, description)',
				...roomRules.map(
					(r) =>
						`room_rule_templates | id=${r.id} | name=${r.name} | name_en=${r.nameEn} | category=${r.category} | rule_type=${r.ruleType} | description=${mapNull(
							r.description,
						)}`,
				),
			].join('\n'),
		);

		const content = sections.join('\n\n');
		const aiChunks = this.splitContent(content).map((chunk) => ({
			tenantId,
			collection: 'schema' as AiChunkCollection,
			dbKey,
			content: chunk,
		}));
		const ids = await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});
		this.logger.log(`Reference lookup ingestion completed: ${ids.length} chunks`);
		return ids;
	}

	/**
	 * Ingest schema as JSON-structured descriptions per table for richer RAG
	 */
	async ingestSchemaJsonDescriptions(
		tenantId: string,
		dbKey: string,
		schemaName: string = 'public',
		databaseName: string = 'trustay_core',
	): Promise<number[]> {
		this.logger.log(`Starting JSON schema ingestion for tenant: ${tenantId}, db: ${dbKey}`);
		// Ensure only one truth: clear existing 'schema' collection for this tenant/db
		try {
			const deleted = await this.vectorStore.deleteChunksByCollection(
				'schema' as AiChunkCollection,
			);
			this.logger.log(`Cleared existing schema chunks: ${deleted}`);
		} catch (clearErr) {
			this.logger.warn('Failed to clear existing schema chunks before JSON ingestion', clearErr);
		}
		const tables = await this.getTables(schemaName);
		const chunks: string[] = [];
		const EXCLUDED_TABLES = new Set<string>([
			'_prisma_migrations',
			'error_logs',
			'refresh_tokens',
			'verification_codes',
			'bills',
			'bill_items',
			'payments',
		]);
		for (const table of tables) {
			if (EXCLUDED_TABLES.has(table.table_name)) {
				continue;
			}
			const [columns, foreignKeys, constraints, enumMap] = await Promise.all([
				this.getTableColumns(schemaName, table.table_name),
				this.getForeignKeys(schemaName, table.table_name),
				this.getConstraints(schemaName, table.table_name),
				this.getEnumValuesForTable(schemaName, table.table_name),
			]);

			// Fetch small set of sample values for user-facing columns
			const samples = await this.getSampleValuesForTable(schemaName, table.table_name, columns, 3);

			const json = this.buildJsonTableDescription(
				databaseName,
				table.table_name,
				table.table_comment,
				columns,
				foreignKeys,
				constraints,
				enumMap,
				samples,
			);
			chunks.push(JSON.stringify(json, null, 2));
		}

		// Denormalized documents for better RAG retrieval (rooms and requests/posts)
		try {
			const roomDocs = await this.buildDenormalizedRoomDocs();
			for (const doc of roomDocs) {
				chunks.push(JSON.stringify({ docType: 'room', ...doc }, null, 2));
			}
		} catch (err) {
			this.logger.warn('Failed to build denormalized room docs', err);
		}
		try {
			const requestDocs = await this.buildDenormalizedRequestDocs();
			for (const doc of requestDocs) {
				chunks.push(JSON.stringify({ docType: 'request', ...doc }, null, 2));
			}
		} catch (err) {
			this.logger.warn('Failed to build denormalized request docs', err);
		}
		const aiChunks = chunks.map((content) => ({
			tenantId,
			collection: 'schema' as AiChunkCollection,
			dbKey,
			content,
		}));
		const ids = await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});
		this.logger.log(`JSON schema ingestion completed: ${ids.length} chunks`);
		return ids;
	}

	/**
	 * Get all tables from information_schema
	 */
	private async getTables(
		schemaName: string,
	): Promise<Array<{ table_name: string; table_comment?: string }>> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT 
				t.table_name,
				obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') as table_comment
			FROM information_schema.tables t
			WHERE t.table_schema = $1
				AND t.table_type = 'BASE TABLE'
			ORDER BY t.table_name;
		`,
			schemaName,
		);

		return result as Array<{ table_name: string; table_comment?: string }>;
	}

	/**
	 * Get columns for a specific table
	 */
	private async getTableColumns(
		schemaName: string,
		tableName: string,
	): Promise<
		Array<{
			column_name: string;
			data_type: string;
			udt_name?: string;
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		}>
	> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT 
				c.column_name,
				c.data_type,
				c.udt_name,
				c.is_nullable,
				c.column_default,
				col_description((quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass::oid, c.ordinal_position) as column_comment
			FROM information_schema.columns c
			WHERE c.table_schema = $1
				AND c.table_name = $2
			ORDER BY c.ordinal_position;
		`,
			schemaName,
			tableName,
		);

		return result as Array<{
			column_name: string;
			data_type: string;
			udt_name?: string;
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		}>;
	}

	/**
	 * Get enum labels for all enum-typed columns in a table
	 */
	private async getEnumValuesForTable(
		schemaName: string,
		tableName: string,
	): Promise<Record<string, string[]>> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT a.attname AS column_name, t.typname AS enum_type, e.enumlabel
			FROM pg_attribute a
			JOIN pg_class c ON a.attrelid = c.oid
			JOIN pg_namespace n ON c.relnamespace = n.oid
			JOIN pg_type t ON a.atttypid = t.oid
			JOIN pg_enum e ON t.oid = e.enumtypid
			WHERE n.nspname = $1
				AND c.relname = $2
				AND a.attnum > 0
				AND NOT a.attisdropped
			ORDER BY a.attnum, e.enumsortorder;
		`,
			schemaName,
			tableName,
		);

		const map: Record<string, string[]> = {};
		for (const row of result as Array<{ column_name: string; enumlabel: string }>) {
			if (!map[row.column_name]) {
				map[row.column_name] = [];
			}
			map[row.column_name].push(row.enumlabel);
		}
		return map;
	}

	/**
	 * Get index definitions for a table
	 */
	private async getIndexes(
		schemaName: string,
		tableName: string,
	): Promise<Array<{ indexname: string; indexdef: string }>> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = $1 AND tablename = $2
			ORDER BY indexname;
		`,
			schemaName,
			tableName,
		);
		return result as Array<{ indexname: string; indexdef: string }>;
	}

	/**
	 * Get foreign keys for a table
	 */
	private async getForeignKeys(
		schemaName: string,
		tableName: string,
	): Promise<
		Array<{
			constraint_name: string;
			column_name: string;
			foreign_table_schema: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>
	> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT
				tc.constraint_name,
				kcu.column_name,
				ccu.table_schema AS foreign_table_schema,
				ccu.table_name AS foreign_table_name,
				ccu.column_name AS foreign_column_name
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			JOIN information_schema.constraint_column_usage AS ccu
				ON ccu.constraint_name = tc.constraint_name
				AND ccu.table_schema = tc.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY'
				AND tc.table_schema = $1
				AND tc.table_name = $2;
		`,
			schemaName,
			tableName,
		);

		return result as Array<{
			constraint_name: string;
			column_name: string;
			foreign_table_schema: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>;
	}

	/**
	 * Get constraints (PK, UNIQUE, CHECK) for a table
	 */
	private async getConstraints(
		schemaName: string,
		tableName: string,
	): Promise<Array<{ constraint_name: string; constraint_type: string }>> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT
				constraint_name,
				constraint_type
			FROM information_schema.table_constraints
			WHERE table_schema = $1
				AND table_name = $2
				AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK');
		`,
			schemaName,
			tableName,
		);

		return result as Array<{ constraint_name: string; constraint_type: string }>;
	}

	/**
	 * Build a comprehensive table chunk description
	 */
	private buildTableChunk(
		tableName: string,
		columns: Array<{
			column_name: string;
			data_type: string;
			udt_name?: string;
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		}>,
		foreignKeys: Array<{
			column_name: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>,
		constraints: Array<{ constraint_name: string; constraint_type: string }>,
		tableComment?: string,
		enumMap: Record<string, string[]> = {},
		indexes: Array<{ indexname: string; indexdef: string }> = [],
	): string {
		const columnDescriptions = columns
			.map((col) => {
				const nullable = col.is_nullable === 'YES' ? 'nullable' : 'not null';
				const defaultVal = col.column_default ? ` default: ${col.column_default}` : '';
				const comment = col.column_comment ? `. ${col.column_comment}` : '';
				const enumInfo = enumMap[col.column_name]?.length
					? ` (enum: ${enumMap[col.column_name].join('|')})`
					: '';
				return `${col.column_name} ${col.data_type}${enumInfo} ${nullable}${defaultVal}${comment}`;
			})
			.join(', ');

		const fkDescriptions = foreignKeys
			.map(
				(fk) =>
					`${tableName}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`,
			)
			.join(', ');

		const constraintDescriptions = constraints
			.map((c) => `${c.constraint_type}: ${c.constraint_name}`)
			.join(', ');

		const tableDesc = tableComment ? `. Meaning: ${tableComment}` : '';

		const indexDescriptions = indexes.map((i) => `${i.indexname}: ${i.indexdef}`).join('; ');

		return `${tableName}: ${columnDescriptions}${fkDescriptions ? `. FK: ${fkDescriptions}` : ''}${constraintDescriptions ? `. Constraints: ${constraintDescriptions}` : ''}${indexDescriptions ? `. Indexes: ${indexDescriptions}` : ''}${tableDesc}`;
	}

	/**
	 * Split long content into manageable chunks for embeddings
	 */
	private splitContent(content: string, maxChars: number = 4000): string[] {
		const out: string[] = [];
		let start = 0;
		while (start < content.length) {
			out.push(content.slice(start, start + maxChars));
			start += maxChars;
		}
		return out.filter((s) => s.trim().length > 0);
	}

	// Build denormalized room documents for better semantic retrieval
	private async buildDenormalizedRoomDocs(): Promise<Array<Record<string, unknown>>> {
		const sql = `
		SELECT 
		  r.id AS room_id,
		  r.name AS room_name,
		  r.description AS room_description,
		  r.room_type,
		  r.area_sqm,
		  r.max_occupancy,
		  r.is_active,
		  r.is_verified,
		  b.id AS building_id,
		  b.name AS building_name,
		  b.address_line_1,
		  b.address_line_2,
		  b.district_id,
		  b.province_id,
		  COALESCE(rp.base_price_monthly, 0) AS price_monthly,
		  rp.currency,
		  ARRAY(SELECT DISTINCT a.name_en FROM amenities a 
		        JOIN room_amenities ra ON ra.amenity_id = a.id
		        WHERE ra.room_id = r.id) AS amenities_en,
		  ARRAY(SELECT DISTINCT rrt.name_en FROM room_rule_templates rrt 
		        JOIN room_rules rr ON rr.rule_template_id = rrt.id
		        WHERE rr.room_id = r.id) AS rules_en,
		  ARRAY(SELECT DISTINCT img.alt_text FROM room_images img WHERE img.room_id = r.id AND img.alt_text IS NOT NULL) AS images_alt
		FROM rooms r
		JOIN buildings b ON b.id = r.building_id
		LEFT JOIN room_pricing rp ON rp.room_id = r.id
		WHERE r.is_active = true
		ORDER BY r.updated_at DESC
		LIMIT 5;
		`;
		const rows = (await this.prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
		return rows.map((row) => {
			return {
				id: row['room_id'],
				title: row['room_name'],
				description: row['room_description'],
				room_type: row['room_type'],
				area_sqm: row['area_sqm'],
				max_occupancy: row['max_occupancy'],
				is_active: row['is_active'],
				is_verified: row['is_verified'],
				building: {
					id: row['building_id'],
					name: row['building_name'],
					address_line_1: row['address_line_1'],
					address_line_2: row['address_line_2'],
					district_id: row['district_id'],
					province_id: row['province_id'],
				},
				amenities: row['amenities_en'] || [],
				rules: row['rules_en'] || [],
				pricing: { base_price_monthly: row['price_monthly'], currency: row['currency'] },
				imagesAlt: row['images_alt'] || [],
				meta: {
					province_id: row['province_id'],
					district_id: row['district_id'],
					room_type: row['room_type'],
					is_active: row['is_active'],
					is_verified: row['is_verified'],
				},
			};
		});
	}

	// Build denormalized request/roommate documents
	private async buildDenormalizedRequestDocs(): Promise<Array<Record<string, unknown>>> {
		const sql = `
		(SELECT 
		  rr.id,
		  rr.title,
		  rr.description,
		  rr.min_budget,
		  rr.max_budget,
		  rr.currency,
		  rr.preferred_room_type::text AS preferred_room_type,
		  rr.preferred_province_id,
		  rr.preferred_district_id,
		  rr.preferred_ward_id,
		  rr.occupancy,
		  rr.move_in_date,
		  rr.status::text AS status
		FROM room_requests rr
		WHERE rr.status = 'active'
		ORDER BY rr.created_at DESC
		LIMIT 5)
		UNION ALL
		(SELECT 
		  rsp.id,
		  rsp.title,
		  rsp.description,
		  NULL::numeric AS min_budget,
		  rsp.monthly_rent AS max_budget,
		  rsp.currency,
		  NULL::text AS preferred_room_type,
		  rsp.external_province_id AS preferred_province_id,
		  rsp.external_district_id AS preferred_district_id,
		  rsp.external_ward_id AS preferred_ward_id,
		  rsp.seeking_count AS occupancy,
		  rsp.available_from_date AS move_in_date,
		  rsp.status::text AS status
		FROM roommate_seeking_posts rsp
		WHERE rsp.status IN ('active','pending_approval')
		ORDER BY rsp.created_at DESC
		LIMIT 5);
		`;
		const rows = (await this.prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
		return rows.map((row) => ({
			id: row['id'],
			title: row['title'],
			description: row['description'],
			budget: { min: row['min_budget'], max: row['max_budget'], currency: row['currency'] },
			preferred_location: {
				province_id: row['preferred_province_id'],
				district_id: row['preferred_district_id'],
				ward_id: row['preferred_ward_id'],
			},
			preferred_room_type: row['preferred_room_type'],
			occupancy: row['occupancy'],
			available_from_date: row['move_in_date'],
			status: row['status'],
		}));
	}

	private buildJsonTableDescription(
		databaseName: string,
		tableName: string,
		tableComment: string | undefined,
		columns: Array<{
			column_name: string;
			data_type: string;
			udt_name?: string;
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		}>,
		foreignKeys: Array<{
			column_name: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>,
		constraints: Array<{ constraint_name: string; constraint_type: string }>,
		enumMap: Record<string, string[]>,
		samples: Record<string, unknown[]>,
	): Record<string, unknown> {
		// Constraints summary can be added later if needed

		const columnObjects = columns.map((c) => {
			const constraintsList: string[] = [];
			if (c.is_nullable !== 'YES') {
				constraintsList.push('NOT NULL');
			}
			if (c.column_default) {
				constraintsList.push(`DEFAULT ${c.column_default}`);
			}
			const enumValues = enumMap[c.column_name];
			const typeText = enumValues?.length
				? `ENUM(${enumValues.join('|')})`
				: (c.udt_name || c.data_type).toUpperCase();
			return {
				name: c.column_name,
				type: typeText,
				description: c.column_comment || '',
				constraints: constraintsList,
				sample_values: (samples[c.column_name] || []).slice(0, 3),
			};
		});

		const relationships = foreignKeys.map((fk) => ({
			target_table: fk.foreign_table_name,
			type: 'many-to-one',
			columns: [fk.column_name],
			description: `${tableName}.${fk.column_name} references ${fk.foreign_table_name}.${fk.foreign_column_name}`,
		}));

		const sampleQueries = [
			`SELECT * FROM ${tableName} LIMIT 10`,
			`SELECT COUNT(*) FROM ${tableName}`,
		];

		return {
			table_name: tableName,
			database_name: databaseName,
			description: tableComment || '',
			columns: columnObjects,
			relationships,
			constraints: constraints.map((c) => ({ name: c.constraint_name, type: c.constraint_type })),
			sample_queries: sampleQueries,
			business_context: this.getBusinessContextForTable(tableName),
		};
	}

	private getBusinessContextForTable(tableName: string): string {
		switch (tableName) {
			case 'rooms':
				return 'Room archetypes with type, area, occupancy; linked to buildings, amenities, rules, pricing, costs, and images.';
			case 'room_instances':
				return 'Concrete rentable units of a room archetype; use status to determine availability.';
			case 'buildings':
				return 'Rental buildings with owner, address, geo, and verification flags.';
			case 'amenities':
				return 'Lookup of amenities; join via room_amenities to rooms.';
			case 'room_rule_templates':
				return 'Lookup of room rules; join via room_rules to rooms.';
			case 'cost_type_templates':
				return 'Lookup for recurring costs (utility/service); join via room_costs to rooms.';
			case 'room_requests':
				return 'Tenant posts seeking rooms with budget, location, and preferences.';
			case 'roommate_seeking_posts':
				return 'Posts seeking roommates; includes budget, slots, and requirements.';
			default:
				return '';
		}
	}

	/**
	 * Build a detailed column chunk for important tables
	 */
	private buildColumnChunk(
		tableName: string,
		column: {
			column_name: string;
			data_type: string;
			udt_name?: string;
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		},
		foreignKeys: Array<{
			column_name: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>,
		enumValues?: string[],
	): string {
		const nullable = column.is_nullable === 'YES' ? 'nullable' : 'not null';
		const defaultVal = column.column_default ? ` default: ${column.column_default}` : '';
		const comment = column.column_comment ? `. Meaning: ${column.column_comment}` : '';
		const enumInfo = enumValues?.length ? ` (enum: ${enumValues.join('|')})` : '';

		const fk = foreignKeys.find((fk) => fk.column_name === column.column_name);
		const fkDesc = fk ? `. FK: ${fk.foreign_table_name}(${fk.foreign_column_name})` : '';

		return `${tableName}.${column.column_name} ${column.data_type}${enumInfo} ${nullable}${defaultVal}${fkDesc}${comment}`;
	}

	/**
	 * Determine if a table is important enough to create individual column chunks
	 */
	private isImportantTable(tableName: string): boolean {
		const importantTables = [
			'users',
			'rooms',
			'buildings',
			'rentals',
			'bills',
			'payments',
			'room_instances',
			'room_bookings',
		];
		return importantTables.includes(tableName);
	}

	/**
	 * Fetch small samples for columns to enrich schema JSON (language-agnostic, supports Vietnamese data).
	 */
	private async getSampleValuesForTable(
		schemaName: string,
		tableName: string,
		columns: Array<{
			column_name: string;
			data_type: string;
			udt_name?: string;
		}>,
		limitPerColumn: number = 3,
	): Promise<Record<string, unknown[]>> {
		const result: Record<string, unknown[]> = {};
		const safeIdent = (ident: string): string => {
			if (!/^[A-Za-z0-9_]+$/.test(ident)) {
				throw new Error(`Unsafe identifier: ${ident}`);
			}
			return `"${ident}"`;
		};
		for (const col of columns) {
			// Heuristic: only sample user-facing or categorical columns
			const type = (col.udt_name || col.data_type || '').toLowerCase();
			const isTextLike = type.includes('text') || type.includes('char') || type.includes('varchar');
			const isEnumLike = type.includes('enum');
			const isDateLike = type.includes('date') || type.includes('timestamp');
			const isNumericLike = type.includes('int') || type.includes('numeric');
			if (!(isTextLike || isEnumLike || isDateLike || isNumericLike)) {
				continue;
			}
			try {
				const sql = `SELECT DISTINCT ${safeIdent(col.column_name)} AS v FROM ${safeIdent(
					schemaName,
				)}.${safeIdent(tableName)} WHERE ${safeIdent(col.column_name)} IS NOT NULL LIMIT ${
					limitPerColumn || 3
				}`;
				const rows = (await this.prisma.$queryRawUnsafe(sql)) as Array<{ v: unknown }>;
				result[col.column_name] = rows.map((r) => r.v).filter((v) => v !== null && v !== undefined);
			} catch (err) {
				this.logger.debug(
					`Skip sampling ${schemaName}.${tableName}.${col.column_name}: ${(err as Error).message}`,
				);
			}
		}
		return result;
	}
}
