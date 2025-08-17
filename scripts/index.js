#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import scripts configuration
const IMPORT_SCRIPTS = {
	admin: {
		name: 'Administrative Data',
		script: 'import-administrative-data.js',
		description: 'Import provinces, districts, and wards data',
	},
	reference: {
		name: 'Reference Data',
		script: 'import-reference-data.js',
		description: 'Import system amenities and cost types',
	},
	users: {
		name: 'Default Users',
		script: 'import-default-users.js',
		description: 'Import 10 default landlord users with common password',
	},
	rules: {
		name: 'Room Rules',
		script: 'import-room-rules.js',
		description: 'Import system room rules for rental properties',
	},
	crawl: {
		name: 'Crawled Rooms Data',
		script: 'crawl-import.js',
		args: 'import scripts/data/crawled_rooms.json',
		description: 'Import crawled room listings from JSON file',
	},
	'crawl-sample': {
		name: 'Sample Crawled Rooms Data',
		script: 'crawl-import.js',
		args: 'import-sample scripts/data/crawled_rooms.json',
		description: 'Import first 100 crawled room listings for testing',
	},
};

// Import sequences
const SEQUENCES = {
	// Main unified sequence - runs everything in correct order
	all: ['admin', 'reference', 'users', 'rules', 'crawl'],

	// Sample/testing sequences
	sample: ['admin', 'reference', 'users', 'rules', 'crawl-sample'],

	// Legacy sequences (kept for compatibility)
	full: ['admin', 'reference', 'users', 'rules', 'crawl'],
	basic: ['admin', 'reference', 'users', 'rules'],
	data: ['reference', 'crawl'],
	setup: ['admin', 'reference', 'users', 'rules'],
};

function logStep(step, message) {
	console.log(`\n🔸 [${step}] ${message}`);
}

function logSuccess(message) {
	console.log(`✅ ${message}`);
}

function logError(message) {
	console.error(`❌ ${message}`);
}

function logWarning(message) {
	console.warn(`⚠️ ${message}`);
}

async function cleanupCrawlImports() {
	logStep('Cleanup', 'Removing only crawled room data (keeping admin/reference/users data)');

	try {
		// Check existing data first
		const beforeCounts = {
			roomRules: await prisma.roomRule.count(),
			roomAmenities: await prisma.roomAmenity.count(),
			roomCosts: await prisma.roomCost.count(),
			roomImages: await prisma.roomImage.count(),
			roomPricing: await prisma.roomPricing.count(),
			rooms: await prisma.room.count(),
			buildings: await prisma.building.count(),
		};

		logWarning(
			`   Before cleanup: ${beforeCounts.rooms} rooms, ${beforeCounts.buildings} buildings`,
		);
		logWarning(
			`   Before cleanup: ${beforeCounts.roomRules} rules, ${beforeCounts.roomAmenities} amenities, ${beforeCounts.roomCosts} costs`,
		);

		// Delete in correct order due to foreign key constraints
		logWarning('   Deleting room rules...');
		const deletedRoomRules = await prisma.roomRule.deleteMany({});

		logWarning('   Deleting room amenities...');
		const deletedRoomAmenities = await prisma.roomAmenity.deleteMany({});

		logWarning('   Deleting room costs...');
		const deletedRoomCosts = await prisma.roomCost.deleteMany({});

		logWarning('   Deleting room images...');
		const deletedRoomImages = await prisma.roomImage.deleteMany({});

		logWarning('   Deleting room pricing...');
		const deletedRoomPricing = await prisma.roomPricing.deleteMany({});

		logWarning('   Deleting rooms...');
		const deletedRooms = await prisma.room.deleteMany({});

		logWarning('   Deleting buildings...');
		const deletedBuildings = await prisma.building.deleteMany({});

		logSuccess(`Crawl data cleanup completed:`);
		logSuccess(`   • ${deletedRooms.count} rooms, ${deletedBuildings.count} buildings`);
		logSuccess(
			`   • ${deletedRoomRules.count} rules, ${deletedRoomAmenities.count} amenities, ${deletedRoomCosts.count} costs`,
		);
		logSuccess('Admin/reference/users data preserved');

		// Verify cleanup worked
		const afterRooms = await prisma.room.count();
		if (afterRooms > 0) {
			logWarning(`⚠️ Warning: ${afterRooms} rooms still remain after cleanup!`);
		}
	} catch (error) {
		logError(`Cleanup failed: ${error.message}`);
		throw error;
	}
}

function runScript(scriptKey) {
	const config = IMPORT_SCRIPTS[scriptKey];
	if (!config) {
		throw new Error(`Unknown script: ${scriptKey}`);
	}

	logStep(config.name, config.description);

	const scriptPath = path.join(__dirname, config.script);
	const command = config.args ? `node "${scriptPath}" ${config.args}` : `node "${scriptPath}"`;

	try {
		execSync(command, {
			stdio: 'inherit',
			cwd: path.dirname(__dirname), // Run from project root
		});
		logSuccess(`${config.name} import completed`);
	} catch (error) {
		logError(`${config.name} import failed: ${error.message}`);
		throw error;
	}
}

