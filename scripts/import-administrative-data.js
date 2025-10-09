const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function importVietnameseAdministrativeData() {
	console.log('🚀 Bắt đầu import dữ liệu hành chính Việt Nam...');

	try {
		// Check if administrative data already exists
		const existingProvinces = await prisma.province.count();
		if (existingProvinces > 0) {
			console.log(
				`⏭️ Administrative data already exists (${existingProvinces} provinces). Skipping import.`,
			);
			console.log('✅ Administrative data import completed (data exists)\n');
			return;
		}

		const workbook = XLSX.readFile(path.join(__dirname, 'data', 'data.xlsx'));
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];
		const data = XLSX.utils.sheet_to_json(sheet);

		console.log(`📊 Tổng số dòng dữ liệu: ${data.length}`);

		// Tạo Map để lưu trữ unique provinces và districts
		const provinces = new Map();
		const districts = new Map();

		// Extract unique provinces và districts
		console.log('🔍 Phân tích dữ liệu provinces và districts...');
		for (const row of data) {
			// Province
			if (row['Mã TP'] && row['Tỉnh Thành Phố'] && !provinces.has(row['Mã TP'])) {
				provinces.set(row['Mã TP'], {
					code: row['Mã TP'],
					name: row['Tỉnh Thành Phố'],
				});
			}

			// District
			if (row['Mã QH'] && row['Quận Huyện'] && !districts.has(row['Mã QH'])) {
				districts.set(row['Mã QH'], {
					code: row['Mã QH'],
					name: row['Quận Huyện'],
					provinceCode: row['Mã TP'],
				});
			}
		}

		console.log(`📍 Tìm thấy ${provinces.size} tỉnh/thành phố`);
		console.log(`🏘️ Tìm thấy ${districts.size} quận/huyện`);
		console.log(`🏠 Sẽ import ${data.length} phường/xã`);

		// Import Provinces
		console.log('📍 Đang import provinces...');
		let provinceCount = 0;
		for (const [code, province] of provinces) {
			try {
				await prisma.province.upsert({
					where: { code: province.code },
					update: {
						name: province.name,
					},
					create: {
						code: province.code,
						name: province.name,
					},
				});
				provinceCount++;

				if (provinceCount % 10 === 0) {
					console.log(`   Đã import ${provinceCount}/${provinces.size} provinces...`);
				}
			} catch (error) {
				console.error(`❌ Lỗi khi import province ${province.name}:`, error);
			}
		}
		console.log(`✅ Hoàn thành import ${provinceCount} provinces`);

		// Import Districts
		console.log('🏘️ Đang import districts...');
		let districtCount = 0;
		for (const [code, district] of districts) {
			try {
				const province = await prisma.province.findUnique({
					where: { code: district.provinceCode },
				});

				if (province) {
					await prisma.district.upsert({
						where: { code: district.code },
						update: {
							name: district.name,
							// Ensure district is under the correct province on updates
							provinceId: province.id,
						},
						create: {
							code: district.code,
							name: district.name,
							provinceId: province.id,
						},
					});
					districtCount++;

					if (districtCount % 50 === 0) {
						console.log(`   Đã import ${districtCount}/${districts.size} districts...`);
					}
				} else {
					console.warn(
						`⚠️ Không tìm thấy province cho district: ${district.name} (${district.provinceCode})`,
					);
				}
			} catch (error) {
				console.error(`❌ Lỗi khi import district ${district.name}:`, error);
			}
		}
		console.log(`✅ Hoàn thành import ${districtCount} districts`);

		// Import Wards
		console.log('🏠 Đang import wards...');
		let wardCount = 0;
		const batchSize = 100; // Process in batches for better performance

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);

			for (const row of batch) {
				if (row['Mã PX'] && row['Phường Xã']) {
					try {
						const district = await prisma.district.findUnique({
							where: { code: row['Mã QH'] },
						});

						if (district) {
							await prisma.ward.upsert({
								where: { code: row['Mã PX'] },
								update: {
									name: row['Phường Xã'],
									level: row['Cấp'] || 'Xã',
									// Ensure ward is under the correct district on updates
									districtId: district.id,
								},
								create: {
									code: row['Mã PX'],
									name: row['Phường Xã'],
									level: row['Cấp'] || 'Xã',
									districtId: district.id,
								},
							});
							wardCount++;
						} else {
							console.warn(
								`⚠️ Không tìm thấy district cho ward: ${row['Phường Xã']} (${row['Mã QH']})`,
							);
						}
					} catch (error) {
						console.error(`❌ Lỗi khi import ward ${row['Phường Xã']}:`, error);
					}
				}
			}

			// Progress update
			console.log(`   Đã xử lý ${Math.min(i + batchSize, data.length)}/${data.length} wards...`);
		}

		console.log(`✅ Hoàn thành import ${wardCount} wards`);
		console.log('🎉 Import dữ liệu hành chính hoàn tất!');

		// Summary
		console.log('\n📊 Tóm tắt:');
		console.log(`   - Provinces: ${provinceCount}`);
		console.log(`   - Districts: ${districtCount}`);
		console.log(`   - Wards: ${wardCount}`);
	} catch (error) {
		console.error('❌ Import thất bại:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Function để kiểm tra dữ liệu trước khi import
async function validateDataBeforeImport() {
	console.log('🔍 Kiểm tra dữ liệu trước khi import...');

	try {
		const workbook = XLSX.readFile(path.join(__dirname, 'data', 'data.xlsx'));
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];
		const data = XLSX.utils.sheet_to_json(sheet);

		console.log(`📊 Tổng số dòng: ${data.length}`);

		// Kiểm tra các cột bắt buộc
		const requiredColumns = [
			'Tỉnh Thành Phố',
			'Mã TP',
			'Quận Huyện',
			'Mã QH',
			'Phường Xã',
			'Mã PX',
			'Cấp',
		];
		const actualColumns = Object.keys(data[0] || {});

		console.log('📋 Các cột có sẵn:', actualColumns);

		const missingColumns = requiredColumns.filter((col) => !actualColumns.includes(col));
		if (missingColumns.length > 0) {
			console.error('❌ Thiếu các cột:', missingColumns);
			return false;
		}

		// Kiểm tra dữ liệu mẫu
		console.log('📝 Dữ liệu mẫu:');
		console.log(JSON.stringify(data[0], null, 2));

		// Count unique values
		const uniqueProvinces = new Set(data.map((row) => row['Mã TP'])).size;
		const uniqueDistricts = new Set(data.map((row) => row['Mã QH'])).size;
		const uniqueWards = new Set(data.map((row) => row['Mã PX'])).size;

		console.log('\n📊 Thống kê:');
		console.log(`   - Provinces: ${uniqueProvinces}`);
		console.log(`   - Districts: ${uniqueDistricts}`);
		console.log(`   - Wards: ${uniqueWards}`);

		// Kiểm tra duplicate codes
		const wardCodes = data.map((row) => row['Mã PX']);
		const duplicateWards = wardCodes.filter((code, index) => wardCodes.indexOf(code) !== index);
		if (duplicateWards.length > 0) {
			console.warn(`⚠️ Phát hiện ${duplicateWards.length} mã ward trùng lặp`);
		}

		console.log('✅ Dữ liệu hợp lệ, sẵn sàng import!');
		return true;
	} catch (error) {
		console.error('❌ Lỗi khi kiểm tra dữ liệu:', error);
		return false;
	}
}

// Main execution
if (require.main === module) {
	const args = process.argv.slice(2);
	const command = args[0] || 'import';

	if (command === 'validate') {
		validateDataBeforeImport().catch(console.error);
	} else {
		// Validate first, then import
		validateDataBeforeImport()
			.then((isValid) => {
				if (isValid) {
					return importVietnameseAdministrativeData();
				} else {
					console.error('❌ Dữ liệu không hợp lệ, dừng import');
					process.exit(1);
				}
			})
			.catch(console.error);
	}
}

module.exports = { importVietnameseAdministrativeData, validateDataBeforeImport };
