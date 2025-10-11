import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ROOM_INDEX, roomIndexMapping } from '../mappings/room.mapping';
import { ROOM_SEEKING_INDEX, roomSeekingIndexMapping } from '../mappings/room-seeking.mapping';
import {
	ROOMMATE_SEEKING_INDEX,
	roommateSeekingIndexMapping,
} from '../mappings/roommate-seeking.mapping';

@Injectable()
export class ElasticsearchIndexService {
	private readonly logger = new Logger(ElasticsearchIndexService.name);

	constructor(private readonly elasticsearchService: ElasticsearchService) {}

	/**
	 * Initialize all indices with proper mappings
	 */
	async initializeIndices(): Promise<void> {
		await this.createIndex(ROOM_INDEX, roomIndexMapping);
		await this.createIndex(ROOM_SEEKING_INDEX, roomSeekingIndexMapping);
		await this.createIndex(ROOMMATE_SEEKING_INDEX, roommateSeekingIndexMapping);
	}

	/**
	 * Create an index if it doesn't exist
	 */
	async createIndex(index: string, mapping: any): Promise<void> {
		try {
			const exists = await this.elasticsearchService.indices.exists({ index });

			if (!exists) {
				await this.elasticsearchService.indices.create({
					index,
					body: mapping,
				});
				this.logger.log(`Created index: ${index}`);
			} else {
				this.logger.log(`Index already exists: ${index}`);
			}
		} catch (error) {
			this.logger.error(`Failed to create index ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Delete an index
	 */
	async deleteIndex(index: string): Promise<void> {
		try {
			const exists = await this.elasticsearchService.indices.exists({ index });

			if (exists) {
				await this.elasticsearchService.indices.delete({ index });
				this.logger.log(`Deleted index: ${index}`);
			}
		} catch (error) {
			this.logger.error(`Failed to delete index ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Update index mapping
	 */
	async updateMapping(index: string, mapping: any): Promise<void> {
		try {
			await this.elasticsearchService.indices.putMapping({
				index,
				body: mapping.mappings,
			});
			this.logger.log(`Updated mapping for index: ${index}`);
		} catch (error) {
			this.logger.error(`Failed to update mapping for ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Check cluster health
	 */
	async getHealth(): Promise<any> {
		try {
			const health = await this.elasticsearchService.cluster.health({});
			return health;
		} catch (error) {
			this.logger.error('Failed to get cluster health:', error);
			throw error;
		}
	}

	/**
	 * Get index stats
	 */
	async getIndexStats(index: string): Promise<any> {
		try {
			const stats = await this.elasticsearchService.indices.stats({ index });
			return stats;
		} catch (error) {
			this.logger.error(`Failed to get stats for ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Refresh an index
	 */
	async refreshIndex(index: string): Promise<void> {
		try {
			await this.elasticsearchService.indices.refresh({ index });
			this.logger.log(`Refreshed index: ${index}`);
		} catch (error) {
			this.logger.error(`Failed to refresh index ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Reindex data from one index to another
	 */
	async reindex(sourceIndex: string, destIndex: string): Promise<void> {
		try {
			await this.elasticsearchService.reindex({
				body: {
					source: { index: sourceIndex },
					dest: { index: destIndex },
				},
			});
			this.logger.log(`Reindexed from ${sourceIndex} to ${destIndex}`);
		} catch (error) {
			this.logger.error(`Failed to reindex from ${sourceIndex} to ${destIndex}:`, error);
			throw error;
		}
	}
}
