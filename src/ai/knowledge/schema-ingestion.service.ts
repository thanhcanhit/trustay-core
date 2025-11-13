import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseVectorStoreService } from '../vector-store/supabase-vector-store.service';
import { AiChunkCollection } from '../vector-store/types/vector.types';

/**
 * Service to ingest database schema and reference data into vector store
 * Uses semantic chunking strategy: table overview, column details, and relationships as separate chunks
 * Also handles reference data (amenities, cost types, rules) and denormalized documents (rooms, requests)
 */
@Injectable()
export class SchemaIngestionService {
	private readonly logger = new Logger(SchemaIngestionService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly vectorStore: SupabaseVectorStoreService,
	) {}

	/**
	 * Ingest schema as JSON-structured descriptions - one chunk per table
	 * Each chunk contains: table overview, all columns, and all relationships
	 * This reduces chunk count significantly while maintaining schema information
	 */
	async ingestSchemaJsonDescriptions(
		tenantId: string,
		dbKey: string,
		schemaName: string = 'public',
		databaseName: string = 'trustay_core',
	): Promise<number[]> {
		this.logger.log(
			`Starting JSON schema ingestion (one chunk per table) for tenant: ${tenantId}, db: ${dbKey}`,
		);
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
		const aiChunks: Array<{
			tenantId: string;
			collection: AiChunkCollection;
			dbKey: string;
			content: string;
		}> = [];
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

			// Fetch small set of sample values for user-facing columns (reduced from 3 to 2)
			const samples = await this.getSampleValuesForTable(schemaName, table.table_name, columns, 2);

			// Fetch 1 sample row from table for better RAG context (reduced from 2 to 1 to reduce chunk size)
			const sampleRows = await this.getSampleRowsFromTable(schemaName, table.table_name, 1);

			// Build columns array with all details
			const columnsArray = columns.map((column) => {
				const enumValues = enumMap[column.column_name];
				const typeText = enumValues?.length
					? `ENUM(${enumValues.join('|')})`
					: (column.udt_name || column.data_type).toUpperCase();

				const constraintsList: string[] = [];
				if (column.is_nullable !== 'YES') {
					constraintsList.push('NOT NULL');
				}
				if (column.column_default) {
					constraintsList.push(`DEFAULT ${column.column_default}`);
				}

				return {
					name: column.column_name,
					type: typeText,
					description: column.column_comment || '',
					constraints: constraintsList,
					enum_values: enumValues?.length ? enumValues : undefined, // Include enum values explicitly
					sample_values: (samples[column.column_name] || []).slice(0, 2), // Reduced from 3 to 2
				};
			});

			// Build relationships array with more context
			const relationshipsArray = foreignKeys.map((fk) => ({
				from_column: fk.column_name,
				to_table: fk.foreign_table_name,
				to_column: fk.foreign_column_name,
				type: 'many-to-one',
				description: `${table.table_name}.${fk.column_name} references ${fk.foreign_table_name}.${fk.foreign_column_name}`,
				join_example: `JOIN ${fk.foreign_table_name} ON ${table.table_name}.${fk.column_name} = ${fk.foreign_table_name}.${fk.foreign_column_name}`,
			}));

			// One comprehensive chunk per table with sample data
			// Note: Chỉ include business_context (table-specific), không include business_domain_context để giảm size
			// business_domain_context sẽ được thêm vào prompt của agents thay vì vào mỗi chunk
			// Compact format: loại bỏ fields rỗng và format JSON để giảm kích thước
			const tableChunk: Record<string, unknown> = {
				chunk_type: 'table_complete',
				table_name: table.table_name,
				database_name: databaseName,
				business_context: this.getBusinessContextForTable(table.table_name),
			};
			// Chỉ thêm description nếu có
			if (table.table_comment && table.table_comment.trim().length > 0) {
				tableChunk.description = table.table_comment.trim();
			}
			// Constraints - chỉ thêm nếu có
			if (constraints.length > 0) {
				tableChunk.constraints = constraints
					.map((c) => {
						const constraint: Record<string, unknown> = {
							name: c.constraint_name,
							type: c.constraint_type,
						};
						if (c.columns.length > 0) {
							constraint.columns = c.columns;
						}
						return constraint;
					})
					.filter((c) => Object.keys(c).length > 0);
			}
			// Columns - loại bỏ sample_values rỗng và description rỗng
			tableChunk.columns = columnsArray.map((col) => {
				const column: Record<string, unknown> = {
					name: col.name,
					type: col.type,
				};
				if (col.description && col.description.trim().length > 0) {
					column.description = col.description.trim();
				}
				if (col.constraints && col.constraints.length > 0) {
					column.constraints = col.constraints;
				}
				if (col.enum_values && col.enum_values.length > 0) {
					column.enum_values = col.enum_values;
				}
				if (col.sample_values && col.sample_values.length > 0) {
					column.sample_values = col.sample_values;
				}
				return column;
			});
			// Relationships - chỉ thêm nếu có
			if (relationshipsArray.length > 0) {
				tableChunk.relationships = relationshipsArray;
			}
			// Sample rows - chỉ thêm nếu có
			if (sampleRows.length > 0) {
				tableChunk.sample_rows = sampleRows;
			}
			// Sample queries - luôn có ít nhất 1
			tableChunk.sample_queries = [
				`SELECT * FROM ${table.table_name} LIMIT 10`,
				`SELECT COUNT(*) FROM ${table.table_name}`,
			];
			// Compact JSON (không format) để giảm kích thước
			aiChunks.push({
				tenantId,
				collection: 'schema' as AiChunkCollection,
				dbKey,
				content: JSON.stringify(tableChunk),
			});
		}

