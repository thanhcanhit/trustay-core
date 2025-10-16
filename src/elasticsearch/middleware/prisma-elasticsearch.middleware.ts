import { Prisma } from '@prisma/client';
import { ElasticsearchQueueService } from '../../queue/services/elasticsearch-queue.service';
import { ROOM_INDEX } from '../mappings/room.mapping';
import { ROOM_SEEKING_INDEX } from '../mappings/room-seeking.mapping';
import { ROOMMATE_SEEKING_INDEX } from '../mappings/roommate-seeking.mapping';

/**
 * Creates Prisma middleware for syncing data to Elasticsearch
 * This middleware intercepts Prisma operations and queues sync jobs
 */
export function createElasticsearchSyncMiddleware(
	elasticsearchQueueService: ElasticsearchQueueService,
): Prisma.Middleware {
	return async (params, next) => {
		const result = await next(params);

		// Only process if queue service is available
		if (!elasticsearchQueueService) {
			return result;
		}

		try {
			// Handle Room model operations
			if (params.model === 'Room') {
				await handleRoomOperation(params, result, elasticsearchQueueService);
			}

			// Handle RoomSeekingPost model operations
			if (params.model === 'RoomSeekingPost') {
				await handleRoomSeekingOperation(params, result, elasticsearchQueueService);
			}

			// Handle RoommateSeekingPost model operations
			if (params.model === 'RoommateSeekingPost') {
				await handleRoommateSeekingOperation(params, result, elasticsearchQueueService);
			}

			// Handle Building updates (re-index all associated rooms)
			if (params.model === 'Building') {
				await handleBuildingOperation(params, result, elasticsearchQueueService);
			}

			// Handle RoomPricing updates (re-index the room)
			if (params.model === 'RoomPricing') {
				await handleRoomPricingOperation(params, result, elasticsearchQueueService);
			}

			// Handle RoomAmenity operations (re-index the room)
			if (params.model === 'RoomAmenity') {
				await handleRoomAmenityOperation(params, result, elasticsearchQueueService);
			}

			// Handle RoomInstance operations (re-index the room to update availability)
			if (params.model === 'RoomInstance') {
				await handleRoomInstanceOperation(params, result, elasticsearchQueueService);
			}
		} catch (error) {
			// Log error but don't fail the main operation
			console.error('Elasticsearch sync middleware error:', error);
		}

		return result;
	};
}

/**
 * Handle Room model operations
 */
async function handleRoomOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'create') {
		const roomId = result.id;
		await queueService.queueIndexRoom(roomId, 7); // High priority for new rooms
	} else if (action === 'update') {
		const roomId = args.where?.id;
		if (roomId) {
			await queueService.queueIndexRoom(roomId, 5);
		}
	} else if (action === 'updateMany') {
		// For updateMany, we need to re-index all affected rooms
		// This is less efficient but ensures consistency
		// In production, you might want to batch this differently
		console.warn('Room updateMany detected - may need manual reindex');
	} else if (action === 'delete') {
		const roomId = args.where?.id;
		if (roomId) {
			await queueService.queueDeleteDocument(ROOM_INDEX, roomId, 5);
		}
	} else if (action === 'deleteMany') {
		// For deleteMany, log warning - might need manual cleanup
		console.warn('Room deleteMany detected - may need manual ES cleanup');
	}
}

/**
 * Handle RoomSeekingPost operations
 */
async function handleRoomSeekingOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'create') {
		await queueService.queueIndexRoomSeeking(result.id, 7);
	} else if (action === 'update') {
		const postId = args.where?.id;
		if (postId) {
			await queueService.queueIndexRoomSeeking(postId, 5);
		}
	} else if (action === 'delete') {
		const postId = args.where?.id;
		if (postId) {
			await queueService.queueDeleteDocument(ROOM_SEEKING_INDEX, postId, 5);
		}
	}
}

/**
 * Handle RoommateSeekingPost operations
 */
async function handleRoommateSeekingOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'create') {
		await queueService.queueIndexRoommateSeeking(result.id, 7);
	} else if (action === 'update') {
		const postId = args.where?.id;
		if (postId) {
			await queueService.queueIndexRoommateSeeking(postId, 5);
		}
	} else if (action === 'delete') {
		const postId = args.where?.id;
		if (postId) {
			await queueService.queueDeleteDocument(ROOMMATE_SEEKING_INDEX, postId, 5);
		}
	}
}

/**
 * Handle Building operations - re-index all rooms in the building
 */
async function handleBuildingOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'update') {
		const buildingId = args.where?.id;
		if (buildingId) {
			// Note: This will need access to Prisma to find all rooms
			// In a real implementation, you'd inject PrismaService
			console.log(`Building ${buildingId} updated - rooms need reindexing`);
			// TODO: Queue job to reindex all rooms in this building
		}
	}
}

/**
 * Handle RoomPricing operations - re-index the associated room
 */
async function handleRoomPricingOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'create' || action === 'update') {
		const roomId = result?.roomId || args.where?.roomId;
		if (roomId) {
			await queueService.queueIndexRoom(roomId, 5);
		}
	}
}

/**
 * Handle RoomAmenity operations - re-index the associated room
 */
async function handleRoomAmenityOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'create' || action === 'delete') {
		const roomId = result?.roomId || args.where?.roomId;
		if (roomId) {
			await queueService.queueIndexRoom(roomId, 5);
		}
	}
}

/**
 * Handle RoomInstance operations - re-index the associated room
 */
async function handleRoomInstanceOperation(
	params: Prisma.MiddlewareParams,
	result: any,
	queueService: ElasticsearchQueueService,
): Promise<void> {
	const { action, args } = params;

	if (action === 'create' || action === 'update' || action === 'delete') {
		const roomId = result?.roomId || args.where?.roomId || args.data?.roomId;
		if (roomId) {
			await queueService.queueIndexRoom(roomId, 5);
		}
	}
}
