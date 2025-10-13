import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ROOM_INDEX } from '../../elasticsearch/mappings/room.mapping';
import { ROOM_SEEKING_INDEX } from '../../elasticsearch/mappings/room-seeking.mapping';
import { ROOMMATE_SEEKING_INDEX } from '../../elasticsearch/mappings/roommate-seeking.mapping';
import { ElasticsearchSyncService } from '../../elasticsearch/services/elasticsearch-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
	ElasticsearchJobData,
	ElasticsearchJobType,
} from '../services/elasticsearch-queue.service';

@Processor('elasticsearch-sync-queue')
export class ElasticsearchSyncProcessor {
	private readonly logger = new Logger(ElasticsearchSyncProcessor.name);

	constructor(
		private readonly elasticsearchSyncService: ElasticsearchSyncService,
		private readonly prisma: PrismaService,
	) {}

	@Process('index-room')
	async handleIndexRoom(job: Job<ElasticsearchJobData>): Promise<void> {
		const { entityId } = job.data;

		try {
			this.logger.debug(`Processing index room job: ${entityId}`);

			// Fetch room with all relations
			const room = await this.prisma.room.findUnique({
				where: { id: entityId },
				include: {
					building: {
						include: {
							owner: {
								select: {
									id: true,
									firstName: true,
									lastName: true,
									overallRating: true,
									totalRatings: true,
									isVerifiedPhone: true,
									isVerifiedEmail: true,
									isVerifiedIdentity: true,
								},
							},
							province: { select: { id: true, name: true } },
							district: { select: { id: true, name: true } },
							ward: { select: { id: true, name: true } },
						},
					},
					roomInstances: {
						where: { isActive: true, status: 'available' },
						select: { id: true, status: true, isActive: true },
					},
					images: {
						orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
						take: 10,
					},
					amenities: {
						include: {
							systemAmenity: {
								select: { id: true, name: true },
							},
						},
					},
					pricing: true,
				},
			});

			if (!room) {
				this.logger.warn(`Room not found: ${entityId}`);
				return;
			}

			// Index to Elasticsearch
			await this.elasticsearchSyncService.indexRoom(room);

			this.logger.debug(`Successfully indexed room: ${entityId}`);
		} catch (error) {
			this.logger.error(`Failed to index room ${entityId}:`, error);
			throw error; // Re-throw to trigger retry
		}
	}

	@Process('index-room-seeking')
	async handleIndexRoomSeeking(job: Job<ElasticsearchJobData>): Promise<void> {
		const { entityId } = job.data;

		try {
			this.logger.debug(`Processing index room seeking job: ${entityId}`);

			const post = await this.prisma.roomSeekingPost.findUnique({
				where: { id: entityId },
				include: {
					requester: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
						},
					},
					amenities: {
						select: { id: true, name: true },
					},
					preferredProvince: { select: { id: true, name: true } },
					preferredDistrict: { select: { id: true, name: true } },
					preferredWard: { select: { id: true, name: true } },
				},
			});

			if (!post) {
				this.logger.warn(`Room seeking post not found: ${entityId}`);
				return;
			}

			await this.elasticsearchSyncService.indexRoomSeekingPost(post);

