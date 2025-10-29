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
	async addChunk(chunk: AiChunkWithEmbedding, options?: EmbeddingOptions): Promise<number> {
		try {
			let embedding = chunk.embedding;

			if (!embedding) {
				embedding = await this.generateEmbedding(chunk.content, options);
			}

			const { data, error } = await this.supabaseClient
				.from('ai_chunks')
				.insert({
					tenant_id: chunk.tenantId || this.config.tenantId,
					collection: chunk.collection,
					db_key: chunk.dbKey || this.config.dbKey,
					content: chunk.content,
					embedding: embedding,
				})
				.select('id')
				.single();

			if (error) {
				throw new Error(`Failed to insert chunk: ${error.message}`);
			}

			this.logger.debug(`Chunk added with ID: ${data.id}`);
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
	async addChunks(chunks: AiChunkWithEmbedding[], options?: EmbeddingOptions): Promise<number[]> {
		try {
			const texts = chunks.map((chunk) => chunk.content);
			const embeddings = await this.generateEmbeddings(texts, options);

			const records = chunks.map((chunk, index) => ({
				tenant_id: chunk.tenantId || this.config.tenantId,
				collection: chunk.collection,
				db_key: chunk.dbKey || this.config.dbKey,
				content: chunk.content,
				embedding: embeddings[index],
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

	/**
	 * Save SQL QA entry to sql_qa table
	 * @param entry - SQL QA entry with question and canonical SQL
	 * @returns Created entry ID
	 */
	async saveSqlQA(entry: SqlQAEntry): Promise<number> {
		try {
			const { data, error } = await this.supabaseClient
				.from('sql_qa')
				.insert({
					tenant_id: entry.tenantId || this.config.tenantId,
					db_key: entry.dbKey || this.config.dbKey,
					question: entry.question,
					sql_canonical: entry.sqlCanonical,
				})
				.select('id')
				.single();

			if (error) {
				throw new Error(`Failed to insert SQL QA: ${error.message}`);
			}

			this.logger.debug(`SQL QA saved with ID: ${data.id}`);
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
}
