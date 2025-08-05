#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

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
	crawl: {
		name: 'Crawled Rooms Data',
		script: 'crawl-import.js',
		args: 'import data/crawled_rooms.json',
		description: 'Import crawled room listings from JSON file',
	},
};

// Import sequences
const SEQUENCES = {
	full: ['admin', 'reference', 'users', 'crawl'],
	basic: ['admin', 'reference', 'users'],
	data: ['reference', 'crawl'],
	setup: ['admin', 'reference', 'users'],
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

function runSequence(sequenceName) {
	const sequence = SEQUENCES[sequenceName];
	if (!sequence) {
		throw new Error(`Unknown sequence: ${sequenceName}`);
	}

	console.log(`🚀 Starting import sequence: ${sequenceName}`);
	console.log(`📋 Scripts to run: ${sequence.map((s) => IMPORT_SCRIPTS[s].name).join(' → ')}\n`);

	const startTime = Date.now();

	for (const scriptKey of sequence) {
		runScript(scriptKey);
	}

	const duration = ((Date.now() - startTime) / 1000).toFixed(2);
	console.log(`\n🎉 Import sequence '${sequenceName}' completed successfully in ${duration}s!`);
}

function showHelp() {
	console.log(`🗂️  Trustay Import Scripts Manager
	
Usage:
  node scripts/index.js <command> [options]

Commands:
  sequence <name>     Run a predefined import sequence
  script <name>       Run a single import script
  list               List all available scripts and sequences
  help               Show this help message

Available Scripts:`);

	Object.entries(IMPORT_SCRIPTS).forEach(([key, config]) => {
		console.log(`  ${key.padEnd(12)} ${config.description}`);
	});

	console.log(`\nAvailable Sequences:`);
	Object.entries(SEQUENCES).forEach(([key, scripts]) => {
		const scriptNames = scripts.map((s) => IMPORT_SCRIPTS[s].name).join(' → ');
		console.log(`  ${key.padEnd(12)} ${scriptNames}`);
	});

	console.log(`\nExamples:
  node scripts/index.js sequence full
  node scripts/index.js script admin
  node scripts/index.js list`);
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
function main() {
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
				runSequence(target);
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
