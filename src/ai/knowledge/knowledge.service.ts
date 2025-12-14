import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BUSINESS_CONTEXT } from '../prompts/business-context';
import { getCompleteDatabaseSchema } from '../utils/schema-provider';
import { SupabaseVectorStoreService } from '../vector-store/supabase-vector-store.service';
import {
	AiChunkCollection,
	SqlQAEntry,
	VectorSearchOptions,
	VectorSearchResult,
} from '../vector-store/types/vector.types';

/**
 * Canonical SQL match thresholds:
 *   - HARD: very high threshold (0.95+) for exact matches - but SQL is still regenerated from current schema
 *   - SOFT: provide canonical as LLM hint/context if threshold.soft <= score < threshold.hard
 *   - Below SOFT: treat as new
 *
 * IMPORTANT: Canonical SQL is NEVER executed directly. It's only used as a hint/reference.
 * SQL is always regenerated based on current schema to handle schema changes safely.
 */
const _CANONICAL_REUSE_THRESHOLDS: { hard: number; soft: number } = { hard: 0.95, soft: 0.8 };

/**
 * Maximum #lines per schema chunk for text-based ingestion
 */
const MAX_LINES_PER_SCHEMA_CHUNK: number = 60;

/**
 * KnowledgeService
 * - Ingests DB schema into vector store for semantic retrieval
 * - Stores and retrieves Q&A interactions with SQL canonical for self-learning
 */
@Injectable()
export class KnowledgeService {
	private readonly logger = new Logger(KnowledgeService.name);
	private readonly tenantId: string;
	private readonly dbKey: string;

	constructor(
		private readonly vectorStore: SupabaseVectorStoreService,
		private readonly prisma: PrismaService,
	) {
		// Get tenant_id and db_key from vector store config
		// In a real app, these would come from the request context or config
		const config = this.vectorStore.getConfig();
		this.tenantId = config.tenantId;
		this.dbKey = config.dbKey;
	}

