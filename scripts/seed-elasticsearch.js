#!/usr/bin/env node

/**
 * Elasticsearch Seeding Script (Pure JavaScript)
 * Usage:
 *   node scripts/seed-elasticsearch.js                    # Seed all indices
 *   node scripts/seed-elasticsearch.js --index=rooms      # Seed only rooms
 *   node scripts/seed-elasticsearch.js --reindex          # Drop and recreate indices
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');
const {
	ElasticsearchSyncService,
} = require('../dist/elasticsearch/services/elasticsearch-sync.service');
const {
	ElasticsearchIndexService,
} = require('../dist/elasticsearch/services/elasticsearch-index.service');
const { ROOM_INDEX } = require('../dist/elasticsearch/mappings/room.mapping');
const { ROOM_SEEKING_INDEX } = require('../dist/elasticsearch/mappings/room-seeking.mapping');
const {
	ROOMMATE_SEEKING_INDEX,
} = require('../dist/elasticsearch/mappings/roommate-seeking.mapping');

async function seed() {
	console.log('🚀 Starting Elasticsearch seeding...\n');

	// Create NestJS application context
	const app = await NestFactory.createApplicationContext(AppModule, {
		logger: ['error', 'warn', 'log'],
	});

	const prisma = app.get(PrismaService);
	const syncService = app.get(ElasticsearchSyncService);
	const indexService = app.get(ElasticsearchIndexService);

	// Parse command line arguments
	const args = process.argv.slice(2);
	const shouldReindex = args.includes('--reindex');
	const indexArg = args.find((arg) => arg.startsWith('--index='));
	const targetIndex = indexArg ? indexArg.split('=')[1] : 'all';

	try {
		// Health check
		const health = await indexService.getHealth();
		console.log(`📊 Elasticsearch cluster health: ${health.status}\n`);

		if (shouldReindex) {
			console.log('🗑️  Dropping existing indices...');
			if (targetIndex === 'all' || targetIndex === 'rooms') {
				try {
					await indexService.deleteIndex(ROOM_INDEX);
				} catch (e) {
					// Index might not exist
				}
			}
			if (targetIndex === 'all' || targetIndex === 'room-seeking') {
				try {
					await indexService.deleteIndex(ROOM_SEEKING_INDEX);
				} catch (e) {
					// Index might not exist
				}
			}
			if (targetIndex === 'all' || targetIndex === 'roommate-seeking') {
				try {
					await indexService.deleteIndex(ROOMMATE_SEEKING_INDEX);
				} catch (e) {
					// Index might not exist
				}
			}
			console.log('✅ Indices dropped\n');

			console.log('🔨 Recreating indices...');
			await indexService.initializeIndices();
			console.log('✅ Indices created\n');
		}

		// Seed rooms
		if (targetIndex === 'all' || targetIndex === 'rooms') {
			await seedRooms(prisma, syncService);
		}

		// Seed room seeking posts
		if (targetIndex === 'all' || targetIndex === 'room-seeking') {
			await seedRoomSeekingPosts(prisma, syncService);
		}

		// Seed roommate seeking posts
		if (targetIndex === 'all' || targetIndex === 'roommate-seeking') {
			await seedRoommateSeekingPosts(prisma, syncService);
		}

		console.log('\n🎉 Seeding completed successfully!');
		console.log('📈 Index statistics:');

		if (targetIndex === 'all' || targetIndex === 'rooms') {
			try {
				const roomStats = await indexService.getIndexStats(ROOM_INDEX);
				console.log(
					`   - Rooms: ${roomStats._all.total.docs.count} documents, ${(roomStats._all.total.store.size_in_bytes / 1024 / 1024).toFixed(2)} MB`,
				);
			} catch (e) {
				console.log(`   - Rooms: Index not found or empty`);
			}
		}

		if (targetIndex === 'all' || targetIndex === 'room-seeking') {
			try {
				const seekingStats = await indexService.getIndexStats(ROOM_SEEKING_INDEX);
				console.log(
					`   - Room Seeking: ${seekingStats._all.total.docs.count} documents, ${(seekingStats._all.total.store.size_in_bytes / 1024 / 1024).toFixed(2)} MB`,
				);
			} catch (e) {
				console.log(`   - Room Seeking: Index not found or empty`);
			}
		}

		if (targetIndex === 'all' || targetIndex === 'roommate-seeking') {
			try {
				const roommateStats = await indexService.getIndexStats(ROOMMATE_SEEKING_INDEX);
				console.log(
					`   - Roommate Seeking: ${roommateStats._all.total.docs.count} documents, ${(roommateStats._all.total.store.size_in_bytes / 1024 / 1024).toFixed(2)} MB`,
				);
			} catch (e) {
				console.log(`   - Roommate Seeking: Index not found or empty`);
			}
		}
	} catch (error) {
		console.error('❌ Seeding failed:', error.message);
		console.error('\n💡 Troubleshooting:');
		console.error('   1. Make sure Elasticsearch is running:');
		console.error('      docker-compose up -d trustay-elasticsearch');
		console.error('   2. Check Elasticsearch health:');
		console.error('      curl http://localhost:9200/_cluster/health');
		console.error('   3. Make sure the app is built:');
		console.error('      npm run build');
		process.exit(1);
	} finally {
		await app.close();
	}
}

/**
 * Seed all rooms
 */
