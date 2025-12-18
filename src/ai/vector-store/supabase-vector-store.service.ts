import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
	AiChunkCollection,
	AiChunkWithEmbedding,
	EmbeddingOptions,
	SqlQAEntry,
	SqlQASearchOptions,
	SupabaseVectorStoreConfig,
	VectorSearchOptions,
	VectorSearchResult,
} from './types/vector.types';

/**
 * Supabase Vector Store Service
 * Handles storing and querying vector embeddings using Supabase + pgvector
 * Uses unified ai_chunks table with tenant_id, collection, and db_key
 */
@Injectable()
export class SupabaseVectorStoreService implements OnModuleInit {
	private readonly logger = new Logger(SupabaseVectorStoreService.name);
	private supabaseClient: SupabaseClient;
	private readonly config: SupabaseVectorStoreConfig;

	private genAI?: GoogleGenAI;

	constructor(
		private readonly supabaseUrl: string,
		private readonly supabaseKey: string,
		config: SupabaseVectorStoreConfig,
		@Optional() @Inject('GOOGLE_API_KEY') googleApiKey?: string,
	) {
		if (googleApiKey) {
			this.genAI = new GoogleGenAI({ apiKey: googleApiKey });
		}
		if (!config.tenantId || !config.dbKey) {
			throw new Error('tenantId and dbKey are required in SupabaseVectorStoreConfig');
		}
		this.config = config;
	}

	onModuleInit(): void {
		this.supabaseClient = createClient(this.supabaseUrl, this.supabaseKey);
		this.logger.log(
			`Supabase Vector Store initialized for tenant: ${this.config.tenantId}, db: ${this.config.dbKey}`,
		);
	}

	getConfig(): SupabaseVectorStoreConfig {
		return this.config;
	}

