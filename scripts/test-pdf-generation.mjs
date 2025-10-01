#!/usr/bin/env node

/**
 * PDF Generation Test Script (ESM)
 *
 * Run with: node scripts/test-pdf-generation.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import pdfModule from '../dist/common/services/pdf-generation.service.js';

const { PDFGenerationService } = pdfModule;

async function runPDFTest() {
	try {
		console.log('🚀 Starting PDF generation test...');
		console.log('📝 Note: This test requires the application to be built first');
		console.log('   Run: npm run build');
		console.log('');

		if (!PDFGenerationService) {
			console.error('❌ PDFGenerationService not found. Please build the application first:');
			console.error('   npm run build');
			process.exit(1);
		}

		const pdfService = new PDFGenerationService();

		const mockContractData = {
			title: 'Hợp đồng thuê nhà trọ',
			description: 'Hợp đồng thuê phòng A101 tại Chung cư ABC',
			contractNumber: 'HD-2025-TEST-001',
			createdAt: new Date(),
			verificationCode: 'VERIFY-123456',
			parties: {
				landlord: {
					name: 'Nguyễn Văn A',
					idNumber: '123456789012',
					idIssuedDate: new Date('2020-01-15'),
					idIssuedPlace: 'Công an TP.HCM',
					address: '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
					phone: '0901234567',
					email: 'landlord@example.com',
				},
				tenant: {
					name: 'Trần Thị B',
					idNumber: '987654321098',
					idIssuedDate: new Date('2019-05-20'),
					idIssuedPlace: 'Công an Hà Nội',
					address: '456 Đường Kim Mã, Phường Kim Mã, Quận Ba Đình, Hà Nội',
					phone: '0987654321',
					email: 'tenant@example.com',
				},
			},
			room: {
				buildingName: 'Chung cư ABC',
				roomNumber: 'A101',
				address: '789 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
				area: 25.5,
				roomType: 'Phòng đơn',
				amenities: ['Điều hòa', 'WiFi', 'Tủ lạnh', 'Máy nước nóng'],
			},
			financial: {
				monthlyRent: 5000000,
				deposit: 10000000,
				depositMonths: 2,
				currency: 'VND',
				paymentMethod: 'Chuyển khoản ngân hàng',
				paymentDueDate: 5,
				electricityPrice: 4000,
				waterPrice: 25000,
				internetPrice: 200000,
				parkingFee: 100000,
			},
			duration: {
				startDate: '2025-01-01',
				endDate: '2025-12-31',
				rentalMonths: 12,
				noticePeriod: 30,
			},
			terms: {
				utilities: ['Điện', 'Nước', 'Internet'],
				restrictions: ['Không hút thuốc', 'Không nuôi thú cưng'],
				rules: [
					'Không được hút thuốc trong phòng',
					'Không được nuôi thú cưng',
					'Giữ gìn vệ sinh chung',
					'Không được làm ồn sau 22h',
				],
				responsibilities: {
					landlord: [
						'Cung cấp phòng ở đúng tiêu chuẩn',
						'Bảo trì các thiết bị trong phòng',
						'Đảm bảo an ninh chung cư',
					],
					tenant: ['Thanh toán đúng hạn', 'Giữ gìn tài sản', 'Tuân thủ nội quy chung cư'],
				},
			},
		};

		console.log('📄 Generating PDF...');
		const pdfResult = await pdfService.generateContractPDF(mockContractData, {
			format: 'A4',
			margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
			printBackground: true,
		});

		const outputPath = path.join(process.cwd(), 'test-contract.pdf');
		fs.writeFileSync(outputPath, pdfResult.buffer);

		console.log('✅ PDF generated successfully!');
		console.log(`📁 File saved to: ${outputPath}`);
		console.log(`📊 File size: ${pdfResult.size} bytes`);
		console.log(`🔐 Hash: ${pdfResult.hash}`);
		console.log(`📄 Pages: ${pdfResult.metadata.pageCount}`);
		console.log('');
		console.log('🎉 Test completed successfully!');
	} catch (error) {
		console.error('❌ PDF generation failed:', error.message);
		console.error('');
		console.error('💡 Troubleshooting tips:');
		console.error('   1. Make sure the application is built: npm run build');
		console.error('   2. Check if Puppeteer is installed: npm list puppeteer');
		console.error('   3. Verify all dependencies are installed: npm install');
		console.error('');
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runPDFTest();
}

export { runPDFTest };


