const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Default password for all users
const DEFAULT_PASSWORD = 'trustay123';

// Default landlord users data
const defaultUsers = [
	{
		email: 'chutrohcm01@trustay.com',
		phone: '0901234567',
		firstName: 'Nguyễn',
		lastName: 'Văn An',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ có 5 năm kinh nghiệm tại TP.HCM, chuyên cho thuê phòng trọ sinh viên và người đi làm.',
		bankAccount: '1234567890',
		bankName: 'Vietcombank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohcm02@trustay.com',
		phone: '0901234568',
		firstName: 'Trần',
		lastName: 'Thị Bình',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ tại Quận 1, có nhiều phòng trọ cao cấp và tiện nghi đầy đủ.',
		bankAccount: '1234567891',
		bankName: 'Techcombank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohcm03@trustay.com',
		phone: '0901234569',
		firstName: 'Lê',
		lastName: 'Văn Cường',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ khu vực Thủ Đức, chuyên phòng trọ gần các trường đại học.',
		bankAccount: '1234567892',
		bankName: 'VPBank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohcm04@trustay.com',
		phone: '0901234570',
		firstName: 'Phạm',
		lastName: 'Thị Dung',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ tại Bình Thạnh, có 10 năm kinh nghiệm quản lý nhà trọ.',
		bankAccount: '1234567893',
		bankName: 'Sacombank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohcm05@trustay.com',
		phone: '0901234571',
		firstName: 'Hoàng',
		lastName: 'Văn Em',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ khu vực Gò Vấp, chuyên cho thuê phòng trọ giá rẻ cho sinh viên.',
		bankAccount: '1234567894',
		bankName: 'ACB',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohn01@trustay.com',
		phone: '0901234572',
		firstName: 'Ngô',
		lastName: 'Thị Phương',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ tại Hà Nội, khu vực Đống Đa, có nhiều phòng trọ chất lượng cao.',
		bankAccount: '1234567895',
		bankName: 'Vietinbank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohn02@trustay.com',
		phone: '0901234573',
		firstName: 'Đặng',
		lastName: 'Văn Giang',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ Hà Nội chuyên cho thuê phòng trọ khu vực Cầu Giấy.',
		bankAccount: '1234567896',
		bankName: 'BIDV',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrohn03@trustay.com',
		phone: '0901234574',
		firstName: 'Vũ',
		lastName: 'Thị Hoa',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ tại Ba Đình, Hà Nội với 8 năm kinh nghiệm trong lĩnh vực cho thuê nhà trọ.',
		bankAccount: '1234567897',
		bankName: 'Agribank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrodn01@trustay.com',
		phone: '0901234575',
		firstName: 'Bùi',
		lastName: 'Văn Khánh',
		gender: 'male',
		role: 'landlord',
		bio: 'Chủ trọ tại Đà Nẵng, khu vực Hải Châu, chuyên phòng trọ gần biển.',
		bankAccount: '1234567898',
		bankName: 'MBBank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
	{
		email: 'chutrodn02@trustay.com',
		phone: '0901234576',
		firstName: 'Dương',
		lastName: 'Thị Linh',
		gender: 'female',
		role: 'landlord',
		bio: 'Chủ trọ Đà Nẵng với nhiều căn hộ mini và phòng trọ cao cấp tại Sơn Trà.',
		bankAccount: '1234567899',
		bankName: 'TPBank',
		isVerifiedPhone: true,
		isVerifiedEmail: true,
	},
];

async function importDefaultUsers() {
	console.log('👥 Importing default landlord users...');

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

			// Create user with hashed password
			await prisma.user.create({
				data: {
					...userData,
					passwordHash: hashedPassword,
				},
			});

			console.log(
				`   ✅ Created user: ${userData.firstName} ${userData.lastName} (${userData.email})`,
			);
			successCount++;
		} catch (error) {
			console.error(`   ❌ Error creating user ${userData.email}:`, error.message);
		}
	}

	console.log(`✨ Users import completed: ${successCount} created, ${skipCount} skipped`);
	console.log(`🔑 Default password for all users: ${DEFAULT_PASSWORD}\n`);
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

		// Display summary
		const totalUsers = await prisma.user.count();
		const landlordUsers = await prisma.user.count({ where: { role: 'landlord' } });
		const tenantUsers = await prisma.user.count({ where: { role: 'tenant' } });

		console.log('📊 Summary:');
		console.log(`   • Total Users: ${totalUsers}`);
		console.log(`   • Landlords: ${landlordUsers}`);
		console.log(`   • Tenants: ${tenantUsers}`);

		if (action !== 'clear') {
			console.log(`\n🔐 Login Information:`);
			console.log(`   • Default Password: ${DEFAULT_PASSWORD}`);
			console.log(`   • Example Login: chutrohcm01@trustay.com / ${DEFAULT_PASSWORD}`);
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
