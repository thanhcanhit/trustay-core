/**
 * Elasticsearch SLO Transform Diagnostic and Fix Script
 *
 * This script helps diagnose and fix issues with Elasticsearch SLO transforms
 * that may cause "missing shards" errors.
 *
 * Usage:
 *   node scripts/fix-elasticsearch-slo.js                    # Check status
 *   node scripts/fix-elasticsearch-slo.js --stop-transforms  # Stop all SLO transforms
 *   node scripts/fix-elasticsearch-slo.js --delete-index     # Delete problematic index (use with caution)
 */

const { Client } = require('@elastic/elasticsearch');

const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

async function checkClusterHealth(client) {
	console.log('\n📊 Checking cluster health...');
	try {
		const health = await client.cluster.health();
		console.log(`   Status: ${health.status}`);
		console.log(`   Active Shards: ${health.active_shards}`);
		console.log(`   Relocating Shards: ${health.relocating_shards}`);
		console.log(`   Unassigned Shards: ${health.unassigned_shards}`);
		if (health.unassigned_shards > 0) {
			console.log('   ⚠️  Warning: There are unassigned shards!');
		}
		return health;
	} catch (error) {
		console.error('   ❌ Failed to check cluster health:', error.message);
		throw error;
	}
}

async function checkSLOIndex(client) {
	console.log('\n🔍 Checking SLO observability index...');
	try {
		const indexName = '.slo-observability.sli-v2';
		const exists = await client.indices.exists({ index: indexName });
		if (!exists) {
			console.log(`   ✅ Index ${indexName} does not exist (good)`);
			return null;
		}
		console.log(`   ⚠️  Index ${indexName} exists`);
		const stats = await client.indices.stats({ index: indexName });
		const shards = stats.indices[indexName]?.primaries;
		if (shards) {
			console.log(`   Shards: ${shards.total?.count || 'unknown'}`);
		}
		const shardStatus = await client.cluster.allocationExplain({
			index: indexName,
			shard: 0,
			primary: true,
		});
		if (shardStatus) {
			console.log(`   Shard 0 status: ${shardStatus.explain || 'unknown'}`);
		}
		return indexName;
	} catch (error) {
		if (error.statusCode === 404) {
			console.log('   ✅ Index does not exist (good)');
			return null;
		}
		console.error('   ❌ Error checking index:', error.message);
		return null;
	}
}

async function listTransforms(client) {
	console.log('\n📋 Listing all transforms...');
	try {
		const transforms = await client.transform.getTransform();
		if (!transforms || transforms.count === 0) {
			console.log('   ✅ No transforms found');
			return [];
		}
		console.log(`   Found ${transforms.count} transform(s):`);
		transforms.transforms.forEach((transform) => {
			const state = transform.state || 'unknown';
			const status = state === 'stopped' ? '✅' : '⚠️';
			console.log(`   ${status} ${transform.id} - State: ${state}`);
		});
		return transforms.transforms;
	} catch (error) {
		console.error('   ❌ Failed to list transforms:', error.message);
		return [];
	}
}

async function stopSLOTransforms(client) {
	console.log('\n🛑 Stopping SLO transforms...');
	try {
		const transforms = await client.transform.getTransform();
		if (!transforms || transforms.count === 0) {
			console.log('   ✅ No transforms to stop');
			return;
		}
		const sloTransforms = transforms.transforms.filter(
			(t) => t.id.includes('slo-') || t.id.includes('observability'),
		);
		if (sloTransforms.length === 0) {
			console.log('   ✅ No SLO transforms found');
			return;
		}
		for (const transform of sloTransforms) {
			try {
				await client.transform.stopTransform({
					transform_id: transform.id,
					wait_for_completion: true,
				});
				console.log(`   ✅ Stopped transform: ${transform.id}`);
			} catch (error) {
				if (error.statusCode === 404) {
					console.log(`   ⚠️  Transform ${transform.id} not found (may already be stopped)`);
				} else {
					console.error(`   ❌ Failed to stop ${transform.id}:`, error.message);
				}
			}
		}
	} catch (error) {
		console.error('   ❌ Failed to stop transforms:', error.message);
	}
}

async function deleteSLOIndex(client) {
	console.log('\n🗑️  Deleting SLO observability index...');
	try {
		const indexName = '.slo-observability.sli-v2';
		const exists = await client.indices.exists({ index: indexName });
		if (!exists) {
			console.log(`   ✅ Index ${indexName} does not exist`);
			return;
		}
		await client.indices.delete({ index: indexName });
		console.log(`   ✅ Deleted index: ${indexName}`);
	} catch (error) {
		if (error.statusCode === 404) {
			console.log('   ✅ Index does not exist');
		} else {
			console.error('   ❌ Failed to delete index:', error.message);
		}
	}
}

async function main() {
	const args = process.argv.slice(2);
	const stopTransforms = args.includes('--stop-transforms');
	const deleteIndex = args.includes('--delete-index');

	console.log('🔧 Elasticsearch SLO Transform Diagnostic Tool\n');
	console.log(`   Elasticsearch Node: ${ELASTICSEARCH_NODE}`);

	const client = new Client({
		node: ELASTICSEARCH_NODE,
	});

	try {
		await checkClusterHealth(client);
		const indexName = await checkSLOIndex(client);
		const transforms = await listTransforms(client);

		if (stopTransforms) {
			await stopSLOTransforms(client);
		}

		if (deleteIndex && indexName) {
			await deleteSLOIndex(client);
		}

		if (!stopTransforms && !deleteIndex) {
			console.log('\n💡 Recommendations:');
			if (indexName) {
				console.log('   - Run with --stop-transforms to stop SLO transforms');
				console.log(
					'   - Run with --delete-index to delete the problematic index (use with caution)',
				);
			}
			if (transforms.length > 0) {
				const sloTransforms = transforms.filter(
					(t) => t.id.includes('slo-') || t.id.includes('observability'),
				);
				if (sloTransforms.length > 0) {
					console.log(
						'   - SLO transforms are running. Consider stopping them if SLO is not needed.',
					);
				}
			}
		}

		console.log('\n✅ Diagnostic complete!\n');
	} catch (error) {
		console.error('\n❌ Error:', error.message);
		if (error.meta) {
			console.error('   Details:', error.meta.body?.error || error.meta);
		}
		process.exit(1);
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

module.exports = { main };