		this.logger.log(
			`Generated ${aiChunks.length} schema chunks (one per table, includes all columns and relationships)`,
		);

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
	 * Get constraints (PK, UNIQUE, CHECK) for a table with column information
	 * Filters out meaningless CHECK constraints (NOT NULL checks that are already in column constraints)
	 */
	private async getConstraints(
		schemaName: string,
		tableName: string,
	): Promise<Array<{ constraint_name: string; constraint_type: string; columns: string[] }>> {
		const result = await this.prisma.$queryRawUnsafe(
			`
			SELECT
				tc.constraint_name::text AS constraint_name,
				tc.constraint_type::text AS constraint_type,
				COALESCE(
					ARRAY_AGG(kcu.column_name::text ORDER BY kcu.ordinal_position) FILTER (WHERE kcu.column_name IS NOT NULL),
					ARRAY[]::text[]
				) AS columns
			FROM information_schema.table_constraints tc
			LEFT JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.table_schema = $1
				AND tc.table_name = $2
				AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
			GROUP BY tc.constraint_name, tc.constraint_type
			ORDER BY tc.constraint_type, tc.constraint_name;
		`,
			schemaName,
			tableName,
		);

		const constraints = result as Array<{
			constraint_name: string;
			constraint_type: string;
			columns: string[];
		}>;

		// Filter out meaningless CHECK constraints (NOT NULL checks)
		// These are auto-generated by Prisma and are redundant with column-level NOT NULL constraints
		return constraints.filter((c) => {
			// Keep PRIMARY KEY and UNIQUE constraints
			if (c.constraint_type !== 'CHECK') {
				return true;
			}
			// Filter out CHECK constraints that are just NOT NULL checks
			// Pattern: numbers_numbers_X_not_null (Prisma auto-generated NOT NULL checks)
			const isNotNotNullCheck = /^\d+_\d+_\d+_not_null$/i.test(c.constraint_name);
			return !isNotNotNullCheck;
		});
	}

	/**
	 * Get business context for a specific table
	 * Combines table-specific context with general business domain knowledge
	 */
	private getBusinessContextForTable(tableName: string): string {
		const tableSpecificContext = this.getTableSpecificContext(tableName);
		return tableSpecificContext;
	}