async function seedRooms(prisma, syncService) {
	console.log('🏠 Seeding rooms...');

	const batchSize = 100;
	let skip = 0;
	let totalIndexed = 0;

	while (true) {
		const rooms = await prisma.room.findMany({
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
					select: { id: true, status: true, isActive: true },
				},
				images: {
					orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
					take: 10,
				},
				amenities: {
					include: {
						amenity: {
							select: { id: true, name: true },
						},
					},
				},
				pricing: true,
			},
		});

		if (rooms.length === 0) break;

		// Index rooms one by one (syncService.indexRoom handles transformation)
		for (const room of rooms) {
			await syncService.indexRoom(room);
			totalIndexed++;
			process.stdout.write(`\r   Indexed ${totalIndexed} rooms...`);
		}

		skip += batchSize;

		if (rooms.length < batchSize) break;
	}

	console.log(`\n✅ Indexed ${totalIndexed} rooms`);
}

/**
 * Seed all room seeking posts
 */
async function seedRoomSeekingPosts(prisma, syncService) {
	console.log('🔍 Seeding room seeking posts...');

	const batchSize = 100;
	let skip = 0;
	let totalIndexed = 0;

	while (true) {
		const posts = await prisma.roomSeekingPost.findMany({
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

		if (posts.length === 0) break;

		for (const post of posts) {
			await syncService.indexRoomSeekingPost(post);
			totalIndexed++;
			process.stdout.write(`\r   Indexed ${totalIndexed} posts...`);
		}

		skip += batchSize;

		if (posts.length < batchSize) break;
	}

	console.log(`\n✅ Indexed ${totalIndexed} room seeking posts`);
}

/**
 * Seed all roommate seeking posts
 */
async function seedRoommateSeekingPosts(prisma, syncService) {
	console.log('👥 Seeding roommate seeking posts...');

	const batchSize = 100;
	let skip = 0;
	let totalIndexed = 0;

	while (true) {
		const posts = await prisma.roommateSeekingPost.findMany({
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

		if (posts.length === 0) break;

		for (const post of posts) {
			await syncService.indexRoommateSeekingPost(post);
			totalIndexed++;
			process.stdout.write(`\r   Indexed ${totalIndexed} posts...`);
		}

		skip += batchSize;

		if (posts.length < batchSize) break;
	}

	console.log(`\n✅ Indexed ${totalIndexed} roommate seeking posts`);
}

// Run the seeding
seed().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
