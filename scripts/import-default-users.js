const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Default password for all users
const DEFAULT_PASSWORD = 'trustay123';

// Rental market segments for balanced user distribution
const MARKET_SEGMENTS = {
	BUDGET_STUDENT: { priceRange: '1-2M VND', target: 'Sinh viên, người mới đi làm' },
	BUDGET_WORKER: { priceRange: '1.5-2.5M VND', target: 'Công nhân, nhân viên' },
	ECONOMY_YOUNG: { priceRange: '2-4M VND', target: 'Nhân viên văn phòng trẻ' },
	ECONOMY_FAMILY: { priceRange: '2.5-4.5M VND', target: 'Gia đình nhỏ, cặp đôi' },
	STANDARD_PROFESSIONAL: { priceRange: '4-6M VND', target: 'Chuyên viên, kỹ sư' },
	STANDARD_EXECUTIVE: { priceRange: '5-7M VND', target: 'Quản lý cấp trung' },
	PREMIUM_BUSINESS: { priceRange: '6-10M VND', target: 'Doanh nhân, chuyên gia' },
	PREMIUM_EXPAT: { priceRange: '8-12M VND', target: 'Người nước ngoài' },
	LUXURY_HIGH_END: { priceRange: '10-15M VND', target: 'Giám đốc, chuyên gia cao cấp' },
	LUXURY_ULTRA: { priceRange: '12M+ VND', target: 'Doanh nhân, người giàu có' },
};

// Balanced landlord users across market segments (10 users distributed evenly)
const defaultUsers = [
	// BUDGET SEGMENT (2 users - 20%)
	{
		email: 'budget.student@trustay.com',
		phone: '0901234567',
		firstName: 'Nguyễn',
		lastName: 'Văn Minh',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ chuyên cho thuê phòng giá rẻ gần trường đại học. 3 năm kinh nghiệm, hiểu tâm lý sinh viên.',
		bankAccount: '1234567890',
		bankName: 'Vietcombank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'BUDGET_STUDENT',
		targetRooms: 25, // 25% of rooms
	},
	{
		email: 'budget.worker@trustay.com',
		phone: '0901234568',
		firstName: 'Trần',
		lastName: 'Thị Lan',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ tại khu công nghiệp, chuyên phòng trọ cho công nhân và nhân viên. Giá cả phải chăng, tiện ích cơ bản.',
		bankAccount: '1234567891',
		bankName: 'Techcombank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'BUDGET_WORKER',
		targetRooms: 25, // 25% of rooms
	},

	// ECONOMY SEGMENT (3 users - 30%)
	{
		email: 'economy.young@trustay.com',
		phone: '0901234569',
		firstName: 'Lê',
		lastName: 'Văn Tuấn',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ khu vực trung tâm, phòng trọ hiện đại cho nhân viên văn phòng trẻ. WiFi tốc độ cao, không gian thoải mái.',
		bankAccount: '1234567892',
		bankName: 'VPBank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'ECONOMY_YOUNG',
		targetRooms: 20, // 20% of rooms
	},
	{
		email: 'economy.family@trustay.com',
		phone: '0901234570',
		firstName: 'Phạm',
		lastName: 'Thị Hường',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ chuyên căn hộ mini cho cặp đôi và gia đình nhỏ. 6 năm kinh nghiệm, dịch vụ chu đáo.',
		bankAccount: '1234567893',
		bankName: 'Sacombank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'ECONOMY_FAMILY',
		targetRooms: 15, // 15% of rooms
	},
	{
		email: 'economy.mix@trustay.com',
		phone: '0901234571',
		firstName: 'Hoàng',
		lastName: 'Văn Đức',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ đa dạng phân khúc kinh tế. Từ phòng đơn đến phòng đôi, phục vụ nhiều đối tượng khách hàng.',
		bankAccount: '1234567894',
		bankName: 'ACB',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'ECONOMY_YOUNG',
		targetRooms: 15, // 15% of rooms (shared with economy segment)
	},

	// STANDARD SEGMENT (2 users - 20%)
	{
		email: 'standard.professional@trustay.com',
		phone: '0901234572',
		firstName: 'Ngô',
		lastName: 'Thị Mai',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ cao cấp cho chuyên viên và kỹ sư. Phòng đầy đủ tiện nghi, khu vực an ninh tốt.',
		bankAccount: '1234567895',
		bankName: 'Vietinbank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'STANDARD_PROFESSIONAL',
		targetRooms: 20, // 20% of rooms
	},
	{
		email: 'standard.executive@trustay.com',
		phone: '0901234573',
		firstName: 'Đặng',
		lastName: 'Văn Hùng',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ chuyên quản lý cấp trung. Studio và 1PN có ban công, gần trung tâm thành phố.',
		bankAccount: '1234567896',
		bankName: 'BIDV',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'STANDARD_EXECUTIVE',
		targetRooms: 10, // 10% of rooms
	},

	// PREMIUM SEGMENT (2 users - 20%)
	{
		email: 'premium.business@trustay.com',
		phone: '0901234574',
		firstName: 'Vũ',
		lastName: 'Thị Linh',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ cao cấp cho doanh nhân và chuyên gia. Serviced apartment, dịch vụ 5 sao.',
		bankAccount: '1234567897',
		bankName: 'Agribank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'PREMIUM_BUSINESS',
		targetRooms: 8, // 8% of rooms
	},
	{
		email: 'premium.expat@trustay.com',
		phone: '0901234575',
		firstName: 'Bùi',
		lastName: 'Văn Quang',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ chuyên phục vụ người nước ngoài. English speaking, international standard, convenient location.',
		bankAccount: '1234567898',
		bankName: 'MBBank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'PREMIUM_EXPAT',
		targetRooms: 7, // 7% of rooms
	},

	// LUXURY SEGMENT (1 user - 10%)
	{
		email: 'luxury.elite@trustay.com',
		phone: '0901234576',
		firstName: 'Dương',
		lastName: 'Thị Vân',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ sở hữu bất động sản cao cấp. Penthouse, villa mini, dành cho giám đốc và doanh nhân thành đạt.',
		bankAccount: '1234567899',
		bankName: 'TPBank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
		segment: 'LUXURY_HIGH_END',
		targetRooms: 5, // 5% of rooms
	},
];

