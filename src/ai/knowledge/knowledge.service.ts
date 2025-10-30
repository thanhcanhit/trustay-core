import { Injectable, Logger } from '@nestjs/common';
import { SchemaProvider } from '../utils/schema-provider';
import { SupabaseVectorStoreService } from '../vector-store/supabase-vector-store.service';
import {
	AiChunkCollection,
	SqlQAEntry,
	VectorSearchOptions,
	VectorSearchResult,
} from '../vector-store/types/vector.types';

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

	constructor(private readonly vectorStore: SupabaseVectorStoreService) {
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
		const schema = SchemaProvider.getCompleteDatabaseSchema();
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
	 * Save a Q&A interaction with SQL canonical to vector store for self-learning
	 */
	async saveQAInteraction(params: {
		question: string;
		answer: string;
		sql?: string;
		sessionId?: string;
		userId?: string;
		context?: Record<string, unknown>;
	}): Promise<{ chunkId: number; sqlQAId: number }> {
		const {
			question,
			answer,
			sql,
			// sessionId, userId, context
		} = params;

		// Reuse existing canonical SQL if a highly similar question already exists
		const reuse = await this.findReusableCanonicalSql(question, 0.85);
		if (reuse) {
			this.logger.debug(
				`Reusing existing QA - Chunk ID: ${reuse.chunkId}, SQL QA ID: ${reuse.sqlQAId}`,
			);
			return { chunkId: reuse.chunkId, sqlQAId: reuse.sqlQAId };
		}

		const qaContent = `Q: ${question}\nA: ${answer}`;
		const chunkId = await this.vectorStore.addChunk(
			{
				tenantId: this.tenantId,
				collection: 'qa',
				dbKey: this.dbKey,
				content: qaContent,
			},
			{ model: 'text-embedding-004' },
		);

		let sqlQAId: number | undefined;
		if (sql) {
			sqlQAId = await this.vectorStore.saveSqlQA({
				tenantId: this.tenantId,
				dbKey: this.dbKey,
				question,
				sqlCanonical: sql,
			});
		}

		this.logger.debug(
			`Saved Q&A interaction - Chunk ID: ${chunkId}, SQL QA ID: ${sqlQAId || 'N/A'}`,
		);
		return { chunkId, sqlQAId: sqlQAId || 0 };
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
	 * Retrieve both schema and knowledge context
	 */
	async retrieveContext(
		query: string,
		options: VectorSearchOptions = { limit: 5 },
	): Promise<{
		schema: VectorSearchResult[];
		knowledge: VectorSearchResult[];
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
		const results = await this.vectorStore.similaritySearch(question, 'qa', {
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

	private extractQuestionFromContent(content: string): string {
		const qPrefix = 'Q: ';
		const start = content.indexOf(qPrefix);
		if (start === -1) {
			return '';
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

	private splitSchemaIntoChunks(schema: string): string[] {
		const lines = schema.split('\n');
		const chunks: string[] = [];
		const MAX_LINES_PER_CHUNK = 60;
		for (let i = 0; i < lines.length; i += MAX_LINES_PER_CHUNK) {
			chunks.push(lines.slice(i, i + MAX_LINES_PER_CHUNK).join('\n'));
		}
		return chunks.filter((c) => c.trim().length > 0);
	}
}
