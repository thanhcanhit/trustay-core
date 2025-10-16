import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';

// Use constants instead of enum for better JS compatibility
export const ElasticsearchJobType = {
	INDEX_ROOM: 'index-room',
	INDEX_ROOM_SEEKING: 'index-room-seeking',
	INDEX_ROOMMATE_SEEKING: 'index-roommate-seeking',
	DELETE_DOCUMENT: 'delete-document',
	BULK_REINDEX: 'bulk-reindex',
} as const;

export type ElasticsearchJobTypeValue =
	(typeof ElasticsearchJobType)[keyof typeof ElasticsearchJobType];

export interface ElasticsearchJobData {
	type: ElasticsearchJobTypeValue;
	entityId?: string;
	index?: string;
	data?: any;
	batchSize?: number;
}

@Injectable()
export class ElasticsearchQueueService {
	private readonly logger = new Logger(ElasticsearchQueueService.name);

	constructor(
		@InjectQueue('elasticsearch-sync-queue')
		private readonly elasticsearchQueue: Queue,
	) {}

	/**
	 * Queue a job to index a room
	 */
	async queueIndexRoom(roomId: string, priority: number = 5): Promise<void> {
		try {
			await this.elasticsearchQueue.add(
				ElasticsearchJobType.INDEX_ROOM,
				{
					type: ElasticsearchJobType.INDEX_ROOM,
					entityId: roomId,
				} as ElasticsearchJobData,
				{
					priority,
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 2000,
					},
				},
			);
			this.logger.debug(`Queued index room job: ${roomId}`);
		} catch (error) {
			this.logger.error(`Failed to queue index room job: ${roomId}`, error);
		}
	}

	/**
	 * Queue a job to index a room seeking post
	 */
	async queueIndexRoomSeeking(postId: string, priority: number = 5): Promise<void> {
		try {
			await this.elasticsearchQueue.add(
				ElasticsearchJobType.INDEX_ROOM_SEEKING,
				{
					type: ElasticsearchJobType.INDEX_ROOM_SEEKING,
					entityId: postId,
				} as ElasticsearchJobData,
				{
					priority,
					attempts: 3,
				},
			);
			this.logger.debug(`Queued index room seeking job: ${postId}`);
		} catch (error) {
			this.logger.error(`Failed to queue index room seeking job: ${postId}`, error);
		}
	}

	/**
	 * Queue a job to index a roommate seeking post
	 */
	async queueIndexRoommateSeeking(postId: string, priority: number = 5): Promise<void> {
		try {
			await this.elasticsearchQueue.add(
				ElasticsearchJobType.INDEX_ROOMMATE_SEEKING,
				{
					type: ElasticsearchJobType.INDEX_ROOMMATE_SEEKING,
					entityId: postId,
				} as ElasticsearchJobData,
				{
					priority,
					attempts: 3,
				},
			);
			this.logger.debug(`Queued index roommate seeking job: ${postId}`);
		} catch (error) {
			this.logger.error(`Failed to queue index roommate seeking job: ${postId}`, error);
		}
	}

	/**
	 * Queue a job to delete a document
	 */
	async queueDeleteDocument(
		index: string,
		documentId: string,
		priority: number = 5,
	): Promise<void> {
		try {
			await this.elasticsearchQueue.add(
				ElasticsearchJobType.DELETE_DOCUMENT,
				{
					type: ElasticsearchJobType.DELETE_DOCUMENT,
					index,
					entityId: documentId,
				} as ElasticsearchJobData,
				{
					priority,
					attempts: 3,
				},
			);
			this.logger.debug(`Queued delete document job: ${index}/${documentId}`);
		} catch (error) {
			this.logger.error(`Failed to queue delete document job: ${index}/${documentId}`, error);
		}
	}

	/**
	 * Queue a bulk reindex job
	 */
	async queueBulkReindex(index: string, batchSize: number = 1000): Promise<void> {
		try {
			await this.elasticsearchQueue.add(
				ElasticsearchJobType.BULK_REINDEX,
				{
					type: ElasticsearchJobType.BULK_REINDEX,
					index,
					batchSize,
				} as ElasticsearchJobData,
				{
					priority: 1, // Lower priority for bulk operations
					attempts: 5,
					timeout: 600000, // 10 minutes
				},
			);
			this.logger.log(`Queued bulk reindex job for index: ${index}`);
		} catch (error) {
			this.logger.error(`Failed to queue bulk reindex job for ${index}`, error);
		}
	}

	/**
	 * Get queue statistics
	 */
	async getQueueStats(): Promise<any> {
		const counts = await this.elasticsearchQueue.getJobCounts();
		return {
			waiting: counts.waiting,
			active: counts.active,
			completed: counts.completed,
			failed: counts.failed,
			delayed: counts.delayed,
		};
	}

	/**
	 * Clear all jobs from queue
	 */
	async clearQueue(): Promise<void> {
		await this.elasticsearchQueue.empty();
		this.logger.log('Cleared Elasticsearch queue');
	}
}