// Room distribution helper functions
function shuffleArray(array) {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

function distributeRoomsToUsers(rooms) {
	console.log('🎲 Distributing rooms intelligently across landlord segments...');

	const shuffledRooms = shuffleArray(rooms);
	const userRoomAssignments = {};

	// Initialize user assignments
	defaultUsers.forEach((user) => {
		userRoomAssignments[user.email] = [];
	});

	// Calculate actual room counts for each user based on percentages
	const totalRooms = rooms.length;
	const roomDistribution = [];

	defaultUsers.forEach((user) => {
		const targetCount = Math.round((user.targetRooms / 100) * totalRooms);
		roomDistribution.push({ email: user.email, count: targetCount, segment: user.segment });
	});

	// Adjust distribution to ensure total equals room count
	const totalAssigned = roomDistribution.reduce((sum, dist) => sum + dist.count, 0);
	if (totalAssigned !== totalRooms) {
		const diff = totalRooms - totalAssigned;
		// Add/subtract from the largest segment (budget users)
		roomDistribution[0].count += diff;
	}

	// Assign rooms to users
	let roomIndex = 0;
	roomDistribution.forEach((dist) => {
		for (let i = 0; i < dist.count && roomIndex < totalRooms; i++) {
			userRoomAssignments[dist.email].push(shuffledRooms[roomIndex]);
			roomIndex++;
		}

		console.log(`   📋 ${dist.email}: ${dist.count} rooms (${dist.segment})`);
	});

	return userRoomAssignments;
}

async function assignRoomsToLandlords() {
	console.log('🏠 Assigning existing rooms to landlords based on market segments...');

	// Get all rooms without owners or with dummy owners
	const unassignedRooms = await prisma.room.findMany({
		include: {
			building: true,
		},
	});

	if (unassignedRooms.length === 0) {
		console.log('   ⚠️  No rooms found to assign');
		return;
	}

	// Get all landlord users
	const landlords = await prisma.user.findMany({
		where: {
			role: 'landlord',
			email: { in: defaultUsers.map((u) => u.email) },
		},
	});

	if (landlords.length === 0) {
		console.log('   ⚠️  No landlord users found');
		return;
	}

	// Distribute rooms intelligently
	const roomAssignments = distributeRoomsToUsers(unassignedRooms);

	let assignedCount = 0;

	for (const [email, assignedRooms] of Object.entries(roomAssignments)) {
		const landlord = landlords.find((l) => l.email === email);
		if (!landlord || assignedRooms.length === 0) continue;

		for (const room of assignedRooms) {
			try {
				// Update building owner
				await prisma.building.update({
					where: { id: room.building.id },
					data: { ownerId: landlord.id },
				});

				assignedCount++;
			} catch (error) {
				console.error(`   ❌ Error assigning room ${room.id}:`, error.message);
			}
		}

		console.log(
			`   ✅ Assigned ${assignedRooms.length} rooms to ${landlord.firstName} ${landlord.lastName}`,
		);
	}

	console.log(`🎯 Room assignment completed: ${assignedCount} rooms assigned`);
}

async function importDefaultUsers() {
	console.log('👥 Importing balanced landlord users across market segments...');

	// Check if default users already exist
	const existingUsers = await prisma.user.count({
		where: {
			role: 'landlord',
			email: { in: defaultUsers.map((u) => u.email) },
		},
	});

	if (existingUsers > 0) {
		console.log(
			`⏭️ Default landlord users already exist (${existingUsers} users). Skipping import.`,
		);
		console.log('✨ Users import completed: 0 created, 0 skipped (data exists)');

		// Still try to assign rooms if they exist
		console.log('\n📍 Checking for room assignment...');
		await assignRoomsToLandlords();
		console.log('');
		return;
	}

	console.log('📊 Distribution Strategy:');
	console.log('   • Budget Segment: 50% of rooms (student + worker housing)');
	console.log('   • Economy Segment: 30% of rooms (young professionals + small families)');
	console.log('   • Standard Segment: 15% of rooms (professionals + executives)');
	console.log('   • Premium/Luxury: 5% of rooms (high-end clients)\n');

	// Hash the default password
	const saltRounds = 10;
	const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, saltRounds);

	let successCount = 0;
	let skipCount = 0;

	for (const userData of defaultUsers) {
		try {
			// Check if user already exists
			const existing = await prisma.user.findUnique({
				where: { email: userData.email },
			});

			if (existing) {
				console.log(`   ⏭️  Skipping existing user: ${userData.email}`);
				skipCount++;
				continue;
			}

			// Create user with hashed password (exclude segment and targetRooms from DB)
			const { segment, targetRooms, ...dbUserData } = userData;
			await prisma.user.create({
				data: {
					...dbUserData,
					passwordHash: hashedPassword,
				},
			});

			console.log(
				`   ✅ Created ${segment} landlord: ${userData.firstName} ${userData.lastName} (${targetRooms}% target)`,
			);
			successCount++;
		} catch (error) {
			console.error(`   ❌ Error creating user ${userData.email}:`, error.message);
		}
	}

	console.log(`\n✨ Users import completed: ${successCount} created, ${skipCount} skipped`);
	console.log(`🔑 Default password for all users: ${DEFAULT_PASSWORD}`);

	// Assign rooms to landlords if rooms exist
	if (successCount > 0) {
		console.log('\n📍 Proceeding to intelligent room assignment...');
		await assignRoomsToLandlords();
	}

	console.log('');
}

