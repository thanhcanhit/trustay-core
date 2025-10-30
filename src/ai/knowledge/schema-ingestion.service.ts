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
		for (const table of tables) {
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
			JOIN pg_class c ON a.atttrelid = c.oid
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
			business_context: '',
		};
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
