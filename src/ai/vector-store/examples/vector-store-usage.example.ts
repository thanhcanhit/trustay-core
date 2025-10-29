/**
 * Example usage of Supabase Vector Store Service
 *
 * This file demonstrates how to use the vector store service
 * in your services or controllers.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseVectorStoreService } from '../supabase-vector-store.service';

@Injectable()
export class ExampleVectorStoreUsage {
	constructor(private readonly vectorStore: SupabaseVectorStoreService) {}

	/**
	 * Example: Add knowledge base articles to vector store
	 */
	async addKnowledgeBaseArticles(): Promise<void> {
		const articles = [
			{
				content:
					'Trustay is a rental management platform that helps landlords manage their properties and tenants easily.',
				metadata: {
					type: 'article',
					category: 'platform',
					language: 'en',
					author: 'system',
				},
			},
			{
				content:
					'Users can search for available rooms based on location, price range, and amenities.',
				metadata: {
					type: 'article',
					category: 'features',
					language: 'en',
					author: 'system',
				},
			},
		];

		const ids = await this.vectorStore.addDocuments(articles, {
			model: 'text-embedding-004',
			batchSize: 10,
		});

		console.log(`Added ${ids.length} articles to vector store`);
	}

	/**
	 * Example: Search for similar content
	 */
	async searchSimilarContent(query: string): Promise<void> {
		const results = await this.vectorStore.similaritySearch(query, {
			limit: 5,
			threshold: 0.7,
			filter: {
				type: 'article',
				language: 'en',
			},
			includeMetadata: true,
		});

		console.log(`Found ${results.length} similar documents:`);
		results.forEach((result) => {
			console.log(`- ${result.content.substring(0, 100)}...`);
			console.log(`  Similarity: ${result.similarity?.toFixed(3)}`);
		});
	}

	/**
	 * Example: Build RAG (Retrieval Augmented Generation) system
	 */
	async buildRAGContext(userQuery: string): Promise<string> {
		// Step 1: Search for relevant documents
		const relevantDocs = await this.vectorStore.similaritySearch(userQuery, {
			limit: 3,
			threshold: 0.6,
		});

		// Step 2: Build context from retrieved documents
		const context = relevantDocs.map((doc) => doc.content).join('\n\n');

		// Step 3: Use context with AI model (example)
		return `Context from knowledge base:\n${context}\n\nUser question: ${userQuery}`;
	}

	/**
	 * Example: Update document metadata
	 */
	async updateDocumentTags(documentId: string, tags: string[]): Promise<void> {
		await this.vectorStore.updateDocumentMetadata(documentId, {
			tags: JSON.stringify(tags),
			updatedAt: new Date().toISOString(),
		});
	}

	/**
	 * Example: Clean up old documents
	 */
	async cleanupOldDocuments(): Promise<void> {
		const deletedCount = await this.vectorStore.deleteDocumentsByFilter({
			category: 'deprecated',
		});

		console.log(`Deleted ${deletedCount} deprecated documents`);
	}
}
