const { PrismaClient } = require('@prisma/client');
const { defaultAmenities } = require('./data/default-amenities');
const { defaultCostTypes } = require('./data/default-cost-types');

const prisma = new PrismaClient();

async function importSystemAmenities() {
	console.log('🏠 Importing system amenities...');

	// Check if amenities data already exists
	const existingCount = await prisma.amenity.count();
	if (existingCount > 0) {
		console.log(`⏭️ Amenities already exist (${existingCount} amenities). Skipping import.`);
		console.log('✨ Amenities import completed: 0 created, 0 skipped (data exists)\n');
		return;
	}

	let successCount = 0;
	let skipCount = 0;

	for (const amenity of defaultAmenities) {
		try {
			// Check if amenity already exists
			const existing = await prisma.amenity.findUnique({
				where: { nameEn: amenity.nameEn },
			});

			if (existing) {
				console.log(`   ⏭️  Skipping existing amenity: ${amenity.name}`);
				skipCount++;
				continue;
			}

			await prisma.amenity.create({
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

	// Check if cost types data already exists
	const existingCount = await prisma.costTypeTemplate.count();
	if (existingCount > 0) {
		console.log(
			`⏭️ Cost type templates already exist (${existingCount} cost types). Skipping import.`,
		);
		console.log('✨ Cost types import completed: 0 created, 0 skipped (data exists)\n');
		return;
	}

	let successCount = 0;
	let skipCount = 0;

	for (const costType of defaultCostTypes) {
		try {
			// Check if cost type already exists
			const existing = await prisma.costTypeTemplate.findUnique({
				where: { nameEn: costType.nameEn },
			});

			if (existing) {
				console.log(`   ⏭️  Skipping existing cost type: ${costType.name}`);
				skipCount++;
				continue;
			}

			await prisma.costTypeTemplate.create({
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
		const amenitiesCount = await prisma.amenity.count({ where: { isActive: true } });
		const costTypesCount = await prisma.costTypeTemplate.count({ where: { isActive: true } });

		console.log('\n📊 Summary:');
		console.log(`   • Amenities: ${amenitiesCount}`);
		console.log(`   • Cost Type Templates: ${costTypesCount}`);
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
