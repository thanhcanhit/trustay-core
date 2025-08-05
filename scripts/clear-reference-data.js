const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearSystemAmenities() {
	console.log('🧹 Clearing system amenities...');

	try {
		const result = await prisma.systemAmenity.deleteMany({});
		console.log(`   ✅ Deleted ${result.count} system amenities`);
	} catch (error) {
		console.error('   ❌ Error clearing system amenities:', error.message);
	}
}

async function clearSystemCostTypes() {
	console.log('🧹 Clearing system cost types...');

	try {
		const result = await prisma.systemCostType.deleteMany({});
		console.log(`   ✅ Deleted ${result.count} system cost types`);
	} catch (error) {
		console.error('   ❌ Error clearing system cost types:', error.message);
	}
}

async function main() {
	console.log('🚀 Starting reference data cleanup...\n');

	try {
		await clearSystemCostTypes(); // Clear cost types first (may have dependencies)
		await clearSystemAmenities();

		console.log('\n🎉 All reference data cleared successfully!');
	} catch (error) {
		console.error('❌ Error during cleanup:', error);
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
	clearSystemAmenities,
	clearSystemCostTypes,
	main,
};