	/**
	 * Generate embedding for a text using Google GenAI
	 * @param text - Text to generate embedding for
	 * @param options - Embedding generation options
	 * @returns Embedding vector
	 */
	async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
		try {
			if (!this.genAI) {
				throw new Error('Google API key not configured');
			}
			const result = await this.genAI.models.embedContent({
				model: options?.model || 'text-embedding-004',
				contents: text,
			});
			if (!result.embeddings || !result.embeddings[0] || !result.embeddings[0].values) {
				throw new Error('Invalid response structure from Google API');
			}
			return result.embeddings[0].values;
		} catch (error) {
			this.logger.error('Failed to generate embedding:', error);
			throw new Error(`Failed to generate embedding: ${error.message}`);
		}
	}

	/**
	 * Generate embeddings for multiple texts
	 * @param texts - Array of texts to generate embeddings for
	 * @param options - Embedding generation options
	 * @returns Array of embedding vectors
	 */
	async generateEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
		try {
			const batchSize = options?.batchSize || 10;
			const embeddings: number[][] = [];

			for (let i = 0; i < texts.length; i += batchSize) {
				const batch = texts.slice(i, i + batchSize);
				const batchEmbeddings = await Promise.all(
					batch.map((text) => this.generateEmbedding(text, options)),
				);
				embeddings.push(...batchEmbeddings);
			}

			return embeddings;
		} catch (error) {
			this.logger.error('Failed to generate embeddings:', error);
			throw new Error(`Failed to generate embeddings: ${error.message}`);
		}
	}

	/**
	 * Add a single AI chunk with embedding to ai_chunks table
	 * @param chunk - AI chunk with content and collection type
	 * @param options - Embedding generation options
	 * @returns Created chunk ID
	 */
	async addChunk(
		chunk: AiChunkWithEmbedding & { sqlQaId?: number },
		options?: EmbeddingOptions,
	): Promise<number> {
		try {
			this.logger.debug(
				`Adding chunk | collection=${chunk.collection} | hasEmbedding=${!!chunk.embedding} | sqlQaId=${chunk.sqlQaId || 'none'}`,
			);
			let embedding = chunk.embedding;

			if (!embedding) {
				this.logger.debug(`Generating embedding for chunk content`);
				embedding = await this.generateEmbedding(chunk.content, options);
			}

			this.logger.log(
				`Inserting new chunk (POST request) | collection=${chunk.collection} | content="${chunk.content.substring(0, 50)}..."`,
			);
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.insert({
					tenant_id: chunk.tenantId || this.config.tenantId,
					collection: chunk.collection,
					db_key: chunk.dbKey || this.config.dbKey,
					content: chunk.content,
					embedding: embedding,
					sql_qa_id: chunk.sqlQaId, // store link if present
				})
				.select('id')
				.single();

			if (error) {
				this.logger.error(`Failed to insert chunk: ${error.message}`, error);
				throw new Error(`Failed to insert chunk: ${error.message}`);
			}

			this.logger.log(
				`Chunk inserted successfully (POST) | id=${data.id} | collection=${chunk.collection}`,
			);
			return data.id;
		} catch (error) {
			this.logger.error('Error adding chunk:', error);
			throw error;
		}
	}

	/**
	 * Add multiple AI chunks with embeddings
	 * @param chunks - Array of chunks to add
	 * @param options - Embedding generation options
	 * @returns Array of created chunk IDs
	 */
	async addChunks(
		chunks: (AiChunkWithEmbedding & { sqlQaId?: number })[],
		options?: EmbeddingOptions,
	): Promise<number[]> {
		try {
			const texts = chunks.map((chunk) => chunk.content);
			const embeddings = await this.generateEmbeddings(texts, options);

			const records = chunks.map((chunk, index) => ({
				tenant_id: chunk.tenantId || this.config.tenantId,
				collection: chunk.collection,
				db_key: chunk.dbKey || this.config.dbKey,
				content: chunk.content,
				embedding: embeddings[index],
				sql_qa_id: chunk.sqlQaId,
			}));

			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.insert(records)
				.select('id');

			if (error) {
				throw new Error(`Failed to insert chunks: ${error.message}`);
			}

			const ids = data.map((item) => item.id);
			this.logger.debug(`Added ${ids.length} chunks to vector store`);
			return ids;
		} catch (error) {
			this.logger.error('Error adding chunks:', error);
			throw error;
		}
	}

	/**
	 * Search for similar chunks using vector similarity
	 * @param query - Search query text
	 * @param collection - Collection type ('schema' or 'qa')
	 * @param options - Search options (limit, threshold)
	 * @returns Array of search results with similarity scores
	 */
	async similaritySearch(
		query: string,
		collection: AiChunkCollection,
		options: VectorSearchOptions = {},
	): Promise<VectorSearchResult[]> {
		try {
			const queryEmbedding = await this.generateEmbedding(query);
			const limit = options.limit || 8;
			const tenantId = options.tenantId || this.config.tenantId;
			const dbKey = options.dbKey || this.config.dbKey;

			const { data, error } = await this.supabaseClient.rpc('match_ai_chunks', {
				p_tenant_id: tenantId,
				p_db_key: dbKey,
				p_collection: collection,
				p_emb: queryEmbedding,
				p_top_k: limit,
			});

			if (error) {
				throw new Error(`Failed to search chunks: ${error.message}`);
			}

			return (data || []).map((item: any) => ({
				id: item.id,
				content: item.content,
				collection: collection,
				score: item.score,
				similarity: item.score,
			}));
		} catch (error) {
			this.logger.error('Error in similarity search:', error);
			throw error;
		}
	}

	/**
	 * Search across all collections
	 * @param query - Search query text
	 * @param options - Search options
	 * @returns Array of search results with collection type
	 */
	async similaritySearchAny(
		query: string,
		options: VectorSearchOptions = {},
	): Promise<VectorSearchResult[]> {
		try {
			const queryEmbedding = await this.generateEmbedding(query);
			const limit = options.limit || 8;
			const tenantId = options.tenantId || this.config.tenantId;
			const dbKey = options.dbKey || this.config.dbKey;

			const { data, error } = await this.supabaseClient.rpc('match_ai_chunks_any', {
				p_tenant_id: tenantId,
				p_db_key: dbKey,
				p_emb: queryEmbedding,
				p_top_k: limit,
			});

			if (error) {
				throw new Error(`Failed to search chunks: ${error.message}`);
			}

			return (data || []).map((item: any) => ({
				id: item.id,
				content: item.content,
				collection: item.collection,
				score: item.score,
				similarity: item.score,
			}));
		} catch (error) {
			this.logger.error('Error in similarity search any:', error);
			throw error;
		}
	}

	private normalizeSqlTemplate(template?: string): string {
		if (!template) return '';
		return template.toLowerCase().replace(/\s+/g, ' ').trim();
	}

	/**
	 * Save SQL QA entry to sql_qa table
	 * @param entry - SQL QA entry with question and canonical SQL
	 * @returns Created entry ID
	 */
	async saveSqlQA(entry: SqlQAEntry): Promise<number> {
		try {
			this.logger.debug(
				`Saving SQL QA | question="${entry.question.substring(0, 50)}..." | hasTemplate=${!!entry.sqlTemplate}`,
			);
			const normalizedTemplate = this.normalizeSqlTemplate(entry.sqlTemplate);
			if (normalizedTemplate) {
				const { data: existing } = await this.supabaseClient
					.from('sql_qa')
					.select('id')
					.eq('tenant_id', entry.tenantId || this.config.tenantId)
					.eq('db_key', entry.dbKey || this.config.dbKey)
					.eq('sql_template', normalizedTemplate)
					.maybeSingle();
				if (existing?.id) {
					this.logger.log(
						`SQL QA template already exists (UPDATE, not INSERT) | id=${existing.id} | template="${normalizedTemplate.substring(0, 50)}..."`,
					);
					await this.supabaseClient
						.from('sql_qa')
						.update({ last_used_at: new Date().toISOString() })
						.eq('id', existing.id);
					this.logger.debug(
						`Canonical SQL (template) exists, not inserting. Using id: ${existing.id}`,
					);
					return existing.id;
				}
			}
			// No template or not found, insert new
			this.logger.log(
				`Inserting new SQL QA | question="${entry.question.substring(0, 50)}..." | hasTemplate=${!!normalizedTemplate}`,
			);
			const payload: any = {
				tenant_id: entry.tenantId || this.config.tenantId,
				db_key: entry.dbKey || this.config.dbKey,
				question: entry.question,
				sql_canonical: entry.sqlCanonical,
				sql_template: normalizedTemplate || null,
				parameters: entry.parameters || null,
				last_used_at: new Date().toISOString(),
			};
			const conflictTarget = normalizedTemplate
				? 'tenant_id,db_key,sql_template'
				: 'tenant_id,db_key,question';
			const { data, error } = await this.supabaseClient
				.from('sql_qa')
				.upsert(payload, { onConflict: conflictTarget })
				.select('id')
				.single();
			if (error) {
				this.logger.error(`Failed to upsert SQL QA: ${error.message}`, error);
				throw new Error(`Failed to insert SQL QA: ${error.message}`);
			}
			this.logger.log(
				`SQL QA upserted successfully | id=${data.id} | question="${entry.question.substring(0, 50)}..." | (Note: upsert may UPDATE if exists, check Supabase logs)`,
			);
			return data.id;
		} catch (error) {
			this.logger.error('Error saving SQL QA:', error);
			throw error;
		}
	}

	/**
	 * Search SQL QA entries by question text
	 * @param searchTerm - Search term to match against questions
	 * @param options - Search options
	 * @returns Array of matching SQL QA entries
	 */
	async searchSqlQA(searchTerm: string, options: SqlQASearchOptions = {}): Promise<SqlQAEntry[]> {
		try {
			const limit = options.limit || 10;
			const tenantId = options.tenantId || this.config.tenantId;
			const dbKey = options.dbKey || this.config.dbKey;

			let queryBuilder = this.supabaseClient
				.from('sql_qa')
				.select('*')
				.eq('tenant_id', tenantId)
				.eq('db_key', dbKey);

			if (searchTerm) {
				queryBuilder = queryBuilder.ilike('question', `%${searchTerm}%`);
			}

			const { data, error } = await queryBuilder
				.order('created_at', { ascending: false })
				.limit(limit);

			if (error) {
				throw new Error(`Failed to search SQL QA: ${error.message}`);
			}

			return (data || []).map((item: any) => ({
				id: item.id,
				tenantId: item.tenant_id,
				dbKey: item.db_key,
				question: item.question,
				sqlCanonical: item.sql_canonical,
			}));
		} catch (error) {
			this.logger.error('Error searching SQL QA:', error);
			throw error;
		}
	}

	/**
	 * Delete chunks by IDs
	 * @param ids - Array of chunk IDs to delete
	 * @returns Number of deleted chunks
	 */
	async deleteChunks(ids: number[]): Promise<number> {
		try {
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.delete()
				.in('id', ids)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.select('id');

			if (error) {
				throw new Error(`Failed to delete chunks: ${error.message}`);
			}

			const deletedCount = data?.length || 0;
			this.logger.debug(`Deleted ${deletedCount} chunks`);
			return deletedCount;
		} catch (error) {
			this.logger.error('Error deleting chunks:', error);
			throw error;
		}
	}

	/**
	 * Delete chunks by collection type
	 * @param collection - Collection type to delete
	 * @returns Number of deleted chunks
	 */
	async deleteChunksByCollection(collection: AiChunkCollection): Promise<number> {
		try {
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.delete()
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.eq('collection', collection)
				.select('id');

			if (error) {
				throw new Error(`Failed to delete chunks by collection: ${error.message}`);
			}

			const deletedCount = data?.length || 0;
			this.logger.debug(`Deleted ${deletedCount} chunks from collection: ${collection}`);
			return deletedCount;
		} catch (error) {
			this.logger.error('Error deleting chunks by collection:', error);
			throw error;
		}
	}

	/**
	 * Legacy method for backward compatibility
	 * @deprecated Use addChunk instead
	 */
	async addDocument(chunk: any, options?: EmbeddingOptions): Promise<string> {
		if (chunk.collection && chunk.content) {
			const id = await this.addChunk(
				{
					tenantId: chunk.tenantId || this.config.tenantId,
					collection: chunk.collection,
					dbKey: chunk.dbKey || this.config.dbKey,
					content: chunk.content,
					embedding: chunk.embedding,
				},
				options,
			);
			return id.toString();
		}
		throw new Error('Invalid document format. Use addChunk with collection property.');
	}

	/**
	 * Legacy method for backward compatibility
	 * @deprecated Use addChunks instead
	 */
	async addDocuments(chunks: any[], options?: EmbeddingOptions): Promise<string[]> {
		if (chunks.length > 0 && chunks[0].collection && chunks[0].content) {
			const ids = await this.addChunks(
				chunks.map((chunk) => ({
					tenantId: chunk.tenantId || this.config.tenantId,
					collection: chunk.collection,
					dbKey: chunk.dbKey || this.config.dbKey,
					content: chunk.content,
					embedding: chunk.embedding,
				})),
				options,
			);
			return ids.map((id) => id.toString());
		}
		throw new Error('Invalid documents format. Use addChunks with collection property.');
	}

	/**
	 * Get canonical SQL QA list with pagination, search, and sorting
	 * @param params - Query parameters
	 * @returns Paginated list of SQL QA entries
	 */
	async getCanonicalList(params: {
		search?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ items: any[]; total: number; limit: number; offset: number }> {
		try {
			const limit = params.limit || 20;
			const offset = params.offset || 0;
			const tenantId = this.config.tenantId;
			const dbKey = this.config.dbKey;

			let queryBuilder = this.supabaseClient
				.from('sql_qa')
				.select('*', { count: 'exact' })
				.eq('tenant_id', tenantId)
				.eq('db_key', dbKey);

			if (params.search) {
				queryBuilder = queryBuilder.ilike('question', `%${params.search}%`);
			}

			const { data, error, count } = await queryBuilder
				.order('created_at', { ascending: false })
				.range(offset, offset + limit - 1);

			if (error) {
				throw new Error(`Failed to get canonical list: ${error.message}`);
			}

			const items = (data || []).map((item: any) => ({
				id: item.id,
				question: item.question,
				sqlCanonical: item.sql_canonical,
				sqlTemplate: item.sql_template,
				parameters: item.parameters,
				createdAt: item.created_at,
				updatedAt: item.updated_at,
				lastUsedAt: item.last_used_at,
			}));

			return {
				items,
				total: count || 0,
				limit,
				offset,
			};
		} catch (error) {
			this.logger.error('Error getting canonical list:', error);
			throw error;
		}
	}

	/**
	 * Get AI chunks list with pagination, search, filter, and sorting
	 * @param params - Query parameters
	 * @returns Paginated list of AI chunks
	 */
	async getChunksList(params: {
		search?: string;
		collection?: AiChunkCollection;
		limit?: number;
		offset?: number;
	}): Promise<{ items: any[]; total: number; limit: number; offset: number }> {
		try {
			const limit = params.limit || 20;
			const offset = params.offset || 0;
			const tenantId = this.config.tenantId;
			const dbKey = this.config.dbKey;

			let queryBuilder = this.supabaseClient
				.from('ai_chunks')
				.select('id, collection, content, created_at, updated_at', { count: 'exact' })
				.eq('tenant_id', tenantId)
				.eq('db_key', dbKey);

			if (params.collection) {
				queryBuilder = queryBuilder.eq('collection', params.collection);
			}

			if (params.search) {
				queryBuilder = queryBuilder.ilike('content', `%${params.search}%`);
			}

			const { data, error, count } = await queryBuilder
				.order('created_at', { ascending: false })
				.range(offset, offset + limit - 1);

			if (error) {
				throw new Error(`Failed to get chunks list: ${error.message}`);
			}

			const items = (data || []).map((item: any) => ({
				id: item.id,
				collection: item.collection,
				content: item.content,
				createdAt: item.created_at,
				updatedAt: item.updated_at,
			}));

			return {
				items,
				total: count || 0,
				limit,
				offset,
			};
		} catch (error) {
			this.logger.error('Error getting chunks list:', error);
			throw error;
		}
	}

	/**
	 * Get single chunk by ID
	 * @param id - Chunk ID
	 * @returns Chunk data or null
	 */
	async getChunkById(id: number): Promise<any | null> {
		try {
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.select('id, collection, content, created_at, updated_at')
				.eq('id', id)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.single();

			if (error) {
				if (error.code === 'PGRST116') {
					return null;
				}
				throw new Error(`Failed to get chunk: ${error.message}`);
			}

			return {
				id: data.id,
				collection: data.collection,
				content: data.content,
				createdAt: data.created_at,
				updatedAt: data.updated_at,
			};
		} catch (error) {
			this.logger.error(`Error getting chunk by id: ${id}`, error);
			throw error;
		}
	}

	/**
	 * Update SQL QA entry
	 * @param id - SQL QA ID
	 * @param data - Update data
	 * @returns Updated SQL QA entry
	 */
	async updateSqlQA(
		id: number,
		data: {
			question?: string;
			sqlCanonical?: string;
			sqlTemplate?: string;
			parameters?: Record<string, unknown>;
		},
	): Promise<any> {
		try {
			const updatePayload: any = {
				updated_at: new Date().toISOString(),
			};

			if (data.question !== undefined) {
				updatePayload.question = data.question;
			}
			if (data.sqlCanonical !== undefined) {
				updatePayload.sql_canonical = data.sqlCanonical;
			}
			if (data.sqlTemplate !== undefined) {
				updatePayload.sql_template = data.sqlTemplate;
			}
			if (data.parameters !== undefined) {
				updatePayload.parameters = data.parameters;
			}

			const { data: updated, error } = await this.supabaseClient
				.from('sql_qa')
				.update(updatePayload)
				.eq('id', id)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.select()
				.single();

			if (error) {
				throw new Error(`Failed to update SQL QA: ${error.message}`);
			}

			return {
				id: updated.id,
				question: updated.question,
				sqlCanonical: updated.sql_canonical,
				sqlTemplate: updated.sql_template,
				parameters: updated.parameters,
				createdAt: updated.created_at,
				updatedAt: updated.updated_at,
				lastUsedAt: updated.last_used_at,
			};
		} catch (error) {
			this.logger.error(`Error updating SQL QA: ${id}`, error);
			throw error;
		}
	}

	/**
	 * Update AI chunk content and regenerate embedding
	 * @param id - Chunk ID
	 * @param content - New content
	 * @param options - Embedding generation options
	 * @returns Updated chunk ID
	 */
	async updateChunk(id: number, content: string, options?: EmbeddingOptions): Promise<number> {
		try {
			const embedding = await this.generateEmbedding(content, options);
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.update({
					content,
					embedding,
					updated_at: new Date().toISOString(),
				})
				.eq('id', id)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.select('id')
				.single();

			if (error) {
				throw new Error(`Failed to update chunk: ${error.message}`);
			}

			this.logger.debug(`Chunk updated with ID: ${data.id}`);
			return data.id;
		} catch (error) {
			this.logger.error(`Error updating chunk: ${id}`, error);
			throw error;
		}
	}

	/**
	 * Find chunk by SQL QA ID
	 * @param sqlQAId - SQL QA ID
	 * @returns Chunk ID or null
	 */
	async findChunkBySqlQAId(sqlQAId: number): Promise<number | null> {
		try {
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.select('id')
				.eq('sql_qa_id', sqlQAId)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.maybeSingle();

			if (error) {
				throw new Error(`Failed to find chunk by SQL QA ID: ${error.message}`);
			}

			return data?.id ? Number(data.id) : null;
		} catch (error) {
			this.logger.error(`Error finding chunk by SQL QA ID: ${sqlQAId}`, error);
			throw error;
		}
	}

	/**
	 * Find SQL QA ID by chunk ID
	 * @param chunkId - Chunk ID
	 * @returns SQL QA ID or null
	 */
	async findSqlQAIdByChunkId(chunkId: number): Promise<number | null> {
		try {
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.select('sql_qa_id')
				.eq('id', chunkId)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.maybeSingle();

			if (error) {
				throw new Error(`Failed to find SQL QA ID by chunk ID: ${error.message}`);
			}

			return data?.sql_qa_id ? Number(data.sql_qa_id) : null;
		} catch (error) {
			this.logger.error(`Error finding SQL QA ID by chunk ID: ${chunkId}`, error);
			throw error;
		}
	}

	/**
	 * Find all chunks linked to a SQL QA ID
	 * @param sqlQAId - SQL QA ID
	 * @returns Array of chunk IDs
	 */
	async findChunksBySqlQAId(sqlQAId: number): Promise<number[]> {
		try {
			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.select('id')
				.eq('sql_qa_id', sqlQAId)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey);

			if (error) {
				throw new Error(`Failed to find chunks by SQL QA ID: ${error.message}`);
			}

			return (data || []).map((item: any) => Number(item.id));
		} catch (error) {
			this.logger.error(`Error finding chunks by SQL QA ID: ${sqlQAId}`, error);
			throw error;
		}
	}

	/**
	 * Delete SQL QA entry and all linked chunks
	 * @param id - SQL QA ID
	 * @returns Number of deleted chunks and SQL QA entry
	 */
	async deleteSqlQA(id: number): Promise<{ deletedChunks: number; deletedSqlQA: number }> {
		try {
			// Find all chunks linked to this SQL QA
			const linkedChunkIds = await this.findChunksBySqlQAId(id);

			// Delete linked chunks first
			let deletedChunks = 0;
			if (linkedChunkIds.length > 0) {
				deletedChunks = await this.deleteChunks(linkedChunkIds);
				this.logger.debug(`Deleted ${deletedChunks} chunks linked to SQL QA ${id}`);
			}

			// Delete SQL QA entry
			const { data, error } = await this.supabaseClient
				.from('sql_qa')
				.delete()
				.eq('id', id)
				.eq('tenant_id', this.config.tenantId)
				.eq('db_key', this.config.dbKey)
				.select('id');

			if (error) {
				throw new Error(`Failed to delete SQL QA: ${error.message}`);
			}

			const deletedSqlQA = data?.length || 0;
			this.logger.debug(`Deleted SQL QA ${id} and ${deletedChunks} linked chunks`);

			return { deletedChunks, deletedSqlQA };
		} catch (error) {
			this.logger.error(`Error deleting SQL QA ${id}:`, error);
			throw error;
		}
	}
}