	/**
	 * Ingest (or refresh) the database schema into the vector store
	 * Splits schema document into logical chunks for better recall
	 */
	async ingestDatabaseSchema(): Promise<number[]> {
		// Clear existing 'schema' collection before inserting new baseline provider schema
		try {
			await this.vectorStore.deleteChunksByCollection('schema' as AiChunkCollection);
			this.logger.log('Cleared existing schema chunks before static provider ingestion');
		} catch (err) {
			this.logger.warn('Failed to clear existing schema chunks before provider ingestion', err);
		}
		const schema = getCompleteDatabaseSchema();
		const chunks = this.splitSchemaIntoChunks(schema);

		const aiChunks = chunks.map((content) => ({
			tenantId: this.tenantId,
			collection: 'schema' as AiChunkCollection,
			dbKey: this.dbKey,
			content,
		}));

		return await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});
	}

	/**
	 * Ingest core business knowledge from DB (amenities, cost types, room rules)
	 * Stores as text chunks in the 'schema' collection for unified retrieval
	 */
	async ingestBusinessKnowledge(): Promise<number[]> {
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

		const businessDoc = this.buildBusinessKnowledgeText({ amenities, costTypes, roomRules });
		const chunks = this.splitSchemaIntoChunks(businessDoc);
		const aiChunks = chunks.map((content) => ({
			tenantId: this.tenantId,
			collection: 'business' as AiChunkCollection,
			dbKey: this.dbKey,
			content,
		}));

		return await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});
	}

	/**
	 * Ingest narrative business document (Vietnamese) into 'business' collection
	 */
	async ingestBusinessNarrative(): Promise<number[]> {
		const chunks = this.splitBusinessIntoChunks(BUSINESS_CONTEXT);
		const aiChunks = chunks.map((content) => ({
			tenantId: this.tenantId,
			collection: 'business' as AiChunkCollection,
			dbKey: this.dbKey,
			content,
		}));
		return await this.vectorStore.addChunks(aiChunks, {
			model: 'text-embedding-004',
			batchSize: 10,
		});
	}

	/**
	 * Convenience method to ingest both DB schema and business knowledge
	 */
	async ingestAllKnowledge(): Promise<{ schemaIds: number[]; businessIds: number[] }> {
		const [schemaIds, businessIds] = await Promise.all([
			this.ingestDatabaseSchema(),
			this.ingestBusinessKnowledge(),
		]);
		return { schemaIds, businessIds };
	}

	/**
	 * Decide whether to reuse existing canonical SQL or provide it as a hint.
	 */
	async decideCanonicalReuse(
		question: string,
		thresholds: { hard: number; soft: number } = { hard: 0.92, soft: 0.8 },
	): Promise<
		| {
				mode: 'reuse';
				sql: string;
				chunkId: number;
				sqlQAId: number;
				score: number;
				question: string;
				reusePreferred?: boolean;
		  }
		| {
				mode: 'hint';
				sql: string;
				chunkId: number;
				sqlQAId: number;
				score: number;
				question: string;
		  }
		| { mode: 'new' }
	> {
		// Exact-first check against sql_qa
		const normalized = this.normalizeQuestion(question);
		const exact = await this.vectorStore.searchSqlQA(normalized, {
			limit: 1,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
		const exactHit = exact.find((x) => this.normalizeQuestion(x.question) === normalized);
		if (exactHit?.sqlCanonical) {
			return {
				mode: 'reuse',
				sql: exactHit.sqlCanonical,
				chunkId: 0,
				sqlQAId: Number(exactHit.id),
				score: 1,
				question: exactHit.question,
				reusePreferred: true, // exact match → strongly prefer reuse
			};
		}

		// Vector similarity check
		const results = await this.vectorStore.similaritySearch(normalized, 'qa', {
			limit: 1,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
		const top = results[0];
		if (!top || typeof top.score !== 'number') {
			return { mode: 'new' };
		}
		const originalQuestion = this.extractQuestionFromContent(top.content);
		const matchList = await this.vectorStore.searchSqlQA(originalQuestion, {
			limit: 1,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
		const hit = matchList[0];
		if (!hit || !hit.sqlCanonical) {
			return { mode: 'new' };
		}
		if (top.score >= thresholds.hard) {
			return {
				mode: 'reuse',
				sql: hit.sqlCanonical,
				chunkId: Number(top.id),
				sqlQAId: Number(hit.id),
				score: top.score,
				question: hit.question,
				reusePreferred: top.score >= 0.99, // near exact → prefer reuse
			};
		}
		if (top.score >= thresholds.soft) {
			return {
				mode: 'hint',
				sql: hit.sqlCanonical,
				chunkId: Number(top.id),
				sqlQAId: Number(hit.id),
				score: top.score,
				question: hit.question,
			};
		}
		return { mode: 'new' };
	}

	/**
	 * Save a Q&A interaction with SQL canonical to vector store for self-learning
	 */
	async saveQAInteraction(params: {
		question: string;
		sql?: string;
		sessionId?: string;
		userId?: string;
		context?: Record<string, unknown>;
	}): Promise<{ chunkId: number; sqlQAId: number }> {
		const { question, sql } = params;

		// Exact-first check: reuse if identical question exists in sql_qa
		const normalized = this.normalizeQuestion(question);
		const exact = await this.vectorStore.searchSqlQA(normalized, {
			limit: 1,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
		const exactHit = exact.find((x) => this.normalizeQuestion(x.question) === normalized);
		if (exactHit) {
			this.logger.debug(`Reusing existing QA (exact) - SQL QA ID: ${exactHit.id}`);
			return { chunkId: 0, sqlQAId: Number(exactHit.id) };
		}

		// Reuse existing canonical SQL if a highly similar question already exists
		// IMPORTANT: For room-specific queries (with currentPageContext), we should NOT reuse
		// because each room has different SQL (different slug/id filter)
		// Only reuse if threshold is very high (0.95+) to avoid false matches
		const reuse = await this.findReusableCanonicalSql(question, 0.95);
		if (reuse) {
			this.logger.debug(
				`Reusing existing QA - Chunk ID: ${reuse.chunkId}, SQL QA ID: ${reuse.sqlQAId}`,
			);
			return { chunkId: reuse.chunkId, sqlQAId: reuse.sqlQAId };
		}

		// Similarity dedupe: if a near-duplicate QA chunk already exists, do not insert a new one
		// IMPORTANT: For room-specific queries, we should check if SQL is different (different slug/id)
		// Even if question is similar, SQL might be different (different room filter)
		try {
			const near = await this.vectorStore.similaritySearch(this.normalizeQuestion(question), 'qa', {
				limit: 1,
				tenantId: this.tenantId,
				dbKey: this.dbKey,
			});
			const top = near[0];
			if (top && typeof top.score === 'number' && top.score >= 0.95) {
				// Only skip if score is very high (0.95+) AND SQL is the same
				// For room-specific queries, even similar questions have different SQL (different slug/id)
				// So we should still save if SQL is different
				if (sql) {
					// Check if the existing QA has the same SQL
					const originalQuestion = this.extractQuestionFromContent(top.content);
					if (originalQuestion) {
						const matches = await this.vectorStore.searchSqlQA(originalQuestion, {
							limit: 1,
							tenantId: this.tenantId,
							dbKey: this.dbKey,
						});
						const hit = matches[0];
						if (hit?.sqlCanonical && hit.sqlCanonical === sql) {
							// Same question AND same SQL → skip
							this.logger.debug(
								`Skipping QA chunk insert (exact duplicate found, score=${top.score.toFixed(2)}, chunkId=${top.id}, same SQL)`,
							);
							return { chunkId: Number(top.id), sqlQAId: Number(hit.id) };
						}
						// Different SQL → save new QA even if question is similar
						this.logger.debug(
							`Question similar (score=${top.score.toFixed(2)}) but SQL different, saving new QA`,
						);
					}
				} else {
					// No SQL provided, skip if question is very similar
					this.logger.debug(
						`Skipping QA chunk insert (near-duplicate found, score=${top.score.toFixed(2)}, chunkId=${top.id}, no SQL to compare)`,
					);
					return { chunkId: Number(top.id), sqlQAId: 0 };
				}
			}
		} catch (e) {
			this.logger.warn('Similarity dedupe check failed, proceeding to save QA', e);
		}

		// Instead of full Q/A:
		// const qaContent = `Q: ${question}\nA: ${answer}`;
		const qaContent = `${question}`;
		let sqlQAId: number | undefined;
		if (sql) {
			const templated = this.buildSqlTemplate(sql, question);
			sqlQAId = await this.vectorStore.saveSqlQA({
				tenantId: this.tenantId,
				dbKey: this.dbKey,
				question,
				sqlCanonical: sql,
				sqlTemplate: templated.sqlTemplate,
				parameters: templated.parameters,
			});
		}
		const chunkId = await this.vectorStore.addChunk(
			{
				tenantId: this.tenantId,
				collection: 'qa',
				dbKey: this.dbKey,
				content: qaContent,
				sqlQaId: sqlQAId,
			},
			{ model: 'text-embedding-004' },
		);

		this.logger.debug(
			`Saved Q&A interaction - Chunk ID: ${chunkId}, SQL QA ID: ${sqlQAId || 'N/A'}`,
		);
		return { chunkId, sqlQAId: sqlQAId || 0 };
	}
	/**
	 * Very simple template builder: parameterize district literal in SQL.
	 * Extensible for other parameters later.
	 */
	private buildSqlTemplate(
		sql: string,
		_question: string,
	): {
		sqlTemplate: string;
		parameters: Record<string, unknown>;
	} {
		let sqlTemplate = sql;
		const parameters: Record<string, unknown> = {};
		// Match WHERE ... district_name (I)LIKE '%...%'
		const districtRegex = /(district_name\s+(?:ILIKE|LIKE)\s+)(['"])%([^%]+)%\2/iu;
		const m = sqlTemplate.match(districtRegex);
		if (m) {
			const district = m[3].trim();
			parameters.district = district;
			sqlTemplate = sqlTemplate.replace(districtRegex, `$1:district`);
		}
		return { sqlTemplate, parameters };
	}

	/**
	 * Retrieve similar schema snippets for a given query
	 */
	async retrieveSchemaContext(
		query: string,
		options: VectorSearchOptions = { limit: 5 },
	): Promise<VectorSearchResult[]> {
		return await this.vectorStore.similaritySearch(query, 'schema', {
			...options,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
	}

	/**
	 * Retrieve similar Q&A for a given query
	 */
	async retrieveKnowledgeContext(
		query: string,
		options: VectorSearchOptions = { limit: 5 },
	): Promise<VectorSearchResult[]> {
		return await this.vectorStore.similaritySearch(query, 'qa', {
			...options,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
	}

	/**
	 * Retrieve similar business narrative chunks
	 */
	async retrieveBusinessContext(
		query: string,
		options: VectorSearchOptions = { limit: 5 },
	): Promise<VectorSearchResult[]> {
		return await this.vectorStore.similaritySearch(query, 'business', {
			...options,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
	}

	/**
	 * Retrieve denormalized sample docs (rooms/requests) for keyword grounding
	 */
	async retrieveDocsContext(
		query: string,
		options: VectorSearchOptions = { limit: 5 },
	): Promise<VectorSearchResult[]> {
		return await this.vectorStore.similaritySearch(query, 'docs', {
			...options,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
	}

	/**
	 * Build RAG context blocks explicitly: schema first, optional business, optional QA
	 */
	async buildRagContext(
		query: string,
		params: {
			schemaLimit?: number;
			threshold?: number;
			includeBusiness?: boolean;
			includeQA?: boolean;
			qaLimit?: number;
		} = {},
	): Promise<{
		schemaBlock: string;
		businessBlock: string;
		qaBlock: string;
		ragContext: string;
		schemaCount: number;
		businessCount: number;
		qaCount: number;
	}> {
		const schemaLimit = params.schemaLimit ?? 32;
		const threshold = params.threshold ?? 0.6;
		const qaLimit = params.qaLimit ?? 2;

		const schemaResults = await this.retrieveSchemaContext(query, {
			limit: schemaLimit,
			threshold,
		});
		const schemaBlock = schemaResults.length
			? `RELEVANT SCHEMA CONTEXT (from vector search):\n${schemaResults
					.map((r) => r.content)
					.join('\n')}\n`
			: '';

		let businessBlock = '';
		let qaBlock = '';

		if (params.includeBusiness) {
			const businessResults = await this.retrieveBusinessContext(query, {
				limit: schemaLimit,
				threshold,
			});
			businessBlock = businessResults.length
				? `RELEVANT BUSINESS CONTEXT:\n${businessResults.map((r) => r.content).join('\n')}\n`
				: '';
		}

		if (params.includeQA) {
			const qaResults = await this.retrieveKnowledgeContext(query, { limit: qaLimit, threshold });
			qaBlock = qaResults.length
				? `RELEVANT Q&A EXAMPLES:\n${qaResults
						.slice(0, qaLimit)
						.map((r) => r.content)
						.join('\n')}\n`
				: '';
		}

		const ragContext = `${schemaBlock}${businessBlock}${qaBlock}`;
		return {
			schemaBlock,
			businessBlock,
			qaBlock,
			ragContext,
			schemaCount: schemaResults.length,
			businessCount: businessBlock ? businessBlock.split('\n').length : 0,
			qaCount: qaBlock ? qaBlock.split('\n').length : 0,
		};
	}

	/**
	 * Retrieve both schema and knowledge context
	 */
	async retrieveContext(
		query: string,
		options: VectorSearchOptions = { limit: 5 },
	): Promise<{
		schema: VectorSearchResult[];
		knowledge: VectorSearchResult[];
		business?: VectorSearchResult[];
	}> {
		const [schema, knowledge] = await Promise.all([
			this.retrieveSchemaContext(query, options),
			this.retrieveKnowledgeContext(query, options),
		]);

		return { schema, knowledge };
	}

	/**
	 * Find reusable canonical SQL by searching similar QA and mapping back to sql_qa.
	 * Returns existing ids if a confident match is found.
	 */
	private async findReusableCanonicalSql(
		question: string,
		threshold: number = 0.85,
	): Promise<{ chunkId: number; sqlQAId: number } | null> {
		const normalized = this.normalizeQuestion(question);
		const results = await this.vectorStore.similaritySearch(normalized, 'qa', {
			limit: 1,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
		const top = results[0];
		if (!top || (typeof top.score === 'number' && top.score < threshold)) {
			return null;
		}
		const originalQuestion = this.extractQuestionFromContent(top.content);
		if (!originalQuestion) {
			return null;
		}
		const matches = await this.vectorStore.searchSqlQA(originalQuestion, {
			limit: 1,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
		const hit = matches[0];
		if (!hit || !hit.sqlCanonical) {
			return null;
		}
		return { chunkId: Number(top.id), sqlQAId: Number(hit.id) };
	}

	private normalizeQuestion(input: string): string {
		return (
			(input || '')
				.toLowerCase()
				.normalize('NFC')
				// Remove common punctuation (.,!?:;) to avoid minor differences
				.replace(/[.,!?;:]+/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
		);
	}

	private extractQuestionFromContent(content: string): string {
		const qPrefix = 'Q: ';
		const start = content.indexOf(qPrefix);
		if (start === -1) {
			// Fallback: treat entire content as the question if no prefix is present
			return (content || '').trim();
		}
		const rest = content.slice(start + qPrefix.length);
		const end = rest.indexOf('\n');
		return end === -1 ? rest.trim() : rest.slice(0, end).trim();
	}

	/**
	 * Search SQL QA entries by question
	 */
	async searchSqlQA(searchTerm?: string, limit: number = 10): Promise<SqlQAEntry[]> {
		return await this.vectorStore.searchSqlQA(searchTerm || '', {
			limit,
			tenantId: this.tenantId,
			dbKey: this.dbKey,
		});
	}

	/**
	 * Find chunk ID linked to a SQL QA entry
	 */
	async findChunkBySqlQAId(sqlQAId: number): Promise<number | null> {
		return await this.vectorStore.findChunkBySqlQAId(sqlQAId);
	}

	/**
	 * Find SQL QA ID linked to a chunk
	 */
	async findSqlQAIdByChunkId(chunkId: number): Promise<number | null> {
		return await this.vectorStore.findSqlQAIdByChunkId(chunkId);
	}

	private splitSchemaIntoChunks(schema: string): string[] {
		const lines = schema.split('\n');
		const chunks: string[] = [];
		for (let i = 0; i < lines.length; i += MAX_LINES_PER_SCHEMA_CHUNK) {
			chunks.push(lines.slice(i, i + MAX_LINES_PER_SCHEMA_CHUNK).join('\n'));
		}
		return chunks.filter((c) => c.trim().length > 0);
	}

	private splitBusinessIntoChunks(doc: string): string[] {
		// Split by major headings to keep semantics (CHƯƠNG, numbered sections)
		const normalized = (doc || '').replace(/\r\n/g, '\n').trim();
		const sections = normalized.split(/\n(?=CHƯƠNG\s+\d+|\d+\.[^\n]+)/u);
		return sections.map((s) => s.trim()).filter((s) => s.length > 0);
	}

	private buildBusinessKnowledgeText(input: {
		amenities: Array<{
			id: string;
			name: string;
			nameEn: string;
			category: string;
			description: string | null;
		}>;
		costTypes: Array<{
			id: string;
			name: string;
			nameEn: string;
			category: string;
			defaultUnit: string | null;
			description: string | null;
		}>;
		roomRules: Array<{
			id: string;
			name: string;
			nameEn: string;
			category: string;
			ruleType: string;
			description: string | null;
		}>;
	}): string {
		const mapNull = (v?: string | null): string => (v && v.trim().length > 0 ? v.trim() : '-');
		const amenitySection = [
			'# Business: Amenities',
			...input.amenities.map(
				(a) =>
					`Amenity | id=${a.id} | key=${a.nameEn} | name=${a.name} | category=${a.category} | description=${mapNull(a.description)}`,
			),
		].join('\n');
		const costTypeSection = [
			'# Business: Cost Types',
			...input.costTypes.map(
				(c) =>
					`CostType | id=${c.id} | key=${c.nameEn} | name=${c.name} | category=${c.category} | unit=${mapNull(c.defaultUnit)} | description=${mapNull(c.description)}`,
			),
		].join('\n');
		const ruleSection = [
			'# Business: Room Rules',
			...input.roomRules.map(
				(r) =>
					`RoomRule | id=${r.id} | key=${r.nameEn} | name=${r.name} | category=${r.category} | type=${r.ruleType} | description=${mapNull(r.description)}`,
			),
		].join('\n');
		return [amenitySection, costTypeSection, ruleSection].join('\n\n');
	}

	/**
	 * Get canonical SQL QA list with pagination and search
	 * @param params - Query parameters
	 * @returns Paginated list of SQL QA entries
	 */
	async getCanonicalList(params: {
		search?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ items: any[]; total: number; limit: number; offset: number }> {
		return await this.vectorStore.getCanonicalList(params);
	}

	/**
	 * Get AI chunks list with pagination, search, and filter
	 * @param params - Query parameters
	 * @returns Paginated list of AI chunks
	 */
	async getChunksList(params: {
		search?: string;
		collection?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ items: any[]; total: number; limit: number; offset: number }> {
		return await this.vectorStore.getChunksList({
			...params,
			collection: params.collection as AiChunkCollection | undefined,
		});
	}

	/**
	 * Teach new knowledge or update existing knowledge
	 * @param params - Teaching parameters
	 * @returns Result with chunkId, sqlQAId, and isUpdate flag
	 */
	async teachOrUpdateKnowledge(params: {
		id?: number;
		question: string;
		sql: string;
		sessionId?: string;
		userId?: string;
	}): Promise<{ chunkId: number; sqlQAId: number; isUpdate: boolean }> {
		if (params.id) {
			// Update existing SQL QA entry
			await this.vectorStore.updateSqlQA(params.id, {
				question: params.question,
				sqlCanonical: params.sql,
			});
			// Build SQL template from the updated SQL
			const templated = this.buildSqlTemplate(params.sql, params.question);
			// Update template and parameters if needed
			if (templated.sqlTemplate || templated.parameters) {
				await this.vectorStore.updateSqlQA(params.id, {
					sqlTemplate: templated.sqlTemplate,
					parameters: templated.parameters,
				});
			}
			// Find associated chunk by SQL QA ID
			const existingChunkId = await this.vectorStore.findChunkBySqlQAId(params.id);
			let chunkId = 0;
			if (existingChunkId) {
				// Update existing chunk with new question content and regenerate embedding
				const qaContent = `${params.question}`;
				await this.vectorStore.updateChunk(existingChunkId, qaContent, {
					model: 'text-embedding-004',
				});
				chunkId = existingChunkId;
				this.logger.debug(`Updated existing chunk ${chunkId} for SQL QA ${params.id}`);
			} else {
				// No chunk exists, create a new one
				const qaContent = `${params.question}`;
				chunkId = await this.vectorStore.addChunk(
					{
						tenantId: this.tenantId,
						collection: 'qa',
						dbKey: this.dbKey,
						content: qaContent,
						sqlQaId: params.id,
					},
					{ model: 'text-embedding-004' },
				);
				this.logger.debug(`Created new chunk ${chunkId} for SQL QA ${params.id}`);
			}
			return {
				chunkId,
				sqlQAId: params.id,
				isUpdate: true,
			};
		} else {
			// Add new knowledge (same as saveQAInteraction)
			const result = await this.saveQAInteraction({
				question: params.question,
				sql: params.sql,
				sessionId: params.sessionId,
				userId: params.userId,
			});
			return {
				chunkId: result.chunkId,
				sqlQAId: result.sqlQAId,
				isUpdate: false,
			};
		}
	}

	/**
	 * Delete knowledge (chunk or SQL QA) with relationship checks
	 * @param params - Delete parameters
	 * @returns Deletion result
	 */
	async deleteKnowledge(params: { type: 'chunk' | 'sql_qa'; id: number }): Promise<{
		success: boolean;
		deletedChunks?: number;
		deletedSqlQA?: number;
		message: string;
	}> {
		try {
			if (params.type === 'chunk') {
				// Delete chunk - check if it's linked to SQL QA
				const sqlQAId = await this.vectorStore.findSqlQAIdByChunkId(params.id);
				if (sqlQAId) {
					// Chunk is linked to SQL QA - only delete chunk, keep SQL QA
					const deletedChunks = await this.vectorStore.deleteChunks([params.id]);
					this.logger.log(
						`Deleted chunk ${params.id} (was linked to SQL QA ${sqlQAId}, SQL QA kept)`,
					);
					return {
						success: true,
						deletedChunks,
						message: `Deleted chunk ${params.id}. Linked SQL QA ${sqlQAId} was kept.`,
					};
				} else {
					// Chunk is not linked - safe to delete
					const deletedChunks = await this.vectorStore.deleteChunks([params.id]);
					this.logger.log(`Deleted chunk ${params.id}`);
					return {
						success: true,
						deletedChunks,
						message: `Deleted chunk ${params.id}.`,
					};
				}
			} else if (params.type === 'sql_qa') {
				// Delete SQL QA - will also delete all linked chunks
				const result = await this.vectorStore.deleteSqlQA(params.id);
				this.logger.log(`Deleted SQL QA ${params.id} and ${result.deletedChunks} linked chunks`);
				return {
					success: true,
					deletedChunks: result.deletedChunks,
					deletedSqlQA: result.deletedSqlQA,
					message: `Deleted SQL QA ${params.id} and ${result.deletedChunks} linked chunks.`,
				};
			} else {
				throw new Error(`Invalid delete type: ${params.type}`);
			}
		} catch (error) {
			this.logger.error(`Failed to delete knowledge:`, error);
			throw error;
		}
	}
}
