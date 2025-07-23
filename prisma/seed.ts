import {
	PrismaClient,
	AmenityCategory,
	CostCategory,
	Gender,
	UserRole,
	RoomType,
	SearchPostStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Helper function to create slug from text
function createSlug(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // Remove diacritics
		.replace(/đ/g, "d")
		.replace(/Đ/g, "d")
		.replace(/[^a-z0-9\s-]/g, "") // Remove special chars
		.replace(/\s+/g, "-") // Replace spaces with dashes
		.replace(/-+/g, "-") // Replace multiple dashes with single
		.trim();
}

async function main() {
	console.log("🌱 Starting database seeding...");

	// Hash password for demo users
	const defaultPassword = await bcrypt.hash("truststay123", 12);

	console.log("📝 Creating system amenities...");
	const systemAmenities = [
		// Basic amenities
		{
			name: "Giường",
			nameEn: "bed",
			category: "basic" as AmenityCategory,
			iconUrl: "bed",
			description: "Giường ngủ",
		},
		{
			name: "Tủ quần áo",
			nameEn: "wardrobe",
			category: "basic" as AmenityCategory,
			iconUrl: "cabinet",
			description: "Tủ để quần áo",
		},
		{
			name: "Bàn học",
			nameEn: "desk",
			category: "basic" as AmenityCategory,
			iconUrl: "book-open",
			description: "Bàn học/làm việc",
		},
		{
			name: "Ghế",
			nameEn: "chair",
			category: "basic" as AmenityCategory,
			iconUrl: "armchair",
			description: "Ghế ngồi",
		},
		{
			name: "Điều hòa",
			nameEn: "air_conditioning",
			category: "basic" as AmenityCategory,
			iconUrl: "air-vent",
			description: "Máy lạnh",
		},
		{
			name: "Quạt trần",
			nameEn: "ceiling_fan",
			category: "basic" as AmenityCategory,
			iconUrl: "fan",
			description: "Quạt trần",
		},

		// Kitchen amenities
		{
			name: "Tủ lạnh",
			nameEn: "refrigerator",
			category: "kitchen" as AmenityCategory,
			iconUrl: "refrigerator",
			description: "Tủ lạnh",
		},
		{
			name: "Bếp gas",
			nameEn: "gas_stove",
			category: "kitchen" as AmenityCategory,
			iconUrl: "flame",
			description: "Bếp gas",
		},
		{
			name: "Lò vi sóng",
			nameEn: "microwave",
			category: "kitchen" as AmenityCategory,
			iconUrl: "microwave",
			description: "Lò vi sóng",
		},
		{
			name: "Nồi cơm điện",
			nameEn: "rice_cooker",
			category: "kitchen" as AmenityCategory,
			iconUrl: "chef-hat",
			description: "Nồi cơm điện",
		},
		{
			name: "Ấm đun nước",
			nameEn: "kettle",
			category: "kitchen" as AmenityCategory,
			iconUrl: "coffee",
			description: "Ấm đun nước điện",
		},

		// Bathroom amenities
		{
			name: "Nước nóng",
			nameEn: "hot_water",
			category: "bathroom" as AmenityCategory,
			iconUrl: "shower",
			description: "Bình nước nóng",
		},
		{
			name: "Máy giặt",
			nameEn: "washing_machine",
			category: "bathroom" as AmenityCategory,
			iconUrl: "washing-machine",
			description: "Máy giặt",
		},
		{
			name: "Gương",
			nameEn: "mirror",
			category: "bathroom" as AmenityCategory,
			iconUrl: "mirror",
			description: "Gương soi",
		},

		// Entertainment amenities
		{
			name: "TV",
			nameEn: "television",
			category: "entertainment" as AmenityCategory,
			iconUrl: "tv",
			description: "Tivi",
		},
		{
			name: "Internet",
			nameEn: "wifi",
			category: "connectivity" as AmenityCategory,
			iconUrl: "wifi",
			description: "Wi-Fi miễn phí",
		},

		// Safety amenities
		{
			name: "Camera an ninh",
			nameEn: "security_camera",
			category: "safety" as AmenityCategory,
			iconUrl: "camera",
			description: "Camera giám sát",
		},
		{
			name: "Khóa vân tay",
			nameEn: "fingerprint_lock",
			category: "safety" as AmenityCategory,
			iconUrl: "fingerprint",
			description: "Khóa cửa vân tay",
		},
		{
			name: "Báo cháy",
			nameEn: "fire_alarm",
			category: "safety" as AmenityCategory,
			iconUrl: "alert-triangle",
			description: "Hệ thống báo cháy",
		},

		// Building amenities
		{
			name: "Thang máy",
			nameEn: "elevator",
			category: "building" as AmenityCategory,
			iconUrl: "move-vertical",
			description: "Thang máy",
		},
		{
			name: "Bãi đỗ xe",
			nameEn: "parking",
			category: "building" as AmenityCategory,
			iconUrl: "car",
			description: "Chỗ đỗ xe máy",
		},
		{
			name: "Khu giặt chung",
			nameEn: "laundry_area",
			category: "building" as AmenityCategory,
			iconUrl: "washing-machine",
			description: "Khu vực giặt ủi chung",
		},
		{
			name: "Sân thượng",
			nameEn: "rooftop",
			category: "building" as AmenityCategory,
			iconUrl: "building",
			description: "Sân thượng",
		},
	];

	const createdAmenities: any[] = [];
	for (let i = 0; i < systemAmenities.length; i++) {
		const amenity = systemAmenities[i];
		const created = await prisma.systemAmenity.upsert({
			where: { nameEn: amenity.nameEn },
			update: {},
			create: {
				...amenity,
				sortOrder: i + 1,
				isActive: true,
			},
		});
		createdAmenities.push(created);
	}

	console.log("💰 Creating system cost types...");
	const systemCostTypes = [
		// Utilities
		{
			name: "Tiền điện",
			nameEn: "electricity",
			category: "utility" as CostCategory,
			defaultUnit: "kWh",
			iconUrl: "zap",
			description: "Chi phí điện",
		},
		{
			name: "Tiền nước",
			nameEn: "water",
			category: "utility" as CostCategory,
			defaultUnit: "m³",
			iconUrl: "droplets",
			description: "Chi phí nước",
		},
		{
			name: "Internet",
			nameEn: "internet",
			category: "utility" as CostCategory,
			defaultUnit: "tháng",
			iconUrl: "globe",
			description: "Cước internet",
		},
		{
			name: "Gas",
			nameEn: "gas",
			category: "utility" as CostCategory,
			defaultUnit: "bình",
			iconUrl: "flame",
			description: "Gas nấu ăn",
		},

		// Services
		{
			name: "Vệ sinh",
			nameEn: "cleaning",
			category: "service" as CostCategory,
			defaultUnit: "lần",
			iconUrl: "broom",
			description: "Dịch vụ vệ sinh",
		},
		{
			name: "Bảo vệ",
			nameEn: "security",
			category: "service" as CostCategory,
			defaultUnit: "tháng",
			iconUrl: "shield",
			description: "Dịch vụ bảo vệ",
		},
		{
			name: "Quản lý",
			nameEn: "management",
			category: "service" as CostCategory,
			defaultUnit: "tháng",
			iconUrl: "building-2",
			description: "Phí quản lý",
		},

		// Parking
		{
			name: "Giữ xe máy",
			nameEn: "motorbike_parking",
			category: "parking" as CostCategory,
			defaultUnit: "tháng",
			iconUrl: "bike",
			description: "Phí giữ xe máy",
		},
		{
			name: "Giữ xe đạp",
			nameEn: "bicycle_parking",
			category: "parking" as CostCategory,
			defaultUnit: "tháng",
			iconUrl: "bike",
			description: "Phí giữ xe đạp",
		},

		// Maintenance
		{
			name: "Sửa chữa",
			nameEn: "repair",
			category: "maintenance" as CostCategory,
			defaultUnit: "lần",
			iconUrl: "wrench",
			description: "Chi phí sửa chữa",
		},
		{
			name: "Thay thế",
			nameEn: "replacement",
			category: "maintenance" as CostCategory,
			defaultUnit: "lần",
			iconUrl: "repeat",
			description: "Chi phí thay thế đồ dùng",
		},
	];

	const createdCostTypes: any[] = [];
	for (let i = 0; i < systemCostTypes.length; i++) {
		const costType = systemCostTypes[i];
		const created = await prisma.systemCostType.upsert({
			where: { nameEn: costType.nameEn },
			update: {},
			create: {
				...costType,
				sortOrder: i + 1,
				isActive: true,
			},
		});
		createdCostTypes.push(created);
	}

	console.log("👥 Creating sample users...");

	// Sample landlords
	const landlord1 = await prisma.user.upsert({
		where: { email: "landlord1@truststay.com" },
		update: {},
		create: {
			email: "landlord1@truststay.com",
			phone: "0901234567",
			passwordHash: defaultPassword,
			firstName: "Minh",
			lastName: "Nguyễn",
			gender: "male" as Gender,
			role: "landlord" as UserRole,
			bio: "Chủ nhà trọ với 10 năm kinh nghiệm, cam kết cung cấp chỗ ở tốt nhất cho sinh viên và người lao động.",
			idCardNumber: "123456789012",
			bankAccount: "1234567890",
			bankName: "Vietcombank",
			isVerifiedPhone: true,
			isVerifiedEmail: true,
			isVerifiedIdentity: true,
			isVerifiedBank: true,
			addresses: {
				create: {
					addressLine1: "123 Đường Lê Văn Việt",
					district: "Quận 9",
					city: "TP. Hồ Chí Minh",
					country: "Vietnam",
					isPrimary: true,
				},
			},
		},
	});

	const landlord2 = await prisma.user.upsert({
		where: { email: "landlord2@truststay.com" },
		update: {},
		create: {
			email: "landlord2@truststay.com",
			phone: "0912345678",
			passwordHash: defaultPassword,
			firstName: "Hương",
			lastName: "Trần",
			gender: "female" as Gender,
			role: "landlord" as UserRole,
			bio: "Chủ nhà trọ thân thiện, luôn quan tâm đến nhu cầu của người thuê.",
			idCardNumber: "234567890123",
			bankAccount: "2345678901",
			bankName: "Techcombank",
			isVerifiedPhone: true,
			isVerifiedEmail: true,
			isVerifiedIdentity: true,
			isVerifiedBank: true,
			addresses: {
				create: {
					addressLine1: "456 Đường Võ Văn Ngân",
					district: "Thủ Đức",
					city: "TP. Hồ Chí Minh",
					country: "Vietnam",
					isPrimary: true,
				},
			},
		},
	});

	// Sample tenants
	const tenant1 = await prisma.user.upsert({
		where: { email: "tenant1@truststay.com" },
		update: {},
		create: {
			email: "tenant1@truststay.com",
			phone: "0923456789",
			passwordHash: defaultPassword,
			firstName: "Hải",
			lastName: "Lê",
			gender: "male" as Gender,
			role: "tenant" as UserRole,
			bio: "Sinh viên năm 3 ngành CNTT, tìm phòng trọ gần trường.",
			idCardNumber: "345678901234",
			isVerifiedPhone: true,
			isVerifiedEmail: true,
			addresses: {
				create: {
					addressLine1: "789 Đường Nguyễn Thị Minh Khai",
					district: "Quận 1",
					city: "TP. Hồ Chí Minh",
					country: "Vietnam",
					isPrimary: true,
				},
			},
		},
	});

	const tenant2 = await prisma.user.upsert({
		where: { email: "tenant2@truststay.com" },
		update: {},
		create: {
			email: "tenant2@truststay.com",
			phone: "0934567890",
			passwordHash: defaultPassword,
			firstName: "Linh",
			lastName: "Phạm",
			gender: "female" as Gender,
			role: "tenant" as UserRole,
			bio: "Nhân viên văn phòng, cần tìm phòng trọ yên tĩnh.",
			idCardNumber: "456789012345",
			isVerifiedPhone: true,
			isVerifiedEmail: true,
			addresses: {
				create: {
					addressLine1: "321 Đường Cách Mạng Tháng 8",
					district: "Quận 10",
					city: "TP. Hồ Chí Minh",
					country: "Vietnam",
					isPrimary: true,
				},
			},
		},
	});

	console.log("🏢 Creating sample buildings with floors and rooms...");

	// Building 1
	const buildingName = "Nhà trọ Minh Phát";
	const buildingDistrict = "Quận 9";
	const buildingSlug = createSlug(`${buildingName} ${buildingDistrict}`);
	
	const building1 = await prisma.building.upsert({
		where: { id: buildingSlug },
		update: {},
		create: {
			id: buildingSlug,
			slug: buildingSlug,
			ownerId: landlord1.id,
			name: buildingName,
			description: "Nhà trọ cao cấp gần trường Đại học Bách Khoa",
			addressLine1: "123 Đường Lê Văn Việt",
			district: buildingDistrict,
			city: "TP. Hồ Chí Minh",
			country: "Vietnam",
			isActive: true,
			isVerified: true,
		},
	});

	// Floor 1 of Building 1
	const floor1B1 = await prisma.floor.upsert({
		where: { 
			buildingId_floorNumber: {
				buildingId: building1.id,
				floorNumber: 1
			}
		},
		update: {},
		create: {
			buildingId: building1.id,
			floorNumber: 1,
			name: "Tầng 1",
			description: "Tầng trệt với 4 phòng",
			isActive: true,
		},
	});

	// Floor 2 of Building 1
	const floor2B1 = await prisma.floor.upsert({
		where: { 
			buildingId_floorNumber: {
				buildingId: building1.id,
				floorNumber: 2
			}
		},
		update: {},
		create: {
			buildingId: building1.id,
			floorNumber: 2,
			name: "Tầng 2",
			description: "Tầng 2 với 4 phòng",
			isActive: true,
		},
	});

	// Rooms for Building 1
	const roomsData = [
		// Floor 1 rooms
		{
			floorId: floor1B1.id,
			roomNumber: "101",
			roomType: "single" as RoomType,
			areaSqm: 25,
			maxOccupancy: 1,
			description: "Phòng đơn có cửa sổ",
		},
		{
			floorId: floor1B1.id,
			roomNumber: "102",
			roomType: "double" as RoomType,
			areaSqm: 35,
			maxOccupancy: 2,
			description: "Phòng đôi rộng rãi",
		},
		{
			floorId: floor1B1.id,
			roomNumber: "103",
			roomType: "single" as RoomType,
			areaSqm: 20,
			maxOccupancy: 1,
			description: "Phòng đơn nhỏ gọn",
		},
		{
			floorId: floor1B1.id,
			roomNumber: "104",
			roomType: "suite" as RoomType,
			areaSqm: 45,
			maxOccupancy: 2,
			description: "Phòng suite có ban công",
		},

		// Floor 2 rooms
		{
			floorId: floor2B1.id,
			roomNumber: "201",
			roomType: "single" as RoomType,
			areaSqm: 25,
			maxOccupancy: 1,
			description: "Phòng đơn tầng 2",
		},
		{
			floorId: floor2B1.id,
			roomNumber: "202",
			roomType: "double" as RoomType,
			areaSqm: 35,
			maxOccupancy: 2,
			description: "Phòng đôi tầng 2",
		},
		{
			floorId: floor2B1.id,
			roomNumber: "203",
			roomType: "single" as RoomType,
			areaSqm: 22,
			maxOccupancy: 1,
			description: "Phòng đơn view đẹp",
		},
		{
			floorId: floor2B1.id,
			roomNumber: "204",
			roomType: "dormitory" as RoomType,
			areaSqm: 50,
			maxOccupancy: 4,
			description: "Phòng tập thể 4 người",
		},
	];

	const createdRooms: any[] = [];
	for (const roomData of roomsData) {
		// Create room slug: building-name + room-number
		const roomSlug = createSlug(`${buildingName} phong ${roomData.roomNumber}`);
		
		const room = await prisma.room.upsert({
			where: { id: roomSlug },
			update: {},
			create: {
				...roomData,
				id: roomSlug,
				slug: roomSlug,
				isActive: true,
				isVerified: true,
			},
		});
		createdRooms.push(room);
	}

	console.log("💰 Adding room pricing...");
	const pricingsData = [
		{
			roomId: createdRooms[0].id,
			basePriceMonthly: 3500000,
			depositAmount: 3500000,
			depositMonths: 1,
			minimumStayMonths: 3,
		},
		{
			roomId: createdRooms[1].id,
			basePriceMonthly: 5000000,
			depositAmount: 5000000,
			depositMonths: 1,
			minimumStayMonths: 3,
		},
		{
			roomId: createdRooms[2].id,
			basePriceMonthly: 3000000,
			depositAmount: 3000000,
			depositMonths: 1,
			minimumStayMonths: 3,
		},
		{
			roomId: createdRooms[3].id,
			basePriceMonthly: 7000000,
			depositAmount: 7000000,
			depositMonths: 1,
			minimumStayMonths: 6,
		},
		{
			roomId: createdRooms[4].id,
			basePriceMonthly: 3800000,
			depositAmount: 3800000,
			depositMonths: 1,
			minimumStayMonths: 3,
		},
		{
			roomId: createdRooms[5].id,
			basePriceMonthly: 5200000,
			depositAmount: 5200000,
			depositMonths: 1,
			minimumStayMonths: 3,
		},
		{
			roomId: createdRooms[6].id,
			basePriceMonthly: 3200000,
			depositAmount: 3200000,
			depositMonths: 1,
			minimumStayMonths: 3,
		},
		{
			roomId: createdRooms[7].id,
			basePriceMonthly: 2500000,
			depositAmount: 2500000,
			depositMonths: 1,
			minimumStayMonths: 6,
		},
	];

	for (const pricingData of pricingsData) {
		await prisma.roomPricing.upsert({
			where: { roomId: pricingData.roomId },
			update: {},
			create: {
				...pricingData,
				currency: "VND",
				utilityIncluded: false,
				utilityCostMonthly: 500000,
				priceNegotiable: true,
			},
		});
	}

	console.log("🏠 Adding room amenities...");
	// Add basic amenities to all rooms
	const basicAmenities = createdAmenities.filter((a) =>
		["bed", "wardrobe", "desk", "chair"].includes(a.nameEn)
	);

	for (const room of createdRooms) {
		for (const amenity of basicAmenities) {
			await prisma.roomAmenity.upsert({
				where: { 
					roomId_systemAmenityId: {
						roomId: room.id,
						systemAmenityId: amenity.id
					}
				},
				update: {},
				create: {
					roomId: room.id,
					systemAmenityId: amenity.id,
				},
			});
		}

		// Add AC to suite and some other rooms
		if (room.roomType === "suite" || room.roomNumber.endsWith("2")) {
			const acAmenity = createdAmenities.find(
				(a) => a.nameEn === "air_conditioning"
			);
			if (acAmenity) {
				await prisma.roomAmenity.upsert({
					where: { 
						roomId_systemAmenityId: {
							roomId: room.id,
							systemAmenityId: acAmenity.id
						}
					},
					update: {},
					create: {
						roomId: room.id,
						systemAmenityId: acAmenity.id,
					},
				});
			}
		}
	}

	console.log("💡 Adding room costs...");
	// Add basic costs to all rooms
	const electricityCost = createdCostTypes.find(
		(c) => c.nameEn === "electricity"
	);
	const waterCost = createdCostTypes.find((c) => c.nameEn === "water");

	for (const room of createdRooms) {
		if (electricityCost) {
			await prisma.roomCost.upsert({
				where: { 
					roomId_systemCostTypeId: {
						roomId: room.id,
						systemCostTypeId: electricityCost.id
					}
				},
				update: {},
				create: {
					roomId: room.id,
					systemCostTypeId: electricityCost.id,
					baseRate: 4000, // 4k VND per kWh
					currency: "VND",
				},
			});
		}

		if (waterCost) {
			await prisma.roomCost.upsert({
				where: { 
					roomId_systemCostTypeId: {
						roomId: room.id,
						systemCostTypeId: waterCost.id
					}
				},
				update: {},
				create: {
					roomId: room.id,
					systemCostTypeId: waterCost.id,
					baseRate: 25000, // 25k VND per m³
					currency: "VND",
				},
			});
		}
	}

	console.log("📝 Creating sample room search posts...");
	
	// Sample search posts from tenants
	const searchPost1 = await prisma.roomSearchPost.upsert({
		where: { id: "search-post-1" },
		update: {},
		create: {
			id: "search-post-1",
			tenantId: tenant1.id,
			title: "Sinh viên IT tìm phòng trọ gần trường ĐH Bách Khoa",
			description: "Mình là sinh viên năm 3 ngành CNTT, tìm phòng trọ sạch sẽ, yên tĩnh để học tập. Có wifi, điều hòa là tốt nhất.",
			preferredDistricts: ["Quận 9", "Thủ Đức", "Quận 2"],
			preferredWards: [],
			preferredCity: "TP. Hồ Chí Minh",
			minBudget: 2500000,
			maxBudget: 4000000,
			preferredRoomTypes: ["single"],
			maxOccupancy: 1,
			minAreaSqm: 20,
			moveInDate: new Date("2025-02-01"),
			rentalDuration: 12,
			requiredAmenities: ["bed", "wifi", "air_conditioning"],
			contactPhone: "0923456789",
			contactEmail: "tenant1@truststay.com",
			status: "active" as SearchPostStatus,
			autoRenew: true,
			expiresAt: new Date("2025-03-01")
		}
	});

	const searchPost2 = await prisma.roomSearchPost.upsert({
		where: { id: "search-post-2" },
		update: {},
		create: {
			id: "search-post-2",
			tenantId: tenant2.id,
			title: "Nhân viên văn phòng tìm phòng trọ cao cấp",
			description: "Tìm phòng trọ cao cấp, có đầy đủ tiện nghi, gần khu trung tâm để đi làm thuận tiện. Ngân sách thoải mái.",
			preferredDistricts: ["Quận 1", "Quận 3", "Quận 10", "Quận Tân Bình"],
			preferredWards: [],
			preferredCity: "TP. Hồ Chí Minh",
			minBudget: 5000000,
			maxBudget: 8000000,
			preferredRoomTypes: ["single", "suite"],
			maxOccupancy: 1,
			minAreaSqm: 25,
			moveInDate: new Date("2025-02-15"),
			rentalDuration: 6,
			requiredAmenities: ["bed", "wifi", "air_conditioning", "refrigerator"],
			contactPhone: "0934567890",
			contactEmail: "tenant2@truststay.com",
			status: "active" as SearchPostStatus,
			autoRenew: false,
			expiresAt: new Date("2025-02-28")
		}
	});

	console.log("✅ Database seeding completed successfully!");
	console.log(`
📊 Summary:
- System Amenities: ${createdAmenities.length}
- System Cost Types: ${createdCostTypes.length}
- Users: 4 (2 landlords, 2 tenants)
- Buildings: 1 (with slug)
- Floors: 2
- Rooms: ${createdRooms.length} (with slug)
- Room Pricing: ${pricingsData.length}
- Room Search Posts: 2

🔑 Demo Accounts:
Landlords:
- landlord1@truststay.com / truststay123
- landlord2@truststay.com / truststay123

Tenants:
- tenant1@truststay.com / truststay123
- tenant2@truststay.com / truststay123
  `);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("❌ Seeding failed:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
