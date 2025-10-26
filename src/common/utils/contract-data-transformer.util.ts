import * as crypto from 'crypto';
import { ContractData } from '../types/contract-metadata.types';

export interface DatabaseContract {
	id: string;
	contractCode: string;
	contractData: any;
	landlordId: string;
	tenantId: string;
	roomInstanceId: string;
	startDate: Date;
	endDate?: Date;
	signedAt?: Date;
	createdAt: Date;
	landlord: {
		firstName: string;
		lastName: string;
		phone: string;
		email?: string;
		idCardNumber?: string;
		idCardIssuedDate?: Date;
		idCardIssuedPlace?: string;
		addresses: Array<{
			addressLine1: string;
			addressLine2?: string;
			ward?: { name: string };
			district: { name: string };
			province: { name: string };
		}>;
	};
	tenant: {
		firstName: string;
		lastName: string;
		phone: string;
		email?: string;
		idCardNumber?: string;
		idCardIssuedDate?: Date;
		idCardIssuedPlace?: string;
		addresses: Array<{
			addressLine1: string;
			addressLine2?: string;
			ward?: { name: string };
			district: { name: string };
			province: { name: string };
		}>;
	};
	roomInstance: {
		roomNumber: string;
		room: {
			name: string;
			roomType: string;
			areaSqm?: any; // Prisma Decimal type
			amenities: Array<{
				amenity: {
					name: string;
					nameEn: string;
				};
				customValue?: string;
			}>;
			costs: Array<{
				costTypeTemplate: {
					name: string;
					nameEn: string;
				};
				baseRate?: any; // Prisma Decimal type
				unitPrice?: any; // Prisma Decimal type
				fixedAmount?: any; // Prisma Decimal type
				currency: string;
				unit?: string;
			}>;
			building: {
				name: string;
				addressLine1: string;
				addressLine2?: string;
				ward?: { name: string };
				district: { name: string };
				province: { name: string };
			};
		};
	};
	signatures?: Array<{
		signerId: string;
		signerRole: string;
		signatureImage: string;
		signedAt: Date;
	}>;
}

/**
 * Contract Data Transformer Utility
 * Transforms database contract data to PDF-ready format
 */

/**
 * Transform database contract to PDF contract data
 */
export function transformToPDFContract(dbContract: DatabaseContract): ContractData & {
	contractNumber: string;
	createdAt: Date;
	signedAt?: Date;
	verificationCode: string;
	signatures?: {
		landlord?: string;
		tenant?: string;
	};
} {
	// Get primary addresses
	const landlordAddress = getPrimaryAddress(dbContract.landlord.addresses);
	const tenantAddress = getPrimaryAddress(dbContract.tenant.addresses);
	const roomAddress = getRoomAddress(dbContract.roomInstance.room.building);

	// Transform signatures
	const signatures = transformSignatures(
		dbContract.signatures,
		dbContract.landlordId,
		dbContract.tenantId,
	);

	// Transform amenities
	const amenities = transformAmenities(dbContract.roomInstance.room.amenities);

	// Transform costs
	const costs = transformCosts(dbContract.roomInstance.room.costs);

	return {
		title: 'Hợp đồng thuê nhà trọ',
		description: `Hợp đồng thuê phòng ${dbContract.roomInstance.roomNumber} tại ${dbContract.roomInstance.room.building.name}`,

		parties: {
			landlord: {
				name: `${dbContract.landlord.firstName} ${dbContract.landlord.lastName}`,
				idNumber: dbContract.landlord.idCardNumber || '',
				idIssuedDate: dbContract.landlord.idCardIssuedDate || new Date(),
				idIssuedPlace: dbContract.landlord.idCardIssuedPlace || '',
				address: landlordAddress,
				phone: dbContract.landlord.phone,
				email: dbContract.landlord.email,
			},
			tenant: {
				name: `${dbContract.tenant.firstName} ${dbContract.tenant.lastName}`,
				idNumber: dbContract.tenant.idCardNumber || '',
				idIssuedDate: dbContract.tenant.idCardIssuedDate || new Date(),
				idIssuedPlace: dbContract.tenant.idCardIssuedPlace || '',
				address: tenantAddress,
				phone: dbContract.tenant.phone,
				email: dbContract.tenant.email,
			},
		},

		room: {
			buildingName: dbContract.roomInstance.room.building.name,
			roomNumber: dbContract.roomInstance.roomNumber,
			address: roomAddress,
			area: Number(dbContract.roomInstance.room.areaSqm) || 0,
			roomType: translateRoomType(dbContract.roomInstance.room.roomType),
			amenities: amenities,
		},

		financial: {
			monthlyRent: getMonthlyRent(dbContract.contractData),
			deposit: getDeposit(dbContract.contractData),
			depositMonths: getDepositMonths(dbContract.contractData),
			currency: 'VND',
			paymentMethod: getPaymentMethod(dbContract.contractData),
			paymentDueDate: getPaymentDueDate(dbContract.contractData),
			electricityPrice: getElectricityPrice(costs),
			waterPrice: getWaterPrice(costs),
			internetPrice: getInternetPrice(costs),
			parkingFee: getParkingFee(costs),
		},

		duration: {
			startDate: dbContract.startDate.toISOString().split('T')[0],
			endDate: dbContract.endDate?.toISOString().split('T')[0],
			rentalMonths: calculateRentalMonths(dbContract.startDate, dbContract.endDate),
			noticePeriod: 30,
		},

		terms: {
			utilities: ['Điện', 'Nước', 'Internet'],
			restrictions: ['Không hút thuốc', 'Không nuôi thú cưng'],
			rules: getContractRules(dbContract.contractData),
			responsibilities: {
				landlord: getLandlordResponsibilities(),
				tenant: getTenantResponsibilities(),
			},
		},

		contractNumber: dbContract.contractCode,
		createdAt: dbContract.createdAt,
		signedAt: dbContract.signedAt,
		verificationCode: generateVerificationCode(dbContract.id),
		signatures: signatures,
	};
}

