import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

interface CrawledData {
	id: string;
	link: string;
	title: string;
	price: string;
	location: string;
	description: string;
	posted_time: string;
	image_count: string;
	image_url: string;
	post_type: string;
	price_normalized: {
		original_price: string;
		price_numeric: number;
		currency: string;
		period: string;
	};
	page_number: number;
	official_price: string;
	full_address: string;
	listing_code: string;
	post_date: string;
	expiry_date: string;
	detailed_description: string;
	description_extraction_method: string;
	poster_full_name: string;
	phone_number: string;
	zalo_link: string;
	member_info: string;
	map_embed_url: string;
	map_address_query: string;
	coordinates: {
		latitude: number;
		longitude: number;
	};
	coordinates_string: string;
	coordinates_source: string;
	district: string;
	province: string;
	full_address_normalized: {
		full_address: string;
		components: string[];
		street_number?: string;
		street_name?: string;
		ward?: string;
		district: string;
		city: string;
	};
	map_address_query_normalized: any;
	official_price_normalized: {
		original_price: string;
		price_numeric: number;
		currency: string;
		period: string;
	};
	post_date_normalized: {
		original_date: string;
		iso_date: string;
		day_of_week: string;
		time: string;
		date_components: {
			day: number;
			month: number;
			year: number;
		};
	};
	expiry_date_normalized: {
		original_date: string;
		iso_date: string;
		day_of_week: string;
		time: string;
		date_components: {
			day: number;
			month: number;
			year: number;
		};
	};
	member_info_normalized: {
		original_info: string;
		posted_count: number;
		join_date: string;
		join_date_iso: string;
	};
}

// Helper functions
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // Remove accents
		.replace(/[đĐ]/g, "d")
		.replace(/[^a-z0-9\s]/g, "")
		.replace(/\s+/g, "-")
		.replace(/^-+|-+$/g, "");
}


function extractRoomNumber(address: string, title: string, buildingId: string): string {
	// Try to extract room number from address or title
	const roomMatch = address.match(/phòng\s*(\d+)|p\.?\s*(\d+)|room\s*(\d+)/i);
	if (roomMatch) {
		return roomMatch[1] || roomMatch[2] || roomMatch[3];
	}

	const titleMatch = title.match(/phòng\s*(\d+)|p\.?\s*(\d+)/i);
	if (titleMatch) {
		return titleMatch[1] || titleMatch[2];
	}

	// Generate unique room number based on building ID and timestamp
	const timestamp = Date.now().toString().slice(-4);
	const buildingHash = buildingId.slice(-2);
	return `${buildingHash}${timestamp}`;
}

function determineRoomType(
	title: string,
	description: string
): "single" | "double" | "suite" | "dormitory" {
	const content = (title + " " + description).toLowerCase();

	if (
		content.includes("ở ghép") ||
		content.includes("ghép") ||
		content.includes("ký túc")
	) {
		return "dormitory";
	}
	if (
		content.includes("suite") ||
		content.includes("căn hộ") ||
		content.includes("studio")
	) {
		return "suite";
	}
	if (
		content.includes("đôi") ||
		content.includes("2 người") ||
		content.includes("hai người")
	) {
		return "double";
	}

	return "single"; // Default
}

async function findOrCreateLocation(addressData: any) {
	const { ward, district, city } = addressData || {};

	// Find province (city) with better matching
	let province = await prisma.province.findFirst({
		where: {
			OR: [
				{ name: { equals: city, mode: "insensitive" } },
				{ name: { contains: city, mode: "insensitive" } },
				{ name: { contains: "Hồ Chí Minh", mode: "insensitive" } },
				{ name: { contains: "Hà Nội", mode: "insensitive" } },
				{ name: { contains: "Đà Nẵng", mode: "insensitive" } },
				{ name: { contains: "Cần Thơ", mode: "insensitive" } },
			],
		},
	});

	if (!province) {
		// Create province if not exists
		const provinceCode = randomUUID().slice(0, 6);
		province = await prisma.province.create({
			data: {
				code: provinceCode,
				name: city || "Thành phố Hồ Chí Minh",
				nameEn: city === "Thành phố Hồ Chí Minh" ? "Ho Chi Minh City" : city,
			},
		});
	}

	// Find district
	let districtRecord = await prisma.district.findFirst({
		where: {
			AND: [
				{ name: { contains: district, mode: "insensitive" } },
				{ provinceId: province.id },
			],
		},
	});

	if (!districtRecord) {
		// Create district if not exists
		const districtCode = randomUUID().slice(0, 8);
		districtRecord = await prisma.district.create({
			data: {
				code: districtCode,
				name: district,
				provinceId: province.id,
			},
		});
	}

	// Find ward if provided
	let wardRecord: any = null;
	if (ward) {
		wardRecord = await prisma.ward.findFirst({
			where: {
				AND: [
					{ name: { contains: ward, mode: "insensitive" } },
					{ districtId: districtRecord.id },
				],
			},
		});

		if (!wardRecord) {
			// Create ward if not exists
			const wardCode = randomUUID().slice(0, 8);
			wardRecord = await prisma.ward.create({
				data: {
					code: wardCode,
					name: ward,
					level: ward.includes("Phường") ? "Phường" : "Xã",
					districtId: districtRecord.id,
				},
			});
		}
	}

	return {
		province,
		district: districtRecord,
		ward: wardRecord,
	};
}

