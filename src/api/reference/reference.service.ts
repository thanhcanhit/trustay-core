import { Injectable } from '@nestjs/common';
import {
	AmenityCategory,
	BillStatus,
	BookingStatus,
	CostCategory,
	Gender,
	InvitationStatus,
	PaymentMethod,
	PaymentStatus,
	PaymentType,
	RentalStatus,
	ReviewerType,
	RoomType,
	SearchPostStatus,
	UserRole,
	VerificationStatus,
	VerificationType,
	Visibility,
} from '@prisma/client';
import { calculatePagination, PaginatedResponseDto, PaginationQueryDto } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AllEnumsResponseDto, EnumValueDto, SystemAmenityDto, SystemCostTypeDto } from './dto';

@Injectable()
export class ReferenceService {
	constructor(private readonly prisma: PrismaService) {}

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
	}

	getAllEnums(): AllEnumsResponseDto {
		return {
			roomTypes: this.mapEnumToDto(RoomType, {
				single: 'Phòng đơn',
				double: 'Phòng đôi',
				suite: 'Phòng suite',
				dormitory: 'Phòng tập thể',
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
		};
	}

	private mapEnumToDto(enumObject: any, labels: Record<string, string>): EnumValueDto[] {
		return Object.values(enumObject).map((value) => ({
			key: value as string,
			value: labels[value as string] || (value as string),
			description: labels[value as string],
		}));
	}
}
