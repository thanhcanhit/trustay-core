const { PrismaClient } = require('@prisma/client');
const { defaultAmenities } = require('./data/default-amenities');
const { defaultCostTypes } = require('./data/default-cost-types');

const prisma = new PrismaClient();

async function importSystemAmenities() {
	console.log('🏠 Importing system amenities...');

	let successCount = 0;
	let skipCount = 0;

	for (const amenity of defaultAmenities) {
		try {
			// Check if amenity already exists
			const existing = await prisma.systemAmenity.findUnique({
				where: { nameEn: amenity.nameEn },
			});

			if (existing) {
				console.log(`   ⏭️  Skipping existing amenity: ${amenity.name}`);
				skipCount++;
				continue;
			}

			await prisma.systemAmenity.create({
				data: {
					...amenity,
					isActive: true,
				},
			});

			console.log(`   ✅ Created amenity: ${amenity.name}`);
			successCount++;
		} catch (error) {
			console.error(`   ❌ Error creating amenity ${amenity.name}:`, error.message);
		}
	}

	console.log(`✨ Amenities import completed: ${successCount} created, ${skipCount} skipped\n`);
}

async function importSystemCostTypes() {
	console.log('💰 Importing system cost types...');

	let successCount = 0;
	let skipCount = 0;

	for (const costType of defaultCostTypes) {
		try {
			// Check if cost type already exists
			const existing = await prisma.systemCostType.findUnique({
				where: { nameEn: costType.nameEn },
			});

			if (existing) {
				console.log(`   ⏭️  Skipping existing cost type: ${costType.name}`);
				skipCount++;
				continue;
			}

			await prisma.systemCostType.create({
				data: {
					...costType,
					isActive: true,
				},
			});

			console.log(`   ✅ Created cost type: ${costType.name}`);
			successCount++;
		} catch (error) {
			console.error(`   ❌ Error creating cost type ${costType.name}:`, error.message);
		}
	}

	console.log(`✨ Cost types import completed: ${successCount} created, ${skipCount} skipped\n`);
}

async function main() {
	console.log('🚀 Starting reference data import...\n');

	try {
		await importSystemAmenities();
		await importSystemCostTypes();

		console.log('🎉 All reference data imported successfully!');

		// Display summary
		const amenitiesCount = await prisma.systemAmenity.count({ where: { isActive: true } });
		const costTypesCount = await prisma.systemCostType.count({ where: { isActive: true } });

		console.log('\n📊 Summary:');
		console.log(`   • System Amenities: ${amenitiesCount}`);
		console.log(`   • System Cost Types: ${costTypesCount}`);
	} catch (error) {
		console.error('❌ Error during import:', error);
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
	importSystemAmenities,
	importSystemCostTypes,
	main,
};