async function createDummyOwner(): Promise<string> {
	// Check if dummy owner exists
	let owner = await prisma.user.findFirst({
		where: { email: "dummy.owner@truststay.com" },
	});

	if (!owner) {
		owner = await prisma.user.create({
			data: {
				email: "dummy.owner@truststay.com",
				passwordHash: "dummy_hash",
				firstName: "Dummy",
				lastName: "Owner",
				role: "landlord",
				isVerifiedEmail: true,
			},
		});
	}

	return owner.id;
}

async function importCrawledData(filePath: string) {
	console.log("🚀 Bắt đầu import dữ liệu crawled...");

	try {
		// Read JSON file
		const rawData = fs.readFileSync(filePath, "utf-8");
		const crawledData: CrawledData[] = JSON.parse(rawData);

		console.log(`📊 Tổng số records: ${crawledData.length}`);

		// Get or create dummy owner
		const ownerId = await createDummyOwner();

		// Process data in batches
		const batchSize = 10;
		let processedCount = 0;
		let successCount = 0;
		let errorCount = 0;

		for (let i = 0; i < crawledData.length; i += batchSize) {
			const batch = crawledData.slice(i, i + batchSize);

			for (const item of batch) {
				try {
					// Find or create location data
					const locationData = await findOrCreateLocation(
						item.full_address_normalized || {
							city: "Thành phố Hồ Chí Minh",
							district: "Quận 1",
							ward: null
						}
					);

					// Create building
					const buildingSlug = generateSlug(
						`${item.poster_full_name}-${locationData.district.name}`
					);

					let building = await prisma.building.findUnique({
						where: { slug: buildingSlug },
					});

					if (!building) {
						building = await prisma.building.create({
							data: {
								id: buildingSlug,
								slug: buildingSlug,
								ownerId: ownerId,
								name: `Nhà trọ ${item.poster_full_name}`,
								description: `Nhà trọ được quản lý bởi ${item.poster_full_name}`,
								addressLine1:
									item.full_address_normalized?.street_name || item.full_address,
								wardId: locationData.ward?.id,
								districtId: locationData.district.id,
								provinceId: locationData.province.id,
								latitude: item.coordinates?.latitude,
								longitude: item.coordinates?.longitude,
								isActive: true,
								isVerified: false,
							},
						});
					}

					// Create floor (default floor 1)
					let floor = await prisma.floor.findFirst({
						where: {
							buildingId: building.id,
							floorNumber: 1,
						},
					});

					if (!floor) {
						floor = await prisma.floor.create({
							data: {
								buildingId: building.id,
								floorNumber: 1,
								name: "Tầng 1",
							},
						});
					}

					// Create room
					const roomNumber = extractRoomNumber(item.full_address, item.title, building.id);
					const roomSlug = `${buildingSlug}-phong-${roomNumber}`;
					const roomType = determineRoomType(item.title, item.description);

					// Check if room already exists
					const existingRoom = await prisma.room.findUnique({
						where: { slug: roomSlug },
					});

					if (existingRoom) {
						console.log(`⚠️ Room ${roomSlug} đã tồn tại, bỏ qua...`);
						processedCount++;
						continue;
					}

					const room = await prisma.room.create({
						data: {
							id: roomSlug,
							slug: roomSlug,
							floorId: floor.id,
							roomNumber: roomNumber,
							name: item.title,
							description: item.detailed_description || item.description,
							roomType: roomType,
							maxOccupancy:
								roomType === "dormitory" ? 4 : roomType === "double" ? 2 : 1,
							isActive: true,
							isVerified: false,
						},
					});

					// Create room pricing - Fix price normalization
					const priceNumeric = item.official_price_normalized.price_numeric;
					// If price looks too small (< 100,000), it might be missing zeros
					const actualPrice = priceNumeric < 100000 && priceNumeric > 0 ? priceNumeric * 1000 : priceNumeric;
					
					await prisma.roomPricing.create({
						data: {
							roomId: room.id,
							basePriceMonthly: actualPrice,
							currency: item.official_price_normalized.currency,
							depositAmount: actualPrice, // Default 1 month deposit
							depositMonths: 1,
							utilityIncluded:
								item.description.toLowerCase().includes("bao điện") ||
								item.description.toLowerCase().includes("bao nước"),
							minimumStayMonths: 1,
							priceNegotiable:
								item.description.toLowerCase().includes("thương lượng") ||
								item.description.toLowerCase().includes("tl"),
						},
					});

					// Create room image
					if (item.image_url) {
						await prisma.roomImage.create({
							data: {
								roomId: room.id,
								imageUrl: item.image_url,
								altText: item.title,
								sortOrder: 0,
								isPrimary: true,
							},
						});
					}

					// Add basic amenities based on description
					const description = item.description.toLowerCase();
					const amenityMapping = [
						{
							keywords: ["máy lạnh", "điều hòa"],
							name: "Air Conditioning",
							nameEn: "air_conditioning",
							category: "basic",
						},
						{
							keywords: ["wifi", "internet"],
							name: "WiFi",
							nameEn: "wifi",
							category: "connectivity",
						},
						{
							keywords: ["bếp", "nấu ăn"],
							name: "Kitchen",
							nameEn: "kitchen",
							category: "kitchen",
						},
						{
							keywords: ["tủ lạnh"],
							name: "Refrigerator",
							nameEn: "refrigerator",
							category: "kitchen",
						},
						{
							keywords: ["giường"],
							name: "Bed",
							nameEn: "bed",
							category: "basic",
						},
						{
							keywords: ["tủ quần áo"],
							name: "Wardrobe",
							nameEn: "wardrobe",
							category: "basic",
						},
						{
							keywords: ["ban công"],
							name: "Balcony",
							nameEn: "balcony",
							category: "basic",
						},
						{
							keywords: ["thang máy"],
							name: "Elevator",
							nameEn: "elevator",
							category: "building",
						},
						{
							keywords: ["bảo vệ", "an ninh"],
							name: "Security",
							nameEn: "security",
							category: "safety",
						},
						{
							keywords: ["gác", "gác xép"],
							name: "Loft",
							nameEn: "loft",
							category: "basic",
						},
					];

					for (const amenity of amenityMapping) {
						if (
							amenity.keywords.some((keyword) => description.includes(keyword))
						) {
							// Find or create system amenity
							let systemAmenity = await prisma.systemAmenity.findUnique({
								where: { nameEn: amenity.nameEn },
							});

							if (!systemAmenity) {
								systemAmenity = await prisma.systemAmenity.create({
									data: {
										name: amenity.name,
										nameEn: amenity.nameEn,
										category: amenity.category as any,
										isActive: true,
									},
								});
							}

							// Add to room
							await prisma.roomAmenity
								.create({
									data: {
										roomId: room.id,
										systemAmenityId: systemAmenity.id,
									},
								})
								.catch(() => {}); // Ignore if already exists
						}
					}

					successCount++;
					console.log(`✅ Imported room: ${room.slug}`);
				} catch (error) {
					errorCount++;
					console.error(`❌ Error importing item ${item.id}:`, error);
				}

				processedCount++;

				if (processedCount % 50 === 0) {
					console.log(
						`📊 Progress: ${processedCount}/${crawledData.length} (${successCount} success, ${errorCount} errors)`
					);
				}
			}
		}

		console.log("\n🎉 Import completed!");
		console.log(`📊 Final stats:`);
		console.log(`   - Total processed: ${processedCount}`);
		console.log(`   - Successful: ${successCount}`);
		console.log(`   - Errors: ${errorCount}`);
		console.log(
			`   - Success rate: ${((successCount / processedCount) * 100).toFixed(
				2
			)}%`
		);
	} catch (error) {
		console.error("❌ Import failed:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Utility function to clean and validate JSON file
async function validateCrawledData(filePath: string) {
	console.log("🔍 Validating crawled data...");

	try {
		const rawData = fs.readFileSync(filePath, "utf-8");
		const data = JSON.parse(rawData);

		console.log(`📊 Total records: ${data.length}`);

		// Validate required fields
		const requiredFields = [
			"id",
			"title",
			"full_address",
			"coordinates",
			"official_price_normalized",
			"poster_full_name",
		];

		let validRecords = 0;
		let invalidRecords = 0;

		for (const item of data) {
			const missingFields = requiredFields.filter((field) => !item[field]);

			if (missingFields.length === 0) {
				validRecords++;
			} else {
				invalidRecords++;
				console.warn(`⚠️ Record ${item.id} missing fields:`, missingFields);
			}
		}

		console.log(`✅ Valid records: ${validRecords}`);
		console.log(`❌ Invalid records: ${invalidRecords}`);
		console.log(
			`📊 Validation rate: ${((validRecords / data.length) * 100).toFixed(2)}%`
		);

		return validRecords > 0;
	} catch (error) {
		console.error("❌ Validation failed:", error);
		return false;
	}
}

// Main execution
if (require.main === module) {
	const args = process.argv.slice(2);
	const command = args[0] || "import";
	const filePath = args[1] || join(process.cwd(), "data", "crawled_data.json");

	if (command === "validate") {
		validateCrawledData(filePath).catch(console.error);
	} else if (command === "import") {
		// Validate first, then import
		validateCrawledData(filePath)
			.then((isValid) => {
				if (isValid) {
					return importCrawledData(filePath);
				} else {
					console.error("❌ Data validation failed, stopping import");
					process.exit(1);
				}
			})
			.catch(console.error);
	} else {
		console.log("Usage:");
		console.log("  npx ts-node import-crawled.ts validate [file-path]");
		console.log("  npx ts-node import-crawled.ts import [file-path]");
	}
}

export { importCrawledData, validateCrawledData };