	/**
	 * Get table-specific business context with detailed information
	 * Includes use cases, business flows, and critical schema notes
	 */
	private getTableSpecificContext(tableName: string): string {
		switch (tableName) {
			case 'rooms':
				return `Room archetypes (phòng trọ) - Core entity in Trustay platform.
- Represents room types/archetypes with type, area, occupancy
- Linked to buildings, amenities, rules, pricing, costs, and images
- IMPORTANT: Use room_pricing.base_price_monthly for price filtering, NOT room_costs.price
- room_costs has: fixed_amount (monthly fixed), unit_price (per unit like kWh), per_person_amount (shared cost), base_rate (legacy)
- Business flow: Chủ trọ creates Room → RoomInstance → can post or send RoomInvitation
- Use cases: UC003 (Thêm phòng trọ), UC011 (Tìm kiếm & xem phòng)`;

			case 'room_instances':
				return `Concrete rentable units (số phòng cụ thể) - Specific room instances like 101, 102.
- Represents actual rentable units of a room archetype
- Use status field to determine availability
- Business flow: Chủ trọ creates RoomInstance from Room → can be rented via Rental
- When RoomBooking accepted or RoomInvitation accepted → creates Rental linking tenant ↔ owner ↔ room_instance`;

			case 'buildings':
				return `Rental buildings (tòa nhà) - Buildings containing rooms.
- Contains owner (landlord), address, geo coordinates, verification flags
- address_line_1 is key field for location search (Gò Vấp, Quận 1, etc.)
- Linked to districts, provinces, wards for administrative filtering
- Business flow: Chủ trọ creates Building → adds Rooms → manages RoomInstances
- Use case: UC002 (Thêm dãy trọ)`;

			case 'room_costs':
				return `Recurring costs for rooms (chi phí phòng) - Utilities, services, etc.
- Columns: fixed_amount (monthly fixed cost), unit_price (per unit like kWh), per_person_amount (shared cost), base_rate (legacy)
- CRITICAL: NO "price" column exists. Do NOT use room_costs.price in queries.
- Join via room_id to rooms table
- Used in BillItem to calculate total costs for billing
- Business flow: RoomCost defines costs → BillItem aggregates → Bill → Payment`;

			case 'room_pricing':
				return `Rental pricing for rooms (giá thuê) - Main pricing table.
- Contains base_price_monthly (main price field for filtering), currency, deposit_amount
- Join via room_id to rooms table
- Use this for price filtering queries (e.g., "phòng dưới 4 triệu"), NOT room_costs
- Business flow: RoomPricing defines rent → used in search/filtering → Rental → Bill`;

			case 'rentals':
				return `Rental agreements (hợp đồng thuê) - Active tenant-room relationships.
- Links tenant ↔ owner ↔ room_instance
- Created when RoomBooking accepted or RoomInvitation accepted
- Can have associated Contract (hợp đồng điện tử)
- Business flow: Booking/Invitation → Rental → Contract → Bills → Payments
- Use cases: UC004 (Tạo hợp đồng), UC005 (Ký hợp đồng)`;

			case 'room_bookings':
				return `Room booking requests (yêu cầu thuê) - Tenant requests to rent.
- Tenant → Landlord: yêu cầu thuê Room or RoomInstance
- Status: pending, accepted, rejected
- When accepted → creates Rental
- Business flow: Tenant creates RoomBooking → Landlord reviews → accepts/rejects → creates Rental
- Use case: UC007 (Gửi yêu cầu thuê trọ), UC014 (Xử lý yêu cầu)`;

			case 'room_invitations':
				return `Room invitations (lời mời thuê) - Landlord invitations to tenants.
- Landlord → Tenant: lời mời thuê Room/RoomInstance cụ thể
- When accepted → creates Rental
- Business flow: Landlord creates RoomInvitation → Tenant accepts/rejects → creates Rental
- Use cases: UC009 (Gửi lời mời), UC016 (Xử lý lời mời)`;

			case 'bills':
				return `Bills (hóa đơn) - Periodic billing for rentals.
- Created per billing period (billing_month/year, period_start/end)
- Contains BillItems aggregating costs from RoomCost/RoomPricing
- Tenant makes Payment for Bill/Rental
- Business flow: System creates Bill → BillItems (room rent, utilities, services) → Tenant Payment
- Use cases: UC006 (Tạo hóa đơn), UC015 (Xem hóa đơn)`;

			case 'bill_items':
				return `Bill items (chi tiết hóa đơn) - Individual cost items in a bill.
- Aggregates costs from RoomCost (utilities, services) and RoomPricing (rent)
- Belongs to a Bill
- Business flow: Bill → BillItems (from RoomCost + RoomPricing) → total amount`;

			case 'payments':
				return `Payments (thanh toán) - Payment transactions for bills/rentals.
- Tenant makes Payment for Bill or Rental
- Tracks payment status, amount, method
- Business flow: Bill → Payment → confirmation`;

			case 'amenities':
				return `Amenities lookup (tiện ích) - Available amenities.
- Join via room_amenities to rooms
- Used in room search/filtering
- Examples: WiFi, máy giặt, điều hòa, etc.`;

			case 'room_rule_templates':
				return `Room rule templates (nội quy) - Room rules lookup.
- Join via room_rules to rooms
- Used to define room policies
- Examples: Không hút thuốc, Không nuôi thú, etc.`;

			case 'cost_type_templates':
				return `Cost type templates (loại chi phí) - Recurring cost types lookup.
- Join via room_costs to rooms
- Defines types of costs: điện, nước, internet, etc.
- Used in RoomCost to define costs for rooms`;

			case 'room_requests':
				return `Room seeking posts (bài tìm phòng) - Tenant posts seeking rooms.
- Tenant posts with budget, location preferences, requirements
- Landlords can respond with matching rooms
- Business flow: Tenant creates RoomSeekingPost → Landlords see → can send RoomInvitation
- Use case: UC012 (Đăng tin tìm trọ)`;

			case 'roommate_seeking_posts':
				return `Roommate seeking posts (tìm người ở ghép) - Posts seeking roommates.
- Includes budget, slots needed, roommate requirements
- Other tenants can apply via RoommateApplication
- Business flow: Tenant creates RoommateSeekingPost → other tenants apply → UC015 (Xử lý)
- Use cases: UC008 (Gửi yêu cầu ở ghép), UC013 (Đăng tin tìm người ở ghép)`;

			case 'districts':
				return `Administrative districts (quận) - Location filtering.
- Join from buildings table
- Used for filtering by district (e.g., "Gò Vấp", "Quận 1")
- Part of location hierarchy: Province → District → Ward`;

			case 'wards':
				return `Administrative wards (phường/xã) - Finer location filtering.
- Join from buildings table
- Used for finer location filtering
- Part of location hierarchy: Province → District → Ward`;

			case 'provinces':
				return `Administrative provinces (tỉnh/thành phố) - Province-level filtering.
- Join from buildings table
- Used for province-level filtering (e.g., "TP.HCM", "Hà Nội")
- Part of location hierarchy: Province → District → Ward`;

			case 'users':
				return `Users (người dùng) - System users.
- Roles: tenant (Người thuê), landlord (Chủ trọ)
- Authentication and authorization
- Use cases: UC001 (Đăng nhập)`;

			case 'contracts':
				return `Contracts (hợp đồng điện tử) - Electronic rental contracts.
- Linked to Rental
- Digital signatures, terms, dates
- Use cases: UC004 (Tạo hợp đồng), UC005 (Ký hợp đồng)`;

			default:
				return `Table: ${tableName}. Refer to business context for domain understanding.`;
		}
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

	/**
	 * Get sample rows from a table (actual data rows, not just column values)
	 * Returns up to limit rows with all columns
	 */
	private async getSampleRowsFromTable(
		schemaName: string,
		tableName: string,
		limit: number = 2,
	): Promise<Array<Record<string, unknown>>> {
		const safeIdent = (ident: string): string => {
			if (!/^[A-Za-z0-9_]+$/.test(ident)) {
				throw new Error(`Unsafe identifier: ${ident}`);
			}
			return `"${ident}"`;
		};
		try {
			const sql = `SELECT * FROM ${safeIdent(schemaName)}.${safeIdent(tableName)} LIMIT ${limit}`;
			const rows = (await this.prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
			// Clean up rows: remove null values, truncate long text fields
			return rows.map((row) => {
				const cleaned: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(row)) {
					if (value === null || value === undefined) {
						continue;
					}
					// Truncate long text fields to avoid huge chunks
					if (typeof value === 'string' && value.length > 200) {
						cleaned[key] = `${value.substring(0, 200)}...`;
					} else {
						cleaned[key] = value;
					}
				}
				return cleaned;
			});
		} catch (err) {
			this.logger.debug(
				`Skip sampling rows from ${schemaName}.${tableName}: ${(err as Error).message}`,
			);
			return [];
		}
	}

	/**
	 * Ingest full reference data for amenities, cost type templates, room rule templates
	 * Creates one chunk per data row for precise semantic retrieval
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

		const aiChunks: Array<{
			tenantId: string;
			collection: AiChunkCollection;
			dbKey: string;
			content: string;
		}> = [];

		// One chunk per amenity
		for (const amenity of amenities) {
			aiChunks.push({
				tenantId,
				collection: 'business' as AiChunkCollection,
				dbKey,
				content: `amenities | id=${amenity.id} | name=${amenity.name} | name_en=${amenity.nameEn} | category=${amenity.category} | description=${mapNull(
					amenity.description,
				)}`,
			});
		}

		// One chunk per cost type template
		for (const costType of costTypes) {
			aiChunks.push({
				tenantId,
				collection: 'business' as AiChunkCollection,
				dbKey,
				content: `cost_type_templates | id=${costType.id} | name=${costType.name} | name_en=${costType.nameEn} | category=${costType.category} | default_unit=${mapNull(
					costType.defaultUnit,
				)} | description=${mapNull(costType.description)}`,
			});
		}

		// One chunk per room rule template
		for (const roomRule of roomRules) {
			aiChunks.push({
				tenantId,
				collection: 'business' as AiChunkCollection,
				dbKey,
				content: `room_rule_templates | id=${roomRule.id} | name=${roomRule.name} | name_en=${roomRule.nameEn} | category=${roomRule.category} | rule_type=${roomRule.ruleType} | description=${mapNull(
					roomRule.description,
				)}`,
			});
		}

		this.logger.log(`Generated ${aiChunks.length} reference data chunks (one per row)`);

		const ids = await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});

		this.logger.log(`Reference lookup ingestion completed: ${ids.length} chunks`);
		return ids;
	}

	/**
	 * Build and ingest denormalized room documents for better semantic retrieval
	 * Each room becomes one rich JSON chunk
	 */
	async ingestDenormalizedRoomDocs(tenantId: string, dbKey: string): Promise<number[]> {
		this.logger.log(
			`Starting denormalized room docs ingestion for tenant: ${tenantId}, db: ${dbKey}`,
		);
		try {
			const roomDocs = await this.buildDenormalizedRoomDocs();
			const aiChunks = roomDocs.map((doc) => ({
				tenantId,
				collection: 'docs' as AiChunkCollection,
				dbKey,
				content: JSON.stringify({ docType: 'room', ...doc }, null, 2),
			}));

			const ids = await this.vectorStore.addChunks(aiChunks, {
				model: 'text-embedding-004',
				batchSize: 10,
			});

			this.logger.log(`Denormalized room docs ingestion completed: ${ids.length} chunks`);
			return ids;
		} catch (err) {
			this.logger.warn('Failed to build denormalized room docs', err);
			return [];
		}
	}

	/**
	 * Build and ingest denormalized request/roommate documents
	 * Each request becomes one rich JSON chunk
	 */
	async ingestDenormalizedRequestDocs(tenantId: string, dbKey: string): Promise<number[]> {
		this.logger.log(
			`Starting denormalized request docs ingestion for tenant: ${tenantId}, db: ${dbKey}`,
		);
		try {
			const requestDocs = await this.buildDenormalizedRequestDocs();
			const aiChunks = requestDocs.map((doc) => ({
				tenantId,
				collection: 'docs' as AiChunkCollection,
				dbKey,
				content: JSON.stringify({ docType: 'request', ...doc }, null, 2),
			}));

			const ids = await this.vectorStore.addChunks(aiChunks, {
				model: 'text-embedding-004',
				batchSize: 10,
			});

			this.logger.log(`Denormalized request docs ingestion completed: ${ids.length} chunks`);
			return ids;
		} catch (err) {
			this.logger.warn('Failed to build denormalized request docs', err);
			return [];
		}
	}

	/**
	 * Build denormalized room documents for better semantic retrieval
	 */
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

	/**
	 * Build denormalized request/roommate documents
	 */
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
}
