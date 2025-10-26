const { PrismaClient } = require('@prisma/client');
const { defaultRoomRules } = require('./data/default-room-rules');

const prisma = new PrismaClient();

async function importSystemRoomRules() {
	console.log('📋 Importing system room rules...');

	// Check if we already have room rules data
	let existingCount = 0;
	try {
		existingCount = await prisma.roomRuleTemplate.count();
	} catch (error) {
		console.log('⚠️ RoomRuleTemplate table does not exist yet, proceeding with import...');
	}

	if (existingCount > 0) {
		console.log(`⏭️ Room rule templates already exist (${existingCount} rules). Skipping import.`);
		console.log('✨ Room rules import completed: 0 created, 0 skipped (data exists)\n');
		return;
	}

	let successCount = 0;
	let skipCount = 0;

	for (const ruleData of defaultRoomRules) {
		try {
			// Check if rule already exists
			const existing = await prisma.roomRuleTemplate.findUnique({
				where: { nameEn: ruleData.nameEn },
			});

			if (existing) {
				console.log(`   ⏭️  Skipping existing rule: ${ruleData.name}`);
				skipCount++;
				continue;
			}

			await prisma.roomRuleTemplate.create({
				data: {
					...ruleData,
					isActive: true,
				},
			});

			console.log(`   ✅ Created rule: ${ruleData.name}`);
			successCount++;
		} catch (error) {
			console.error(`   ❌ Error creating rule ${ruleData.name}:`, error.message);
		}
	}

	console.log(`✨ Room rules import completed: ${successCount} created, ${skipCount} skipped\n`);
}

async function clearSystemRoomRules() {
	console.log('🗑️  Clearing system room rules...');

	try {
		const deleteResult = await prisma.roomRuleTemplate.deleteMany({
			where: {
				nameEn: {
					in: defaultRoomRules.map((rule) => rule.nameEn),
				},
			},
		});

		console.log(`✅ Deleted ${deleteResult.count} room rule templates\n`);
	} catch (error) {
		console.error('❌ Error clearing room rules:', error.message);
		throw error;
	}
}

async function main() {
	const action = process.argv[2];

	console.log('🚀 Starting room rules management...\n');

	try {
		if (action === 'clear') {
			await clearSystemRoomRules();
		} else {
			await importSystemRoomRules();
		}

		// Display summary
		const rulesCount = await prisma.roomRuleTemplate.count({ where: { isActive: true } });
		const rulesByCategory = await prisma.roomRuleTemplate.groupBy({
			by: ['category'],
			where: { isActive: true },
			_count: {
				category: true,
			},
		});

		console.log('📊 Summary:');
		console.log(`   • Total Room Rule Templates: ${rulesCount}`);

		console.log('\n📋 Rules by Category:');
		rulesByCategory.forEach(({ category, _count }) => {
			const categoryLabels = {
				smoking: 'Hút thuốc',
				pets: 'Thú cưng',
				visitors: 'Khách thăm',
				noise: 'Tiếng ồn',
				cleanliness: 'Vệ sinh',
				security: 'An ninh',
				usage: 'Sử dụng',
				other: 'Khác',
			};
			console.log(`   • ${categoryLabels[category] || category}: ${_count.category}`);
		});

		if (action !== 'clear') {
			console.log('\n🔧 Usage Examples:');
			console.log('   • API: GET /api/reference/room-rules');
			console.log('   • Filter by category: GET /api/reference/room-rules?category=smoking');
		}
	} catch (error) {
		console.error('❌ Error during operation:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Run the script
if (require.main === module) {
	main().catch((error) => {
		console.error('❌ Unhandled error:', error);
		process.exit(1);
	});
}

module.exports = {
	importSystemRoomRules,
	clearSystemRoomRules,
	defaultRoomRules,
};
