const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Default password for all users
const DEFAULT_PASSWORD = 'trustay123';

/**
 * Setup test data for statistics testing
 * Creates 4 rooms with student tenants, bills, payments for budget.student@trustay.com
 */
async function setupStatsTestData() {
	console.log('📊 Setting up test data for statistics...\n');

	// Hash password
	const saltRounds = 10;
	const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, saltRounds);

	// Get or create landlord
	let landlord = await prisma.user.findUnique({
		where: { email: 'budget.student@trustay.com' },
	});

	if (!landlord) {
		console.log('   ⚠️  Landlord budget.student@trustay.com not found. Creating...');
		landlord = await prisma.user.create({
			data: {
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
				passwordHash: hashedPassword,
			},
		});
		console.log(`   ✅ Created landlord: ${landlord.firstName} ${landlord.lastName}`);
	} else {
		console.log(`   ✅ Found landlord: ${landlord.firstName} ${landlord.lastName}`);
	}

	// Get or create location data - Gò Vấp, Hồ Chí Minh
	let province, district;
	try {
		province = await prisma.province.findFirst({
			where: { name: { contains: 'Hồ Chí Minh' } },
		});
		district = await prisma.district.findFirst({
			where: {
				OR: [
					{ name: { contains: 'Gò Vấp' } },
					{ name: { contains: 'Go Vap' } },
					{ name: { contains: 'go vap' } },
				],
			},
		});

		if (!province || !district) {
			throw new Error('Location not found');
		}
	} catch {
		console.log('   ⚠️  Creating default location data for Gò Vấp...');
		province = await prisma.province.upsert({
			where: { code: 'SG' },
			update: {},
			create: {
				id: 79,
				code: 'SG',
				name: 'Thành phố Hồ Chí Minh',
				nameEn: 'Ho Chi Minh City',
			},
		});
		// Gò Vấp typically has code '012' or similar, but we'll search by name
		district = await prisma.district.findFirst({
			where: {
				OR: [{ name: { contains: 'Gò Vấp' } }, { name: { contains: 'Go Vap' } }],
				provinceId: province.id,
			},
		});

		if (!district) {
			// Create if not found (fallback)
			district = await prisma.district.create({
				data: {
					code: '012',
					name: 'Quận Gò Vấp',
					nameEn: 'Go Vap District',
					provinceId: province.id,
				},
			});
		}
	}

	// Get cost types and amenities
	const costTypes = await prisma.costTypeTemplate.findMany({ where: { isActive: true } });
	const amenities = await prisma.amenity.findMany({ where: { isActive: true } });

	if (costTypes.length === 0 || amenities.length === 0) {
		console.log(
			'   ⚠️  Missing cost types or amenities. Please run import-reference-data.js first.',
		);
		return;
	}

	// Find specific cost types
	const electricityCost = costTypes.find((ct) => ct.nameEn.toLowerCase().includes('electricity'));
	const waterCost = costTypes.find((ct) => ct.nameEn.toLowerCase().includes('water'));
	const internetCost = costTypes.find((ct) => ct.nameEn.toLowerCase().includes('internet'));
	const managementCost = costTypes.find(
		(ct) =>
			ct.nameEn.toLowerCase().includes('management') || ct.nameEn.toLowerCase().includes('service'),
	);
	const garbageCost = costTypes.find(
		(ct) =>
			ct.nameEn.toLowerCase().includes('garbage') ||
			ct.nameEn.toLowerCase().includes('trash') ||
			ct.nameEn.toLowerCase().includes('rác'),
	);

	// Tìm hoặc tạo cost types cho máy lạnh và máy giặt
	let airConditionerCost = costTypes.find(
		(ct) =>
			ct.nameEn.toLowerCase().includes('air') ||
			ct.nameEn.toLowerCase().includes('conditioner') ||
			ct.nameEn.toLowerCase().includes('máy lạnh'),
	);
	let washingMachineCost = costTypes.find(
		(ct) =>
			ct.nameEn.toLowerCase().includes('washing') ||
			ct.nameEn.toLowerCase().includes('machine') ||
			ct.nameEn.toLowerCase().includes('máy giặt'),
	);

	// Nếu không tìm thấy, tạo mới
	if (!airConditionerCost) {
		airConditionerCost = await prisma.costTypeTemplate.create({
			data: {
				name: 'Máy lạnh',
				nameEn: 'air_conditioner',
				category: 'utility',
				defaultUnit: 'tháng',
				description: 'Phí sử dụng máy lạnh hàng tháng',
				isActive: true,
				sortOrder: 10,
			},
		});
		console.log('   ✅ Created cost type: air_conditioner');
	}

	if (!washingMachineCost) {
		washingMachineCost = await prisma.costTypeTemplate.create({
			data: {
				name: 'Máy giặt',
				nameEn: 'washing_machine',
				category: 'service',
				defaultUnit: 'tháng',
				description: 'Phí sử dụng máy giặt hàng tháng',
				isActive: true,
				sortOrder: 11,
			},
		});
		console.log('   ✅ Created cost type: washing_machine');
	}

	if (!garbageCost) {
		garbageCost = await prisma.costTypeTemplate.create({
			data: {
				name: 'Thu gom rác',
				nameEn: 'garbage',
				category: 'service',
				defaultUnit: 'tháng',
				description: 'Phí thu gom rác',
				isActive: true,
				sortOrder: 12,
			},
		});
		console.log('   ✅ Created cost type: garbage');
	}

	// Create building - Gần IUH (Đại học Công nghiệp) ở Gò Vấp
	const buildingId = 'nha-tro-sinh-vien-nguyen-van-bao-go-vap';
	let building = await prisma.building.findUnique({
		where: { id: buildingId },
	});

	if (!building) {
		building = await prisma.building.create({
			data: {
				id: buildingId,
				slug: buildingId,
				name: 'Dãy trọ Sinh viên Nguyễn Văn Bảo',
				addressLine1: '123 Đường Nguyễn Văn Bảo',
				addressLine2: 'Phường 4, Quận Gò Vấp, TP.HCM',
				description: 'Dãy trọ giá rẻ dành cho sinh viên, gần Đại học Công nghiệp TP.HCM (IUH)',
				ownerId: landlord.id,
				districtId: district.id,
				provinceId: province.id,
				latitude: 10.85, // Gò Vấp coordinates
				longitude: 106.6667,
				isActive: true,
			},
		});
		console.log(`   ✅ Created building: ${building.name}`);
	} else {
		console.log(`   ✅ Found building: ${building.name}`);
	}

	// Create student tenants - 2 loại phòng (có/không máy lạnh)
	// Phòng không máy lạnh: 101, 102, 103 (6 sinh viên)
	// Phòng có máy lạnh: 201, 202, 203 (6 sinh viên)
	const studentTenants = [
		// Phòng 101 - 2 sinh viên (không máy lạnh)
		{
			email: 'student.101a@trustay.com',
			phone: '0911111111',
			firstName: 'Trần',
			lastName: 'Văn An',
			gender: 'male',
			bio: 'Sinh viên năm 2, Đại học Công nghiệp TP.HCM (IUH)',
			year: 2,
		},
		{
			email: 'student.101b@trustay.com',
			phone: '0911111112',
			firstName: 'Lê',
			lastName: 'Thị Bình',
			gender: 'female',
			bio: 'Sinh viên năm 3, Đại học Công nghiệp TP.HCM (IUH)',
			year: 3,
		},
		// Phòng 102 - 2 sinh viên (không máy lạnh)
		{
			email: 'student.102a@trustay.com',
			phone: '0911111113',
			firstName: 'Phạm',
			lastName: 'Văn Cường',
			gender: 'male',
			bio: 'Sinh viên năm 1, Đại học Công nghiệp TP.HCM (IUH)',
			year: 1,
		},
		{
			email: 'student.102b@trustay.com',
			phone: '0911111114',
			firstName: 'Hoàng',
			lastName: 'Thị Dung',
			gender: 'female',
			bio: 'Sinh viên năm 2, Đại học Công nghiệp TP.HCM (IUH)',
			year: 2,
		},
		// Phòng 103 - 2 sinh viên (không máy lạnh)
		{
			email: 'student.103a@trustay.com',
			phone: '0911111115',
			firstName: 'Võ',
			lastName: 'Thị Hoa',
			gender: 'female',
			bio: 'Sinh viên năm 1, Đại học Công nghiệp TP.HCM (IUH)',
			year: 1,
		},
		{
			email: 'student.103b@trustay.com',
			phone: '0911111116',
			firstName: 'Đỗ',
			lastName: 'Văn Huy',
			gender: 'male',
			bio: 'Sinh viên năm 2, Đại học Công nghiệp TP.HCM (IUH)',
			year: 2,
		},
		// Phòng 201 - 2 sinh viên (có máy lạnh)
		{
			email: 'student.201a@trustay.com',
			phone: '0911111117',
			firstName: 'Vũ',
			lastName: 'Thị Hương',
			gender: 'female',
			bio: 'Sinh viên năm 2, Đại học Công nghiệp TP.HCM (IUH)',
			year: 2,
		},
		{
			email: 'student.201b@trustay.com',
			phone: '0911111118',
			firstName: 'Đặng',
			lastName: 'Văn Hùng',
			gender: 'male',
			bio: 'Sinh viên năm 4, Đại học Công nghiệp TP.HCM (IUH)',
			year: 4,
		},
		// Phòng 202 - 2 sinh viên (có máy lạnh)
		{
			email: 'student.202a@trustay.com',
			phone: '0911111119',
			firstName: 'Bùi',
			lastName: 'Thị Lan',
			gender: 'female',
			bio: 'Sinh viên năm 1, Đại học Công nghiệp TP.HCM (IUH)',
			year: 1,
		},
		{
			email: 'student.202b@trustay.com',
			phone: '0911111120',
			firstName: 'Dương',
			lastName: 'Văn Minh',
			gender: 'male',
			bio: 'Sinh viên năm 2, Đại học Công nghiệp TP.HCM (IUH)',
			year: 2,
		},
		// Phòng 203 - 2 sinh viên (có máy lạnh)
		{
			email: 'student.203a@trustay.com',
			phone: '0911111121',
			firstName: 'Hồ',
			lastName: 'Văn Phúc',
			gender: 'male',
			bio: 'Sinh viên năm 1, Đại học Công nghiệp TP.HCM (IUH)',
			year: 1,
		},
		{
			email: 'student.203b@trustay.com',
			phone: '0911111122',
			firstName: 'Lương',
			lastName: 'Thị Quỳnh',
			gender: 'female',
			bio: 'Sinh viên năm 3, Đại học Công nghiệp TP.HCM (IUH)',
			year: 3,
		},
	];

	const createdTenants = [];
	for (const tenantData of studentTenants) {
		let tenant = await prisma.user.findUnique({
			where: { email: tenantData.email },
		});

		if (!tenant) {
			tenant = await prisma.user.create({
				data: {
					...tenantData,
					role: 'tenant',
					isVerifiedPhone: true,
					isVerifiedEmail: true,
					passwordHash: hashedPassword,
				},
			});
			console.log(`   ✅ Created tenant: ${tenant.firstName} ${tenant.lastName}`);
		} else {
			console.log(`   ✅ Found tenant: ${tenant.firstName} ${tenant.lastName}`);
		}
		createdTenants.push(tenant);
	}

	// Create 2 room types: có máy lạnh và không có máy lạnh
	// Mỗi loại có 3 phòng instances
	const roomsData = [
		// Loại 1: Phòng không có máy lạnh (101, 102, 103)
		{
			name: 'Phòng 101',
			description: 'Phòng đơn không máy lạnh, giá rẻ, gần IUH',
			areaSqm: 20,
			maxOccupancy: 1,
			floorNumber: 1,
			basePrice: 1500000, // Giá cơ bản
			studentCount: 2,
			hasAirConditioner: false,
			airConditionerPrice: 0,
			hasWashingMachine: true,
			washingMachinePrice: 100000, // 100k/phòng
			trashPrice: 30000, // 30k/phòng
			hasInternet: true,
			internetPrice: 150000,
			managementPrice: 100000,
			electricityUnitPrice: 3000,
			waterUnitPrice: 3000,
			hasOccupants: true,
		},
		{
			name: 'Phòng 102',
			description: 'Phòng đơn không máy lạnh, giá rẻ, gần IUH',
			areaSqm: 20,
			maxOccupancy: 1,
			floorNumber: 1,
			basePrice: 1500000,
			studentCount: 2,
			hasAirConditioner: false,
			airConditionerPrice: 0,
			hasWashingMachine: true,
			washingMachinePrice: 100000,
			trashPrice: 30000,
			hasInternet: true,
			internetPrice: 150000,
			managementPrice: 100000,
			electricityUnitPrice: 3000,
			waterUnitPrice: 3000,
			hasOccupants: true,
		},
		{
			name: 'Phòng 103',
			description: 'Phòng đơn không máy lạnh, giá rẻ, gần IUH',
			areaSqm: 20,
			maxOccupancy: 1,
			floorNumber: 1,
			basePrice: 1500000,
			studentCount: 2,
			hasAirConditioner: false,
			airConditionerPrice: 0,
			hasWashingMachine: true,
			washingMachinePrice: 100000,
			trashPrice: 30000,
			hasInternet: true,
			internetPrice: 150000,
			managementPrice: 100000,
			electricityUnitPrice: 3000,
			waterUnitPrice: 3000,
			hasOccupants: true,
		},
		// Loại 2: Phòng có máy lạnh (201, 202, 203) - +200k so với phòng không máy lạnh
		{
			name: 'Phòng 201',
			description: 'Phòng đơn có máy lạnh, mát mẻ, gần IUH',
			areaSqm: 20,
			maxOccupancy: 1,
			floorNumber: 2,
			basePrice: 1700000, // 1500000 + 200000
			studentCount: 2,
			hasAirConditioner: true,
			airConditionerPrice: 200000, // +200k
			hasWashingMachine: true,
			washingMachinePrice: 100000, // 100k/phòng
			trashPrice: 30000, // 30k/phòng
			hasInternet: true,
			internetPrice: 150000,
			managementPrice: 100000,
			electricityUnitPrice: 3000,
			waterUnitPrice: 3000,
			hasOccupants: true,
		},
		{
			name: 'Phòng 202',
			description: 'Phòng đơn có máy lạnh, mát mẻ, gần IUH',
			areaSqm: 20,
			maxOccupancy: 1,
			floorNumber: 2,
			basePrice: 1700000, // 1500000 + 200000
			studentCount: 2,
			hasAirConditioner: true,
			airConditionerPrice: 200000, // +200k
			hasWashingMachine: true,
			washingMachinePrice: 100000,
			trashPrice: 30000,
			hasInternet: true,
			internetPrice: 150000,
			managementPrice: 100000,
			electricityUnitPrice: 3000,
			waterUnitPrice: 3000,
			hasOccupants: true,
		},
		{
			name: 'Phòng 203',
			description: 'Phòng đơn có máy lạnh, mát mẻ, gần IUH',
			areaSqm: 20,
			maxOccupancy: 1,
			floorNumber: 2,
			basePrice: 1700000, // 1500000 + 200000
			studentCount: 2,
			hasAirConditioner: true,
			airConditionerPrice: 200000, // +200k
			hasWashingMachine: true,
			washingMachinePrice: 100000,
			trashPrice: 30000,
			hasInternet: true,
			internetPrice: 150000,
			managementPrice: 100000,
			electricityUnitPrice: 3000,
			waterUnitPrice: 3000,
			hasOccupants: true,
		},
	];

	const createdRooms = [];
	const createdRentals = [];
	let tenantIndex = 0;

	for (let i = 0; i < roomsData.length; i++) {
		const roomData = roomsData[i];

		// Create room type
		const roomSlug = `${buildingId}-room-${i + 1}`;
		let room = await prisma.room.findUnique({
			where: { slug: roomSlug },
		});

		if (!room) {
			room = await prisma.room.create({
				data: {
					slug: roomSlug,
					buildingId: building.id,
					name: roomData.name,
					description: roomData.description,
					roomType: 'boarding_house',
					areaSqm: roomData.areaSqm,
					maxOccupancy: roomData.maxOccupancy,
					totalRooms: roomData.studentCount, // Số phòng cụ thể
					floorNumber: roomData.floorNumber,
					isActive: true,
				},
			});

			// Create pricing
			await prisma.roomPricing.create({
				data: {
					roomId: room.id,
					basePriceMonthly: roomData.basePrice,
					depositAmount: roomData.basePrice * 2,
					currency: 'VND',
				},
			});

			// Create room costs - mỗi phòng có giá khác nhau một chút
			// Chỉ tạo internet cost nếu phòng có internet
			if (internetCost && roomData.hasInternet) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: internetCost.id,
						costType: 'fixed',
						fixedAmount: roomData.internetPrice,
						currency: 'VND',
						isActive: true,
						notes: 'Phí Internet hàng tháng',
					},
				});
			}

			if (managementCost) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: managementCost.id,
						costType: 'fixed',
						fixedAmount: roomData.managementPrice,
						currency: 'VND',
						isActive: true,
						notes: 'Phí quản lý tòa nhà',
					},
				});
			}

			// Máy lạnh - chỉ cho phòng có máy lạnh
			if (airConditionerCost && roomData.hasAirConditioner) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: airConditionerCost.id,
						costType: 'fixed',
						fixedAmount: roomData.airConditionerPrice,
						currency: 'VND',
						isActive: true,
						notes: 'Phí máy lạnh hàng tháng (+200k)',
					},
				});
			}

			// Máy giặt - 100k/phòng
			if (washingMachineCost && roomData.hasWashingMachine) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: washingMachineCost.id,
						costType: 'fixed',
						fixedAmount: roomData.washingMachinePrice,
						currency: 'VND',
						isActive: true,
						notes: 'Phí máy giặt hàng tháng (100k/phòng)',
					},
				});
			}

			// Rác - 30k/phòng
			if (garbageCost) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: garbageCost.id,
						costType: 'fixed',
						fixedAmount: roomData.trashPrice,
						currency: 'VND',
						isActive: true,
						notes: 'Phí thu gom rác hàng tháng (30k/phòng)',
					},
				});
			}

			// Điện nước PHẢI là metered
			if (electricityCost) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: electricityCost.id,
						costType: 'metered', // METERED
						unitPrice: roomData.electricityUnitPrice,
						unit: 'kWh',
						meterReading: 1000 + i * 50,
						lastMeterReading: 900 + i * 50,
						currency: 'VND',
						isActive: true,
						notes: 'Điện theo đồng hồ (metered)',
					},
				});
			}

			if (waterCost) {
				await prisma.roomCost.create({
					data: {
						roomId: room.id,
						costTypeTemplateId: waterCost.id,
						costType: 'metered', // METERED
						unitPrice: roomData.waterUnitPrice,
						unit: 'm³',
						meterReading: 30 + i * 5,
						lastMeterReading: 25 + i * 5,
						currency: 'VND',
						isActive: true,
						notes: 'Nước theo đồng hồ (metered)',
					},
				});
			}

			// Tạo nhiều room instances cho mỗi room type (mỗi instance = 1 phòng cụ thể)
			// Room numbers: 101A, 101B, 102A, 102B, 102C, etc.
			const roomNumberBase = `${roomData.floorNumber}0${i + 1}`; // 101, 102, 201, 202, etc.

			// Nếu phòng có người ở, tạo room instances và rentals
			if (roomData.hasOccupants && roomData.studentCount > 0) {
				for (let j = 0; j < roomData.studentCount; j++) {
					const tenant = createdTenants[tenantIndex];
					tenantIndex++;

					// Create room instance
					const roomNumber = `${roomNumberBase}${String.fromCharCode(65 + j)}`; // 101A, 101B, etc.
					const roomInstance = await prisma.roomInstance.create({
						data: {
							roomId: room.id,
							roomNumber: roomNumber,
							status: 'occupied',
							isActive: true,
						},
					});

					// Create rental (started 3 months ago)
					const currentDate = new Date();
					const contractStartDate = new Date(
						currentDate.getFullYear(),
						currentDate.getMonth() - 3,
						1,
					);
					const contractEndDate = new Date(
						currentDate.getFullYear(),
						currentDate.getMonth() + 9,
						28,
					);

					const rental = await prisma.rental.create({
						data: {
							roomInstanceId: roomInstance.id,
							tenantId: tenant.id,
							ownerId: landlord.id,
							contractStartDate,
							contractEndDate,
							status: 'active',
							monthlyRent: roomData.basePrice,
							depositPaid: roomData.basePrice * 2,
						},
					});

					createdRentals.push(rental);

					console.log(
						`   ✅ Created room instance ${roomInstance.roomNumber} (${roomData.name}) with rental for ${tenant.firstName} ${tenant.lastName}`,
					);
				}
			} else {
				// Phòng trống - chỉ tạo 1 room instance
				const roomInstance = await prisma.roomInstance.create({
					data: {
						roomId: room.id,
						roomNumber: roomNumberBase,
						status: 'available',
						isActive: true,
					},
				});
				console.log(
					`   ✅ Created empty room instance ${roomInstance.roomNumber} (${roomData.name}) - Available`,
				);
			}

			createdRooms.push({ room, studentCount: roomData.studentCount });
		} else {
			console.log(`   ⏭️  Room ${roomData.name} already exists`);
			// Get existing room instances and rentals
			const roomInstances = await prisma.roomInstance.findMany({
				where: { roomId: room.id },
			});
			for (const roomInstance of roomInstances) {
				const rental = await prisma.rental.findFirst({
					where: { roomInstanceId: roomInstance.id },
				});
				if (rental) {
					createdRentals.push(rental);
				}
			}
		}
	}

	// Create bills for the last 3 months
	console.log('\n📄 Creating bills for the last 3 months...');
	const currentDate = new Date();
	const billsCreated = [];

	for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
		const billDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
		const billingYear = billDate.getFullYear();
		const billingMonth = billDate.getMonth() + 1;
		const billingPeriod = `${billingYear}-${String(billingMonth).padStart(2, '0')}`;

		for (let i = 0; i < createdRentals.length; i++) {
			const rental = createdRentals[i];

			// Get tenant for this rental
			const tenant = await prisma.user.findUnique({
				where: { id: rental.tenantId },
			});

			// Check if bill already exists
			const existingBill = await prisma.bill.findUnique({
				where: {
					rentalId_billingPeriod: {
						rentalId: rental.id,
						billingPeriod,
					},
				},
			});

			if (existingBill) {
				console.log(`   ⏭️  Bill for ${billingPeriod} (Room ${i + 1}) already exists`);
				billsCreated.push(existingBill);
				continue;
			}

			// Get room data from room instance
			const roomInstance = await prisma.roomInstance.findUnique({
				where: { id: rental.roomInstanceId },
				include: { room: true },
			});

			if (!roomInstance) {
				console.log(`   ⚠️  Room instance not found for rental ${rental.id}, skipping bill`);
				continue;
			}

			// Find matching room data
			const roomData = roomsData.find((rd) => rd.name === roomInstance.room.name);

			if (!roomData) {
				console.log(`   ⚠️  Room data not found for ${roomInstance.room.name}, using default`);
				continue;
			}

			// Calculate bill amounts - mỗi phòng có giá khác nhau
			const rentAmount = roomData.basePrice;
			const internetAmount = roomData.hasInternet ? roomData.internetPrice : 0;
			const managementAmount = roomData.managementPrice;
			const airConditionerAmount = roomData.hasAirConditioner ? roomData.airConditionerPrice : 0;
			const washingMachineAmount = roomData.hasWashingMachine ? roomData.washingMachinePrice : 0;
			const trashAmount = roomData.trashPrice;
			// Điện nước theo đồng hồ (metered) - usage khác nhau cho mỗi phòng (đa dạng hơn)
			const electricityUsage = 40 + (i % 6) * 8 + monthOffset * 5; // kWh (varied by room and month)
			const waterUsage = 4 + (i % 6) + monthOffset * 0.5; // m³ (varied)
			const electricityAmount = electricityUsage * roomData.electricityUnitPrice;
			const waterAmount = waterUsage * roomData.waterUnitPrice;

			const subtotal =
				rentAmount +
				internetAmount +
				managementAmount +
				airConditionerAmount +
				washingMachineAmount +
				trashAmount +
				electricityAmount +
				waterAmount;
			const totalAmount = subtotal;

			// Create bill
			const periodStart = new Date(billingYear, billingMonth - 1, 1);
			const periodEnd = new Date(billingYear, billingMonth, 0);
			const dueDate = new Date(billingYear, billingMonth, 5);

			const bill = await prisma.bill.create({
				data: {
					rentalId: rental.id,
					roomInstanceId: rental.roomInstanceId,
					billingPeriod,
					billingMonth,
					billingYear,
					periodStart,
					periodEnd,
					subtotal,
					totalAmount,
					remainingAmount: totalAmount,
					dueDate,
					// Đa dạng trạng thái: một số đã trả, một số chưa trả, một số quá hạn
					status:
						monthOffset === 0
							? i % 3 === 0
								? 'pending'
								: i % 3 === 1
									? 'overdue'
									: 'pending' // Current month: mixed status
							: i % 5 === 0
								? 'paid'
								: i % 5 === 1
									? 'paid'
									: i % 5 === 2
										? 'paid'
										: i % 5 === 3
											? 'overdue'
											: 'paid', // Past months: mostly paid, some overdue
					occupancyCount: roomData.maxOccupancy,
				},
			});

			// Create bill items
			await prisma.billItem.create({
				data: {
					billId: bill.id,
					itemType: 'rent',
					itemName: 'Tiền thuê phòng',
					description: `Tiền thuê phòng tháng ${billingMonth}/${billingYear}`,
					amount: rentAmount,
					currency: 'VND',
				},
			});

			// Chỉ tạo bill item cho internet nếu phòng có internet
			if (roomData.hasInternet && internetAmount > 0) {
				await prisma.billItem.create({
					data: {
						billId: bill.id,
						itemType: 'utility',
						itemName: 'Phí Internet',
						description: 'Phí Internet hàng tháng',
						amount: internetAmount,
						currency: 'VND',
					},
				});
			}

			await prisma.billItem.create({
				data: {
					billId: bill.id,
					itemType: 'service',
					itemName: 'Phí quản lý',
					description: 'Phí quản lý tòa nhà',
					amount: managementAmount,
					currency: 'VND',
				},
			});

			// Máy lạnh - chỉ cho phòng có máy lạnh
			if (roomData.hasAirConditioner && airConditionerAmount > 0) {
				await prisma.billItem.create({
					data: {
						billId: bill.id,
						itemType: 'utility',
						itemName: 'Phí máy lạnh',
						description: 'Phí máy lạnh hàng tháng (+200k)',
						amount: airConditionerAmount,
						currency: 'VND',
					},
				});
			}

			// Máy giặt - 100k/phòng
			if (roomData.hasWashingMachine && washingMachineAmount > 0) {
				await prisma.billItem.create({
					data: {
						billId: bill.id,
						itemType: 'service',
						itemName: 'Phí máy giặt',
						description: 'Phí máy giặt hàng tháng (100k/phòng)',
						amount: washingMachineAmount,
						currency: 'VND',
					},
				});
			}

			// Rác - 30k/phòng
			if (trashAmount > 0) {
				await prisma.billItem.create({
					data: {
						billId: bill.id,
						itemType: 'service',
						itemName: 'Phí thu gom rác',
						description: 'Phí thu gom rác hàng tháng (30k/phòng)',
						amount: trashAmount,
						currency: 'VND',
					},
				});
			}

			await prisma.billItem.create({
				data: {
					billId: bill.id,
					itemType: 'utility',
					itemName: 'Điện',
					description: `Điện: ${electricityUsage.toFixed(1)} kWh`,
					quantity: electricityUsage,
					unitPrice: roomData.electricityUnitPrice,
					amount: electricityAmount,
					currency: 'VND',
				},
			});

			await prisma.billItem.create({
				data: {
					billId: bill.id,
					itemType: 'utility',
					itemName: 'Nước',
					description: `Nước: ${waterUsage.toFixed(1)} m³`,
					quantity: waterUsage,
					unitPrice: roomData.waterUnitPrice,
					amount: waterAmount,
					currency: 'VND',
				},
			});

			// Create payment for past months - đa dạng hơn
			if (monthOffset > 0 && tenant && bill.status === 'paid') {
				// Một số thanh toán đúng hạn, một số trễ
				const paymentDay = i % 3 === 0 ? 5 : i % 3 === 1 ? 10 : 15; // Thanh toán vào ngày 5, 10, hoặc 15
				const payment = await prisma.payment.create({
					data: {
						rentalId: rental.id,
						billId: bill.id,
						payerId: tenant.id,
						paymentType: 'rent',
						amount: totalAmount,
						currency: 'VND',
						paymentMethod:
							i % 4 === 0
								? 'bank_transfer'
								: i % 4 === 1
									? 'cash'
									: i % 4 === 2
										? 'e_wallet'
										: 'bank_transfer',
						paymentStatus: 'completed',
						paymentDate: new Date(billingYear, billingMonth - 1, paymentDay),
						description: `Thanh toán hóa đơn tháng ${billingMonth}/${billingYear}`,
					},
				});

				// Update bill status
				await prisma.bill.update({
					where: { id: bill.id },
					data: {
						status: 'paid',
						paidAmount: totalAmount,
						remainingAmount: 0,
						paidDate: payment.paymentDate,
					},
				});
			} else if (monthOffset > 0 && tenant && bill.status === 'overdue') {
				// Một số hóa đơn quá hạn - thanh toán một phần hoặc chưa thanh toán
				if (i % 2 === 0) {
					// Thanh toán một phần (50%)
					const partialAmount = totalAmount * 0.5;
					const payment = await prisma.payment.create({
						data: {
							rentalId: rental.id,
							billId: bill.id,
							payerId: tenant.id,
							paymentType: 'rent',
							amount: partialAmount,
							currency: 'VND',
							paymentMethod: 'bank_transfer',
							paymentStatus: 'completed',
							paymentDate: new Date(billingYear, billingMonth - 1, 20), // Thanh toán trễ
							description: `Thanh toán một phần hóa đơn tháng ${billingMonth}/${billingYear}`,
						},
					});

					await prisma.bill.update({
						where: { id: bill.id },
						data: {
							paidAmount: partialAmount,
							remainingAmount: totalAmount - partialAmount,
							paidDate: payment.paymentDate,
						},
					});
				}
			}

			billsCreated.push(bill);
			console.log(
				`   ✅ Created bill for ${billingPeriod} (Room ${i + 1}): ${totalAmount.toLocaleString('vi-VN')} VND - Status: ${bill.status}`,
			);
		}
	}

	// Create some ratings
	console.log('\n⭐ Creating ratings...');
	for (let i = 0; i < createdRentals.length; i++) {
		const rental = createdRentals[i];

		// Get tenant for this rental
		const tenant = await prisma.user.findUnique({
			where: { id: rental.tenantId },
		});

		if (!tenant) {
			continue;
		}

		// Check if rating exists
		const existingRating = await prisma.rating.findFirst({
			where: {
				targetType: 'landlord',
				targetId: landlord.id,
				reviewerId: tenant.id,
				rentalId: rental.id,
			},
		});

		if (!existingRating) {
			// Đa dạng ratings: 3, 4, 5 sao với nội dung khác nhau
			const ratings = [
				{
					rating: 5,
					content:
						'Chủ trọ rất nhiệt tình, phòng sạch sẽ, giá cả hợp lý. Gần IUH rất tiện cho sinh viên. Rất hài lòng!',
				},
				{
					rating: 4,
					content:
						'Phòng tốt, giá cả hợp lý. Chủ trọ dễ tính. Gần trường rất tiện. Nên cải thiện thêm internet.',
				},
				{
					rating: 5,
					content:
						'Tuyệt vời! Phòng đẹp, đầy đủ tiện nghi. Chủ trọ rất quan tâm sinh viên. Highly recommend!',
				},
				{
					rating: 4,
					content:
						'Phòng ổn, giá rẻ phù hợp sinh viên. Gần IUH rất tiện. Có thể cải thiện thêm về vệ sinh.',
				},
				{
					rating: 3,
					content: 'Phòng được, giá rẻ nhưng cần cải thiện thêm về tiện nghi. Chủ trọ ổn.',
				},
				{
					rating: 5,
					content: 'Rất hài lòng! Phòng sạch, giá tốt, chủ trọ nhiệt tình. Perfect cho sinh viên!',
				},
				{
					rating: 4,
					content: 'Phòng tốt, giá hợp lý. Gần trường tiện lợi. Nên cải thiện thêm về an ninh.',
				},
			];
			const ratingData = ratings[i % ratings.length];

			await prisma.rating.create({
				data: {
					targetType: 'landlord',
					targetId: landlord.id,
					reviewerId: tenant.id,
					rentalId: rental.id,
					rating: ratingData.rating,
					content: ratingData.content,
				},
			});
			console.log(
				`   ✅ Created rating (${ratingData.rating}⭐) from ${tenant.firstName} ${tenant.lastName}`,
			);
		}
	}

	// Summary
	console.log('\n📊 Test Data Setup Summary:');
	console.log(`   • Landlord: ${landlord.firstName} ${landlord.lastName} (${landlord.email})`);
	console.log(
		`   • Building: ${building.name} - ${building.addressLine1}, ${building.addressLine2}`,
	);
	console.log(`   • Room Types: ${roomsData.length} (2 loại: có/không máy lạnh)`);
	console.log(
		`   • Phòng không máy lạnh: ${roomsData.filter((r) => !r.hasAirConditioner).length} phòng`,
	);
	console.log(
		`   • Phòng có máy lạnh: ${roomsData.filter((r) => r.hasAirConditioner).length} phòng (+200k)`,
	);
	console.log(
		`   • Occupied Rooms: ${roomsData.filter((r) => r.hasOccupants).length} phòng có người ở`,
	);
	console.log(`   • Room Instances: ${createdRentals.length} phòng có người ở`);
	console.log(`   • Tenants: ${createdTenants.length} sinh viên IUH`);
	console.log(`   • Rentals: ${createdRentals.length}`);
	console.log(`   • Bills: ${billsCreated.length} (3 tháng × ${createdRentals.length} phòng)`);
	console.log(`   • Ratings: ${createdRentals.length}`);
	console.log(`\n📋 Room Details:`);
	roomsData.forEach((rd) => {
		const status = rd.hasOccupants ? `✅ ${rd.studentCount} sinh viên` : '🟢 Trống';
		const acStatus = rd.hasAirConditioner ? 'Có máy lạnh (+200k)' : 'Không máy lạnh';
		console.log(
			`   • ${rd.name}: ${status}, ${acStatus}, ${rd.basePrice.toLocaleString('vi-VN')} VND/tháng`,
		);
		if (rd.hasInternet) {
			console.log(`     - Internet: ${rd.internetPrice.toLocaleString('vi-VN')} VND`);
		}
		if (rd.hasAirConditioner) {
			console.log(`     - Máy lạnh: ${rd.airConditionerPrice.toLocaleString('vi-VN')} VND`);
		}
		if (rd.hasWashingMachine) {
			console.log(`     - Máy giặt: ${rd.washingMachinePrice.toLocaleString('vi-VN')} VND`);
		}
		console.log(`     - Rác: ${rd.trashPrice.toLocaleString('vi-VN')} VND`);
		console.log(`     - Quản lý: ${rd.managementPrice.toLocaleString('vi-VN')} VND`);
		console.log(
			`     - Điện: ${rd.electricityUnitPrice.toLocaleString('vi-VN')} VND/kWh (metered)`,
		);
		console.log(`     - Nước: ${rd.waterUnitPrice.toLocaleString('vi-VN')} VND/m³ (metered)`);
	});
	console.log(`\n🔑 Login Information:`);
	console.log(`   • Landlord: ${landlord.email} / ${DEFAULT_PASSWORD}`);
	console.log(`   • Tenants:`);
	createdTenants.forEach((tenant) => {
		console.log(`     - ${tenant.email} / ${DEFAULT_PASSWORD}`);
	});
	console.log('');
}