/**
 * Get primary address from address array
 */
function getPrimaryAddress(addresses: Array<any>): string {
	if (!addresses || addresses.length === 0) {
		return '';
	}

	const primaryAddress = addresses.find((addr) => addr.isPrimary) || addresses[0];

	const parts = [
		primaryAddress.addressLine1,
		primaryAddress.addressLine2,
		primaryAddress.ward?.name,
		primaryAddress.district.name,
		primaryAddress.province.name,
	].filter(Boolean);

	return parts.join(', ');
}

/**
 * Get room address
 */
function getRoomAddress(building: any): string {
	const parts = [
		building.addressLine1,
		building.addressLine2,
		building.ward?.name,
		building.district.name,
		building.province.name,
	].filter(Boolean);

	return parts.join(', ');
}

/**
 * Transform signatures
 */
function transformSignatures(
	signatures: Array<any> | undefined,
	landlordId: string,
	tenantId: string,
): { landlord?: string; tenant?: string } | undefined {
	if (!signatures || signatures.length === 0) {
		return undefined;
	}

	const result: { landlord?: string; tenant?: string } = {};

	for (const signature of signatures) {
		if (signature.signerId === landlordId) {
			result.landlord = signature.signatureImage;
		} else if (signature.signerId === tenantId) {
			result.tenant = signature.signatureImage;
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Transform amenities
 */
function transformAmenities(amenities: Array<any>): string[] {
	if (!amenities || amenities.length === 0) {
		return [];
	}

	return amenities.map((amenity) => amenity.customValue || amenity.systemAmenity.name);
}

/**
 * Transform costs
 */
function transformCosts(costs: Array<any>): Array<any> {
	if (!costs || costs.length === 0) {
		return [];
	}

	return costs.map((cost) => ({
		name: cost.systemCostType.name,
		nameEn: cost.systemCostType.nameEn,
		baseRate: cost.baseRate,
		unitPrice: cost.unitPrice,
		fixedAmount: cost.fixedAmount,
		currency: cost.currency,
		unit: cost.unit,
	}));
}

/**
 * Translate room type to Vietnamese
 */
function translateRoomType(roomType: string): string {
	const translations: Record<string, string> = {
		boarding_house: 'Nhà trọ',
		dormitory: 'Ký túc xá',
		sleepbox: 'Sleepbox',
		apartment: 'Chung cư',
		whole_house: 'Nhà nguyên căn',
	};

	return translations[roomType] || roomType;
}

/**
 * Get monthly rent from contract data
 */
function getMonthlyRent(contractData: any): number {
	return contractData?.financial?.monthlyRent || 0;
}

/**
 * Get deposit amount
 */
function getDeposit(contractData: any): number {
	return contractData?.financial?.deposit || 0;
}

/**
 * Get deposit months
 */
function getDepositMonths(contractData: any): number {
	return contractData?.financial?.depositMonths || 1;
}

/**
 * Get payment method
 */
function getPaymentMethod(contractData: any): string {
	return contractData?.financial?.paymentMethod || 'Chuyển khoản ngân hàng';
}

/**
 * Get payment due date
 */
function getPaymentDueDate(contractData: any): number {
	return contractData?.financial?.paymentDueDate || 5;
}

/**
 * Get electricity price
 */
function getElectricityPrice(costs: Array<any>): number {
	const electricityCost = costs.find(
		(cost) =>
			cost.nameEn.toLowerCase().includes('electricity') ||
			cost.nameEn.toLowerCase().includes('điện'),
	);
	return electricityCost?.unitPrice || electricityCost?.baseRate || 0;
}

/**
 * Get water price
 */
function getWaterPrice(costs: Array<any>): number {
	const waterCost = costs.find(
		(cost) =>
			cost.nameEn.toLowerCase().includes('water') || cost.nameEn.toLowerCase().includes('nước'),
	);
	return waterCost?.unitPrice || waterCost?.baseRate || 0;
}

/**
 * Get internet price
 */
function getInternetPrice(costs: Array<any>): number {
	const internetCost = costs.find(
		(cost) =>
			cost.nameEn.toLowerCase().includes('internet') || cost.nameEn.toLowerCase().includes('wifi'),
	);
	return internetCost?.unitPrice || internetCost?.baseRate || 0;
}

/**
 * Get parking fee
 */
function getParkingFee(costs: Array<any>): number {
	const parkingCost = costs.find(
		(cost) =>
			cost.nameEn.toLowerCase().includes('parking') || cost.nameEn.toLowerCase().includes('gửi xe'),
	);
	return parkingCost?.unitPrice || parkingCost?.baseRate || 0;
}

/**
 * Calculate rental months
 */
function calculateRentalMonths(startDate: Date, endDate?: Date): number {
	if (!endDate) {
		return 12; // Default to 12 months
	}

	const start = new Date(startDate);
	const end = new Date(endDate);
	const diffTime = end.getTime() - start.getTime();
	const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

	return Math.max(1, diffMonths);
}

/**
 * Get contract rules
 */
function getContractRules(contractData: any): string[] {
	return (
		contractData?.terms?.rules || [
			'Không được hút thuốc trong phòng',
			'Không được nuôi thú cưng',
			'Giữ gìn vệ sinh chung',
			'Không được làm ồn sau 22h',
			'Báo trước khi có khách qua đêm',
		]
	);
}

/**
 * Get landlord responsibilities
 */
function getLandlordResponsibilities(): string[] {
	return [
		'Cung cấp phòng và trang thiết bị đúng thỏa thuận',
		'Đảm bảo cung cấp điện, nước liên tục',
		'Sửa chữa các hư hỏng không do lỗi của người thuê',
		'Hoàn trả tiền đặt cọc khi hết hạn hợp đồng',
	];
}

/**
 * Get tenant responsibilities
 */
function getTenantResponsibilities(): string[] {
	return [
		'Trả tiền thuê đầy đủ, đúng hạn',
		'Sử dụng phòng đúng mục đích',
		'Giữ gìn phòng và trang thiết bị',
		'Chấp hành nội quy nơi thuê trọ',
		'Báo trước 30 ngày nếu không tiếp tục thuê',
	];
}

/**
 * Generate verification code
 */
function generateVerificationCode(contractId: string): string {
	const hash = crypto.createHash('sha256').update(contractId).digest('hex');
	return hash.substring(0, 8).toUpperCase();
}