			this.logger.debug(`Successfully indexed room seeking post: ${entityId}`);
		} catch (error) {
			this.logger.error(`Failed to index room seeking post ${entityId}:`, error);
			throw error;
		}
	}

	@Process('index-roommate-seeking')
	async handleIndexRoommateSeeking(job: Job<ElasticsearchJobData>): Promise<void> {
		const { entityId } = job.data;

		try {
			this.logger.debug(`Processing index roommate seeking job: ${entityId}`);

			const post = await this.prisma.roommateSeekingPost.findUnique({
				where: { id: entityId },
				include: {
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
						},
					},
					externalProvince: { select: { id: true, name: true } },
					externalDistrict: { select: { id: true, name: true } },
					externalWard: { select: { id: true, name: true } },
				},
			});

			if (!post) {
				this.logger.warn(`Roommate seeking post not found: ${entityId}`);
				return;
			}

			await this.elasticsearchSyncService.indexRoommateSeekingPost(post);

			this.logger.debug(`Successfully indexed roommate seeking post: ${entityId}`);
		} catch (error) {
			this.logger.error(`Failed to index roommate seeking post ${entityId}:`, error);
			throw error;
		}
	}

	@Process('delete-document')
	async handleDeleteDocument(job: Job<ElasticsearchJobData>): Promise<void> {
		const { index, entityId } = job.data;

		try {
			this.logger.debug(`Processing delete document job: ${index}/${entityId}`);

			await this.elasticsearchSyncService.deleteDocument(index, entityId);

			this.logger.debug(`Successfully deleted document: ${index}/${entityId}`);
		} catch (error) {
			this.logger.error(`Failed to delete document ${index}/${entityId}:`, error);
			throw error;
		}
	}

	@Process('bulk-reindex')
	async handleBulkReindex(job: Job<ElasticsearchJobData>): Promise<void> {
		const { index, batchSize = 1000 } = job.data;

		try {
			this.logger.log(`Processing bulk reindex job for index: ${index}`);

			if (index === ROOM_INDEX) {
				await this.bulkReindexRooms(batchSize);
			} else if (index === ROOM_SEEKING_INDEX) {
				await this.bulkReindexRoomSeekingPosts(batchSize);
			} else if (index === ROOMMATE_SEEKING_INDEX) {
				await this.bulkReindexRoommateSeekingPosts(batchSize);
			} else {
				throw new Error(`Unknown index: ${index}`);
			}

			this.logger.log(`Successfully completed bulk reindex for: ${index}`);
		} catch (error) {
			this.logger.error(`Failed to bulk reindex ${index}:`, error);
			throw error;
		}
	}

	/**
	 * Bulk reindex all rooms
	 */
	private async bulkReindexRooms(batchSize: number): Promise<void> {
		let skip = 0;
		let hasMore = true;

		while (hasMore) {
			const rooms = await this.prisma.room.findMany({
				where: { isActive: true },
				skip,
				take: batchSize,
				include: {
					building: {
						include: {
							owner: {
								select: {
									id: true,
									firstName: true,
									lastName: true,
									overallRating: true,
									totalRatings: true,
									isVerifiedPhone: true,
									isVerifiedEmail: true,
									isVerifiedIdentity: true,
								},
							},
							province: { select: { id: true, name: true } },
							district: { select: { id: true, name: true } },
							ward: { select: { id: true, name: true } },
						},
					},
					roomInstances: {
						where: { isActive: true, status: 'available' },
					},
					images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
					amenities: {
						include: {
							systemAmenity: {
								select: { id: true, name: true },
							},
						},
					},
					pricing: true,
				},
			});

			if (rooms.length === 0) {
				hasMore = false;
				break;
			}

			// Transform and bulk index
			const documents = rooms.map((room) => {
				// Use the same transform logic from sync service
				return (this.elasticsearchSyncService as any).transformRoomToDocument(room);
			});

			await this.elasticsearchSyncService.bulkIndex(ROOM_INDEX, documents);

			this.logger.log(`Indexed batch: ${skip} - ${skip + rooms.length} rooms`);

			skip += batchSize;
			hasMore = rooms.length === batchSize;
		}

		this.logger.log(`Bulk reindex completed for rooms. Total: ${skip}`);
	}

	/**
	 * Bulk reindex room seeking posts
	 */
	private async bulkReindexRoomSeekingPosts(batchSize: number): Promise<void> {
		let skip = 0;
		let hasMore = true;

		while (hasMore) {
			const posts = await this.prisma.roomSeekingPost.findMany({
				skip,
				take: batchSize,
				include: {
					requester: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
						},
					},
					amenities: { select: { id: true, name: true } },
					preferredProvince: { select: { id: true, name: true } },
					preferredDistrict: { select: { id: true, name: true } },
					preferredWard: { select: { id: true, name: true } },
				},
			});

			if (posts.length === 0) {
				hasMore = false;
				break;
			}

			const documents = posts.map((post) =>
				(this.elasticsearchSyncService as any).transformRoomSeekingToDocument(post),
			);

			await this.elasticsearchSyncService.bulkIndex(ROOM_SEEKING_INDEX, documents);

			this.logger.log(`Indexed batch: ${skip} - ${skip + posts.length} room seeking posts`);

			skip += batchSize;
			hasMore = posts.length === batchSize;
		}

		this.logger.log(`Bulk reindex completed for room seeking posts. Total: ${skip}`);
	}

	/**
	 * Bulk reindex roommate seeking posts
	 */
	private async bulkReindexRoommateSeekingPosts(batchSize: number): Promise<void> {
		let skip = 0;
		let hasMore = true;

		while (hasMore) {
			const posts = await this.prisma.roommateSeekingPost.findMany({
				where: { isActive: true },
				skip,
				take: batchSize,
				include: {
					tenant: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							avatarUrl: true,
						},
					},
					externalProvince: { select: { id: true, name: true } },
					externalDistrict: { select: { id: true, name: true } },
					externalWard: { select: { id: true, name: true } },
				},
			});

			if (posts.length === 0) {
				hasMore = false;
				break;
			}

			const documents = posts.map((post) =>
				(this.elasticsearchSyncService as any).transformRoommateSeekingToDocument(post),
			);

			await this.elasticsearchSyncService.bulkIndex(ROOMMATE_SEEKING_INDEX, documents);

			this.logger.log(`Indexed batch: ${skip} - ${skip + posts.length} roommate seeking posts`);

			skip += batchSize;
			hasMore = posts.length === batchSize;
		}

		this.logger.log(`Bulk reindex completed for roommate seeking posts. Total: ${skip}`);
	}
}
