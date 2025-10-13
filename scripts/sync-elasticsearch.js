#!/usr/bin/env node

/**
 * Standalone Elasticsearch sync script
 * Can be run independently or as part of import sequence
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Starting Elasticsearch sync...\n');

try {
	const scriptPath = path.join(__dirname, 'seed-elasticsearch.js');
	const command = `node "${scriptPath}"`;

	execSync(command, {
		stdio: 'inherit',
		cwd: path.dirname(__dirname),
	});

	console.log('\n✅ Elasticsearch sync completed successfully!');
} catch (error) {
	console.error('\n❌ Elasticsearch sync failed:', error.message);
	console.error('\n💡 Troubleshooting:');
	console.error('   1. Make sure Elasticsearch is running:');
	console.error('      docker-compose up -d trustay-elasticsearch');
	console.error('   2. Make sure the app is built:');
	console.error('      npm run build');
	process.exit(1);
}