async function clearStatsTestData() {
	console.log('🗑️  Clearing statistics test data...\n');

	// Delete in reverse order of dependencies
	const studentEmails = [
		'student.101a@trustay.com',
		'student.101b@trustay.com',
		'student.102a@trustay.com',
		'student.102b@trustay.com',
		'student.103a@trustay.com',
		'student.103b@trustay.com',
		'student.201a@trustay.com',
		'student.201b@trustay.com',
		'student.202a@trustay.com',
		'student.202b@trustay.com',
		'student.203a@trustay.com',
		'student.203b@trustay.com',
	];

	// Delete payments
	const deletedPayments = await prisma.payment.deleteMany({
		where: {
			payer: {
				email: { in: studentEmails },
			},
		},
	});
	console.log(`   ✅ Deleted ${deletedPayments.count} payments`);

	// Delete bills
	const deletedBills = await prisma.bill.deleteMany({
		where: {
			rental: {
				owner: {
					email: 'budget.student@trustay.com',
				},
			},
		},
	});
	console.log(`   ✅ Deleted ${deletedBills.count} bills`);

	// Delete ratings
	const deletedRatings = await prisma.rating.deleteMany({
		where: {
			reviewer: {
				email: { in: studentEmails },
			},
		},
	});
	console.log(`   ✅ Deleted ${deletedRatings.count} ratings`);

	// Delete rentals
	const deletedRentals = await prisma.rental.deleteMany({
		where: {
			owner: {
				email: 'budget.student@trustay.com',
			},
		},
	});
	console.log(`   ✅ Deleted ${deletedRentals.count} rentals`);

	// Delete room instances
	const building = await prisma.building.findUnique({
		where: { id: 'nha-tro-sinh-vien-nguyen-van-bao-go-vap' },
		include: { rooms: { include: { roomInstances: true } } },
	});

	if (building) {
		for (const room of building.rooms) {
			await prisma.roomInstance.deleteMany({
				where: { roomId: room.id },
			});
		}
		console.log(`   ✅ Deleted room instances`);
	}

	// Delete rooms
	const deletedRooms = await prisma.room.deleteMany({
		where: {
			building: {
				owner: {
					email: 'budget.student@trustay.com',
				},
			},
		},
	});
	console.log(`   ✅ Deleted ${deletedRooms.count} rooms`);

	// Delete building
	const deletedBuilding = await prisma.building.deleteMany({
		where: {
			owner: {
				email: 'budget.student@trustay.com',
			},
		},
	});
	console.log(`   ✅ Deleted ${deletedBuilding.count} buildings`);

	// Delete student tenants
	const deletedTenants = await prisma.user.deleteMany({
		where: {
			email: { in: studentEmails },
		},
	});
	console.log(`   ✅ Deleted ${deletedTenants.count} student tenants`);

	console.log('\n✅ Test data cleared successfully!\n');
}

async function main() {
	const action = process.argv[2];

	console.log('🚀 Statistics Test Data Setup\n');

	try {
		if (action === 'clear') {
			await clearStatsTestData();
		} else {
			await setupStatsTestData();
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
	setupStatsTestData,
	clearStatsTestData,
};