async function clearDefaultUsers() {
	console.log('🗑️  Clearing default landlord users...');

	const emails = defaultUsers.map((user) => user.email);

	try {
		const deleteResult = await prisma.user.deleteMany({
			where: {
				email: {
					in: emails,
				},
			},
		});

		console.log(`✅ Deleted ${deleteResult.count} default users\n`);
	} catch (error) {
		console.error('❌ Error clearing default users:', error.message);
		throw error;
	}
}

async function main() {
	const action = process.argv[2];

	console.log('🚀 Starting default users management...\n');

	try {
		if (action === 'clear') {
			await clearDefaultUsers();
		} else {
			await importDefaultUsers();
		}

		// Display enhanced summary with segment breakdown
		const totalUsers = await prisma.user.count();
		const landlordUsers = await prisma.user.count({ where: { role: 'landlord' } });
		const tenantUsers = await prisma.user.count({ where: { role: 'tenant' } });
		const totalRooms = await prisma.room.count();
		const totalBuildings = await prisma.building.count();

		console.log('📊 System Summary:');
		console.log(
			`   • Total Users: ${totalUsers} (${landlordUsers} landlords, ${tenantUsers} tenants)`,
		);
		console.log(`   • Total Rooms: ${totalRooms}`);
		console.log(`   • Total Buildings: ${totalBuildings}`);

		if (action !== 'clear' && landlordUsers > 0) {
			console.log(`\n👥 Landlord Segments:`);
			const segments = {
				Budget: defaultUsers.filter((u) => u.segment.includes('BUDGET')).length,
				Economy: defaultUsers.filter((u) => u.segment.includes('ECONOMY')).length,
				Standard: defaultUsers.filter((u) => u.segment.includes('STANDARD')).length,
				Premium: defaultUsers.filter((u) => u.segment.includes('PREMIUM')).length,
				Luxury: defaultUsers.filter((u) => u.segment.includes('LUXURY')).length,
			};

			Object.entries(segments).forEach(([segment, count]) => {
				if (count > 0) console.log(`   • ${segment}: ${count} landlords`);
			});

			console.log(`\n🔐 Login Information:`);
			console.log(`   • Default Password: ${DEFAULT_PASSWORD}`);
			console.log(`   • Budget Segment: budget.student@trustay.com / ${DEFAULT_PASSWORD}`);
			console.log(`   • Economy Segment: economy.young@trustay.com / ${DEFAULT_PASSWORD}`);
			console.log(`   • Premium Segment: premium.business@trustay.com / ${DEFAULT_PASSWORD}`);
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
	importDefaultUsers,
	clearDefaultUsers,
	defaultUsers,
	DEFAULT_PASSWORD,
};