async function runSequence(sequenceName, options = {}) {
	const sequence = SEQUENCES[sequenceName];
	if (!sequence) {
		throw new Error(`Unknown sequence: ${sequenceName}`);
	}

	console.log(`🚀 Starting import sequence: ${sequenceName}`);
	console.log(`📋 Scripts to run: ${sequence.map((s) => IMPORT_SCRIPTS[s].name).join(' → ')}\n`);

	const startTime = Date.now();

	// Run cleanup only before sequences that include crawl data
	const needsCrawlCleanup =
		['all', 'full', 'data', 'sample'].includes(sequenceName) && !options.skipCleanup;
	if (needsCrawlCleanup) {
		await cleanupCrawlImports();
		console.log(''); // Add spacing after cleanup
	}

	// Run all scripts in sequence
	for (const scriptKey of sequence) {
		runScript(scriptKey);
	}

	const duration = ((Date.now() - startTime) / 1000).toFixed(2);
	console.log(`\n🎉 Import sequence '${sequenceName}' completed successfully in ${duration}s!`);

	// Show final summary for main sequences
	if (sequenceName === 'all') {
		console.log(`\n📊 Complete Trustay database setup finished!`);
		console.log(`   • Administrative data (provinces, districts, wards) - preserved/updated`);
		console.log(`   • Reference data (amenities, cost types, room rules) - preserved/updated`);
		console.log(`   • 10 balanced landlord users across market segments - preserved/updated`);
		console.log(`   • Fresh crawled room data with intelligent price-based assignments`);
		console.log(`\n🔐 Default login: budget.student@trustay.com / trustay123`);
		console.log(`💡 Note: Only room data was cleaned and re-imported. All other data preserved.`);
	} else if (sequenceName === 'sample') {
		console.log(`\n📊 Sample Trustay database setup finished!`);
		console.log(`   • Administrative data (provinces, districts, wards) - preserved/updated`);
		console.log(`   • Reference data (amenities, cost types, room rules) - preserved/updated`);
		console.log(`   • 10 balanced landlord users across market segments - preserved/updated`);
		console.log(`   • 100 sample crawled rooms with area estimation and intelligent assignments`);
		console.log(`\n🔐 Default login: budget.student@trustay.com / trustay123`);
		console.log(`💡 Note: Sample data for testing. Use 'sequence all' for full import.`);
	}
}

function showHelp() {
	console.log(`🗂️  Trustay Import Scripts Manager

🎯 RECOMMENDED COMMANDS:
  node scripts/index.js sequence sample    Sample setup (100 rooms for testing)
  node scripts/index.js sequence all       Complete database setup (all crawled data)

Usage:
  node scripts/index.js <command> [options]

Commands:
  sequence <name>     Run a predefined import sequence
  script <name>       Run a single import script
  list               List all available scripts and sequences
  help               Show this help message

🔧 Available Scripts:`);

	Object.entries(IMPORT_SCRIPTS).forEach(([key, config]) => {
		console.log(`  ${key.padEnd(12)} ${config.description}`);
	});

	console.log(`\n🔄 Available Sequences:`);
	Object.entries(SEQUENCES).forEach(([key, scripts]) => {
		const scriptNames = scripts.map((s) => IMPORT_SCRIPTS[s].name).join(' → ');
		const isMain = key === 'all';
		const prefix = isMain ? '* ' : '  ';
		const suffix = isMain ? ' (RECOMMENDED - room cleanup only)' : '';
		console.log(`${prefix}${key.padEnd(12)} ${scriptNames}${suffix}`);
	});

	console.log(`\nExamples:
  node scripts/index.js sequence sample   # Sample setup (100 rooms, fast)
  node scripts/index.js sequence all      # Complete setup (all 2000 rooms)
  node scripts/index.js sequence basic    # Setup without room data
  node scripts/index.js script crawl-sample # Just 100 sample rooms
  node scripts/index.js list              # Show all options`);
}

function listAll() {
	console.log('📋 Available Import Scripts:\n');

	Object.entries(IMPORT_SCRIPTS).forEach(([key, config]) => {
		console.log(`🔸 ${key} - ${config.name}`);
		console.log(`   Description: ${config.description}`);
		console.log(`   Script: ${config.script}`);
		if (config.args) console.log(`   Args: ${config.args}`);
		console.log('');
	});

	console.log('🔄 Available Sequences:\n');
	Object.entries(SEQUENCES).forEach(([key, scripts]) => {
		console.log(`🔸 ${key}`);
		scripts.forEach((scriptKey, index) => {
			const config = IMPORT_SCRIPTS[scriptKey];
			const prefix = index === scripts.length - 1 ? '   └─' : '   ├─';
			console.log(`${prefix} ${config.name}`);
		});
		console.log('');
	});
}

// Main execution
async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		showHelp();
		return;
	}

	const command = args[0];
	const target = args[1];

	try {
		switch (command) {
			case 'sequence':
				if (!target) {
					logError('Please specify a sequence name');
					console.log('Available sequences:', Object.keys(SEQUENCES).join(', '));
					process.exit(1);
				}
				await runSequence(target);
				break;

			case 'script':
				if (!target) {
					logError('Please specify a script name');
					console.log('Available scripts:', Object.keys(IMPORT_SCRIPTS).join(', '));
					process.exit(1);
				}
				runScript(target);
				break;

			case 'list':
				listAll();
				break;

			case 'help':
			case '--help':
			case '-h':
				showHelp();
				break;

			default:
				logError(`Unknown command: ${command}`);
				showHelp();
				process.exit(1);
		}
	} catch (error) {
		logError(`Import failed: ${error.message}`);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Run if called directly
if (require.main === module) {
	main();
}

module.exports = {
	runScript,
	runSequence,
	IMPORT_SCRIPTS,
	SEQUENCES,
};
