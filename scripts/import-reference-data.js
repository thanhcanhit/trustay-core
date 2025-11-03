/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { defaultAmenities } = require('./data/default-amenities');
const { defaultCostTypes } = require('./data/default-cost-types');

const prisma = new PrismaClient();

/**
 * Check whether a given table exists in the current database (public schema).
 * Works with PostgreSQL.
 * @param {string} tableName
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName) {
	try {
		const result = await prisma.$queryRaw`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = ${tableName}
		) AS exists;`;
		const row = Array.isArray(result) ? result[0] : result;
		return Boolean(row && (row.exists === true || row.exists === 1));
	} catch (err) {
		console.error('   ❌ Failed to check table existence:', err.message);
		return false;
	}
}

async function importSystemAmenities() {
	console.log('🏠 Importing system amenities...');

	// Prefer new schema (amenities) if available; otherwise fallback to legacy (system_amenities)
	const hasNewTable = await tableExists('amenities');
	const hasLegacyTable = !hasNewTable && (await tableExists('system_amenities'));

	if (!hasNewTable && !hasLegacyTable) {
		console.log(
			'   ⚠️ Neither "amenities" nor "system_amenities" tables exist. Skipping amenities import.',
		);
		return;
	}

	if (hasNewTable) {
		// New model via Prisma Client
		const existingCount = await prisma.amenity.count();
		if (existingCount > 0) {
			console.log(`⏭️ Amenities already exist (${existingCount} amenities). Skipping import.`);
			console.log('✨ Amenities import completed: 0 created, 0 skipped (data exists)\n');
			return;
		}
	}

	let successCount = 0;
	let skipCount = 0;

	for (const amenity of defaultAmenities) {
		try {
			if (hasNewTable) {
				// Use Prisma model Amenity
				const existing = await prisma.amenity.findUnique({ where: { nameEn: amenity.nameEn } });
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
			} else {
				// Legacy table insertion via SQL (system_amenities)
				await prisma.$executeRaw`INSERT INTO public.system_amenities (id, name, name_en, category, description, is_active, sort_order, created_at, updated_at)
				VALUES (gen_random_uuid(), ${amenity.name}, ${amenity.nameEn}, ${amenity.category}, ${amenity.description ?? null}, true, ${amenity.sortOrder ?? 0}, NOW(), NOW())
				ON CONFLICT (name_en) DO NOTHING;`;
				console.log(`   ✅ Upserted amenity: ${amenity.name}`);
				successCount++;
			}
		} catch (error) {
			console.error(`   ❌ Error creating amenity ${amenity.name}:`, error.message);
		}
	}

	console.log(`✨ Amenities import completed: ${successCount} created, ${skipCount} skipped\n`);
}

async function importSystemCostTypes() {
	console.log('💰 Importing system cost types...');

	// Prefer new schema (cost_type_templates) if available; otherwise fallback to legacy (system_cost_types)
	const hasNewTable = await tableExists('cost_type_templates');
	const hasLegacyTable = !hasNewTable && (await tableExists('system_cost_types'));

	if (!hasNewTable && !hasLegacyTable) {
		console.log(
			'   ⚠️ Neither "cost_type_templates" nor "system_cost_types" tables exist. Skipping cost types import.',
		);
		return;
	}

	if (hasNewTable) {
		const existingCount = await prisma.costTypeTemplate.count();
		if (existingCount > 0) {
			console.log(
				`⏭️ Cost type templates already exist (${existingCount} cost types). Skipping import.`,
			);
			console.log('✨ Cost types import completed: 0 created, 0 skipped (data exists)\n');
			return;
		}
	}

	let successCount = 0;
	let skipCount = 0;

	for (const costType of defaultCostTypes) {
		try {
			if (hasNewTable) {
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
			} else {
				await prisma.$executeRaw`INSERT INTO public.system_cost_types (id, name, name_en, category, default_unit, description, is_active, sort_order, created_at, updated_at)
				VALUES (gen_random_uuid(), ${costType.name}, ${costType.nameEn}, ${costType.category}, ${costType.defaultUnit ?? null}, ${costType.description ?? null}, true, ${costType.sortOrder ?? 0}, NOW(), NOW())
				ON CONFLICT (name_en) DO NOTHING;`;
				console.log(`   ✅ Upserted cost type: ${costType.name}`);
				successCount++;
			}
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
		let amenitiesCount = 0;
		let costTypesCount = 0;
		if (await tableExists('amenities')) {
			amenitiesCount = await prisma.amenity.count({ where: { isActive: true } });
		} else if (await tableExists('system_amenities')) {
			const resA =
				await prisma.$queryRaw`SELECT COUNT(1)::int AS count FROM public.system_amenities WHERE is_active = true;`;
			amenitiesCount = (Array.isArray(resA) ? resA[0]?.count : resA?.count) ?? 0;
		}
		if (await tableExists('cost_type_templates')) {
			costTypesCount = await prisma.costTypeTemplate.count({ where: { isActive: true } });
		} else if (await tableExists('system_cost_types')) {
			const resC =
				await prisma.$queryRaw`SELECT COUNT(1)::int AS count FROM public.system_cost_types WHERE is_active = true;`;
			costTypesCount = (Array.isArray(resC) ? resC[0]?.count : resC?.count) ?? 0;
		}

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
