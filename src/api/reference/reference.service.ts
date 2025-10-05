import { Injectable } from '@nestjs/common';
import {
	AmenityCategory,
	BillingCycle,
	BillStatus,
	BookingStatus,
	CostCategory,
	CostType,
	Gender,
	InvitationStatus,
	PaymentMethod,
	PaymentStatus,
	PaymentType,
	RentalStatus,
	ReviewerType,
	RoomType,
	RuleCategory,
	RuleType,
	SearchPostStatus,
	UserRole,
	VerificationStatus,
	VerificationType,
	Visibility,
} from '@prisma/client';
import { CACHE_KEYS, CACHE_TTL } from '../../cache/constants';
import { CacheService } from '../../cache/services/cache.service';
import { calculatePagination, PaginatedResponseDto, PaginationQueryDto } from '../../common/dto';
import { uppercaseArray } from '../../common/utils/enum.utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
	AllEnumsResponseDto,
	EnumValueDto,
	EnumValuesDto,
	SimpleAmenityDto,
	SimpleCostTypeDto,
	SimpleRuleDto,
	SystemAmenityDto,
	SystemCostTypeDto,
	SystemRoomRuleDto,
} from './dto';

@Injectable()
export class ReferenceService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cacheService: CacheService,
	) {}

	async getSystemAmenities(
		query?: PaginationQueryDto,
	): Promise<PaginatedResponseDto<SystemAmenityDto>> {
		const { page = 1, limit = 100, search, sortBy = 'sortOrder', sortOrder = 'asc' } = query || {};
		const { skip, take } = calculatePagination(page, limit);

		const where: any = {
			isActive: true,
		};

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ nameEn: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [amenities, total] = await Promise.all([
			this.prisma.systemAmenity.findMany({
				where,
				skip,
				take,
				orderBy,
			}),
			this.prisma.systemAmenity.count({ where }),
		]);

		return PaginatedResponseDto.create(amenities, page, limit, total);
	}

	async getSystemAmenitiesByCategory(category?: AmenityCategory): Promise<SystemAmenityDto[]> {
		const cacheKey = category
			? `${CACHE_KEYS.SYSTEM_AMENITIES}:${category}`
			: CACHE_KEYS.SYSTEM_AMENITIES;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const where: any = {
					isActive: true,
				};

				if (category) {
					where.category = category;
				}

				return this.prisma.systemAmenity.findMany({
					where,
					orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
				});
			},
			CACHE_TTL.SYSTEM_DATA,
		);
	}

	async getSystemCostTypes(
		query?: PaginationQueryDto,
	): Promise<PaginatedResponseDto<SystemCostTypeDto>> {
		const { page = 1, limit = 100, search, sortBy = 'sortOrder', sortOrder = 'asc' } = query || {};
		const { skip, take } = calculatePagination(page, limit);

		const where: any = {
			isActive: true,
		};

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ nameEn: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [costTypes, total] = await Promise.all([
			this.prisma.systemCostType.findMany({
				where,
				skip,
				take,
				orderBy,
			}),
			this.prisma.systemCostType.count({ where }),
		]);

		return PaginatedResponseDto.create(costTypes, page, limit, total);
	}

	async getSystemCostTypesByCategory(category?: CostCategory): Promise<SystemCostTypeDto[]> {
		const cacheKey = category
			? `${CACHE_KEYS.SYSTEM_COST_TYPES}:${category}`
			: CACHE_KEYS.SYSTEM_COST_TYPES;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const where: any = {
					isActive: true,
				};

				if (category) {
					where.category = category;
				}

				return this.prisma.systemCostType.findMany({
					where,
					orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
				});
			},
			CACHE_TTL.SYSTEM_DATA,
		);
	}

	async getSystemRoomRules(
		query?: PaginationQueryDto,
	): Promise<PaginatedResponseDto<SystemRoomRuleDto>> {
		const { page = 1, limit = 100, search, sortBy = 'sortOrder', sortOrder = 'asc' } = query || {};
		const { skip, take } = calculatePagination(page, limit);

		const where: any = {
			isActive: true,
		};

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ nameEn: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}

		const orderBy: any = {};
		orderBy[sortBy] = sortOrder;

		const [roomRules, total] = await Promise.all([
			this.prisma.systemRoomRule.findMany({
				where,
				skip,
				take,
				orderBy,
			}),
			this.prisma.systemRoomRule.count({ where }),
		]);

		return PaginatedResponseDto.create(roomRules, page, limit, total);
	}

	async getSystemRoomRulesByCategory(category?: RuleCategory): Promise<SystemRoomRuleDto[]> {
		const cacheKey = category
			? `${CACHE_KEYS.SYSTEM_ROOM_RULES}:${category}`
			: CACHE_KEYS.SYSTEM_ROOM_RULES;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const where: any = {
					isActive: true,
				};

				if (category) {
					where.category = category;
				}

				return this.prisma.systemRoomRule.findMany({
					where,
					orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
				});
			},
			CACHE_TTL.SYSTEM_DATA,
		);
	}

	getAllEnums(): AllEnumsResponseDto {
		return {
			roomTypes: this.mapEnumToDto(RoomType, {
				boarding_house: 'Nhà trọ',
				dormitory: 'Ký túc xá',
				sleepbox: 'Sleepbox',
				apartment: 'Chung cư',
				whole_house: 'Nhà nguyên căn',
			}),
			genders: this.mapEnumToDto(Gender, {
				male: 'Nam',
				female: 'Nữ',
				other: 'Khác',
			}),
			userRoles: this.mapEnumToDto(UserRole, {
				tenant: 'Người thuê',
				landlord: 'Chủ nhà',
			}),
			bookingStatuses: this.mapEnumToDto(BookingStatus, {
				pending: 'Chờ xử lý',
				approved: 'Đã chấp nhận',
				rejected: 'Bị từ chối',
				cancelled: 'Đã hủy',
			}),
			rentalStatuses: this.mapEnumToDto(RentalStatus, {
				active: 'Đang hoạt động',
				terminated: 'Đã kết thúc',
				expired: 'Đã hết hạn',
				pending_renewal: 'Chờ gia hạn',
			}),
			invitationStatuses: this.mapEnumToDto(InvitationStatus, {
				pending: 'Chờ phản hồi',
				accepted: 'Đã chấp nhận',
				declined: 'Đã từ chối',
				expired: 'Đã hết hạn',
			}),
			billStatuses: this.mapEnumToDto(BillStatus, {
				draft: 'Bản nháp',
				pending: 'Chờ thanh toán',
				paid: 'Đã thanh toán',
				overdue: 'Quá hạn',
				cancelled: 'Đã hủy',
			}),
			paymentTypes: this.mapEnumToDto(PaymentType, {
				rent: 'Tiền thuê',
				deposit: 'Tiền cọc',
				utility: 'Tiền điện nước',
				fee: 'Phí dịch vụ',
				refund: 'Hoàn tiền',
			}),
			paymentMethods: this.mapEnumToDto(PaymentMethod, {
				bank_transfer: 'Chuyển khoản ngân hàng',
				cash: 'Tiền mặt',
				e_wallet: 'Ví điện tử',
				card: 'Thẻ tín dụng',
			}),
			paymentStatuses: this.mapEnumToDto(PaymentStatus, {
				pending: 'Chờ xử lý',
				completed: 'Hoàn thành',
				failed: 'Thất bại',
				refunded: 'Đã hoàn tiền',
			}),
			reviewerTypes: this.mapEnumToDto(ReviewerType, {
				tenant: 'Người thuê',
				owner: 'Chủ nhà',
			}),
			amenityCategories: this.mapEnumToDto(AmenityCategory, {
				basic: 'Tiện ích cơ bản',
				kitchen: 'Nhà bếp',
				bathroom: 'Phòng tắm',
				entertainment: 'Giải trí',
				safety: 'An toàn',
				connectivity: 'Kết nối',
				building: 'Tòa nhà',
			}),
			costCategories: this.mapEnumToDto(CostCategory, {
				utility: 'Tiện ích',
				service: 'Dịch vụ',
				parking: 'Gửi xe',
				maintenance: 'Bảo trì',
			}),
			visibilityOptions: this.mapEnumToDto(Visibility, {
				anyoneCanFind: 'Mọi người có thể tìm thấy',
				anyoneWithLink: 'Mọi người có link',
				domainCanFind: 'Người trong domain có thể tìm',
				domainWithLink: 'Người trong domain có link',
				limited: 'Giới hạn',
			}),
			searchPostStatuses: this.mapEnumToDto(SearchPostStatus, {
				active: 'Đang hoạt động',
				paused: 'Tạm dừng',
				closed: 'Đã đóng',
				expired: 'Đã hết hạn',
			}),
			verificationTypes: this.mapEnumToDto(VerificationType, {
				email: 'Email',
				phone: 'Số điện thoại',
				password_reset: 'Đặt lại mật khẩu',
			}),
			verificationStatuses: this.mapEnumToDto(VerificationStatus, {
				pending: 'Chờ xác thực',
				verified: 'Đã xác thực',
				expired: 'Đã hết hạn',
				failed: 'Thất bại',
			}),
			costTypes: this.mapEnumToDto(CostType, {
				fixed: 'Giá cố định',
				per_unit: 'Theo đơn vị',
				metered: 'Theo đồng hồ',
				percentage: 'Theo phần trăm',
				tiered: 'Bậc thang',
			}),
			billingCycles: this.mapEnumToDto(BillingCycle, {
				daily: 'Hàng ngày',
				weekly: 'Hàng tuần',
				monthly: 'Hàng tháng',
				quarterly: 'Hàng quý',
				yearly: 'Hàng năm',
				per_use: 'Theo lần sử dụng',
			}),
			ruleCategories: this.mapEnumToDto(RuleCategory, {
				smoking: 'Hút thuốc',
				pets: 'Thú cưng',
				visitors: 'Khách thăm',
				noise: 'Tiếng ồn',
				cleanliness: 'Vệ sinh',
				security: 'An ninh',
				usage: 'Sử dụng',
				other: 'Khác',
			}),
		};
	}

	getEnums(): EnumValuesDto {
		return {
			gender: uppercaseArray(Gender),
			userRole: uppercaseArray(UserRole),
			roomType: uppercaseArray(RoomType),
			bookingStatus: uppercaseArray(BookingStatus),
			rentalStatus: uppercaseArray(RentalStatus),
			invitationStatus: uppercaseArray(InvitationStatus),
			billStatus: uppercaseArray(BillStatus),
			paymentType: uppercaseArray(PaymentType),
			paymentMethod: uppercaseArray(PaymentMethod),
			paymentStatus: uppercaseArray(PaymentStatus),
			reviewerType: uppercaseArray(ReviewerType),
			amenityCategory: uppercaseArray(AmenityCategory),
			costCategory: uppercaseArray(CostCategory),
			ruleCategory: uppercaseArray(RuleCategory),
			ruleType: uppercaseArray(RuleType),
			costType: uppercaseArray(CostType),
			billingCycle: uppercaseArray(BillingCycle),
			visibility: uppercaseArray(Visibility),
			searchPostStatus: uppercaseArray(SearchPostStatus),
			verificationType: uppercaseArray(VerificationType),
			verificationStatus: uppercaseArray(VerificationStatus),
		};
	}

	async getAmenities(category?: string): Promise<SimpleAmenityDto[]> {
		const cacheKey = category
			? `${CACHE_KEYS.SYSTEM_AMENITIES}:simple:${category}`
			: `${CACHE_KEYS.SYSTEM_AMENITIES}:simple`;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const where: any = { isActive: true };
				if (category) {
					where.category = category;
				}

				return this.prisma.systemAmenity.findMany({
					where,
					orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
					select: {
						id: true,
						name: true,
						category: true,
						description: true,
					},
				});
			},
			CACHE_TTL.SYSTEM_DATA,
		);
	}

	async getCostTypes(category?: string): Promise<SimpleCostTypeDto[]> {
		const cacheKey = category
			? `${CACHE_KEYS.SYSTEM_COST_TYPES}:simple:${category}`
			: `${CACHE_KEYS.SYSTEM_COST_TYPES}:simple`;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const where: any = { isActive: true };
				if (category) {
					where.category = category;
				}

				return this.prisma.systemCostType.findMany({
					where,
					orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
					select: {
						id: true,
						name: true,
						category: true,
						defaultUnit: true,
					},
				});
			},
			CACHE_TTL.SYSTEM_DATA,
		);
	}

	async getRules(category?: string): Promise<SimpleRuleDto[]> {
		const cacheKey = category
			? `${CACHE_KEYS.SYSTEM_ROOM_RULES}:simple:${category}`
			: `${CACHE_KEYS.SYSTEM_ROOM_RULES}:simple`;

		return this.cacheService.wrap(
			cacheKey,
			async () => {
				const where: any = { isActive: true };
				if (category) {
					where.category = category;
				}

				return this.prisma.systemRoomRule.findMany({
					where,
					orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
					select: {
						id: true,
						name: true,
						category: true,
						ruleType: true,
						description: true,
					},
				});
			},
			CACHE_TTL.SYSTEM_DATA,
		);
	}

	private mapEnumToDto(enumObject: any, labels: Record<string, string>): EnumValueDto[] {
		return Object.values(enumObject).map((value) => ({
			key: value as string,
			value: labels[value as string] || (value as string),
			description: labels[value as string],
		}));
	}
}
