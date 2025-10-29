/**
 * AI Chunk collection type
 */
export type AiChunkCollection = 'schema' | 'qa';

/**
 * AI Chunk with embedding for ai_chunks table
 */
export interface AiChunkWithEmbedding {
	id?: number;
	tenantId: string;
	collection: AiChunkCollection;
	dbKey: string;
	content: string;
	embedding?: number[];
}

/**
 * Vector search result from ai_chunks
 */
export interface VectorSearchResult {
	id?: string | number;
	content: string;
	collection?: AiChunkCollection;
	similarity?: number;
	score?: number;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
	limit?: number;
	threshold?: number;
	collection?: AiChunkCollection;
	includeMetadata?: boolean;
	tenantId?: string;
	dbKey?: string;
}

/**
 * Supabase vector store configuration
 */
export interface SupabaseVectorStoreConfig {
	tenantId: string;
	dbKey: string;
}

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
	model?: string;
	batchSize?: number;
}

/**
 * SQL QA entry for sql_qa table
 */
export interface SqlQAEntry {
	id?: number;
	tenantId: string;
	dbKey: string;
	question: string;
	sqlCanonical: string;
}

/**
 * SQL QA search options
 */
export interface SqlQASearchOptions {
	limit?: number;
	searchTerm?: string;
	tenantId?: string;
	dbKey?: string;
}

/**
 * Legacy compatibility - Document metadata interface (deprecated)
 */
export interface DocumentMetadata {
	[key: string]: string | number | boolean | null;
}

/**
 * Legacy compatibility - Document with embedding (deprecated, use AiChunkWithEmbedding)
 */
export interface DocumentWithEmbedding {
	id?: string;
	content: string;
	embedding?: number[];
	metadata?: DocumentMetadata;
}
