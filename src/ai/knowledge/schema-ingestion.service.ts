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

			// Build table description chunk
			const tableChunk = this.buildTableChunk(
				table.table_name,
				columns,
				foreignKeys,
				constraints,
				table.table_comment,
			);

			chunks.push(tableChunk);

			// Also create individual column chunks for important tables
			if (this.isImportantTable(table.table_name)) {
				for (const column of columns) {
					const columnChunk = this.buildColumnChunk(table.table_name, column, foreignKeys);
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
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		}>;
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
	): string {
		const columnDescriptions = columns
			.map((col) => {
				const nullable = col.is_nullable === 'YES' ? 'nullable' : 'not null';
				const defaultVal = col.column_default ? ` default: ${col.column_default}` : '';
				const comment = col.column_comment ? `. ${col.column_comment}` : '';
				return `${col.column_name} ${col.data_type} ${nullable}${defaultVal}${comment}`;
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

		return `${tableName}: ${columnDescriptions}${fkDescriptions ? `. FK: ${fkDescriptions}` : ''}${constraintDescriptions ? `. Constraints: ${constraintDescriptions}` : ''}${tableDesc}`;
	}

	/**
	 * Build a detailed column chunk for important tables
	 */
	private buildColumnChunk(
		tableName: string,
		column: {
			column_name: string;
			data_type: string;
			is_nullable: string;
			column_default: string | null;
			column_comment?: string;
		},
		foreignKeys: Array<{
			column_name: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>,
	): string {
		const nullable = column.is_nullable === 'YES' ? 'nullable' : 'not null';
		const defaultVal = column.column_default ? ` default: ${column.column_default}` : '';
		const comment = column.column_comment ? `. Meaning: ${column.column_comment}` : '';

		const fk = foreignKeys.find((fk) => fk.column_name === column.column_name);
		const fkDesc = fk ? `. FK: ${fk.foreign_table_name}(${fk.foreign_column_name})` : '';

		return `${tableName}.${column.column_name} ${column.data_type} ${nullable}${defaultVal}${fkDesc}${comment}`;
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
}
