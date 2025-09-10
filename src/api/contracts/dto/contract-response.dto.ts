import { ApiProperty } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export enum ContractStatus {
	DRAFT = 'draft',
	ACTIVE = 'active',
	PENDING_RENEWAL = 'pending_renewal',
	RENEWED = 'renewed',
	TERMINATED = 'terminated',
	EXPIRED = 'expired',
	BREACHED = 'breached',
	SUSPENDED = 'suspended',
}

export enum ContractEventType {
	CREATED = 'created',
	ACTIVATED = 'activated',
	PAYMENT_RECEIVED = 'payment_received',
	PAYMENT_OVERDUE = 'payment_overdue',
	RENEWAL_REQUESTED = 'renewal_requested',
	AMENDMENT_ADDED = 'amendment_added',
	TERMINATED = 'terminated',
	EXPIRED = 'expired',
}

export class ContractPartyDto {
	@ApiProperty({ description: 'ID của bên tham gia' })
	id: string;

	@ApiProperty({ description: 'Tên đầy đủ' })
	fullName: string;

	@ApiProperty({ description: 'Email' })
	email: string;

	@ApiProperty({ description: 'Số điện thoại' })
	phone?: string;

	@ApiProperty({ description: 'Số CMND/CCCD' })
	idCardNumber?: string;
}

export class ContractPropertyDto {
	@ApiProperty({ description: 'ID phòng' })
	roomId: string;

	@ApiProperty({ description: 'Tên phòng' })
	roomName: string;

	@ApiProperty({ description: 'Số phòng' })
	roomNumber: string;

	@ApiProperty({ description: 'Loại phòng' })
	roomType: RoomType;

	@ApiProperty({ description: 'Diện tích (m²)' })
	areaSqm?: Decimal;

	@ApiProperty({ description: 'Địa chỉ đầy đủ' })
	fullAddress: string;

	@ApiProperty({ description: 'Tên tòa nhà' })
	buildingName: string;
}

export class ContractFinancialTermsDto {
	@ApiProperty({ description: 'Tiền thuê hàng tháng' })
	monthlyRent: Decimal;

	@ApiProperty({ description: 'Tiền đặt cọc' })
	depositAmount: Decimal;

	@ApiProperty({ description: 'Loại tiền tệ' })
	currency: string;

	@ApiProperty({ description: 'Tiền điện (VND/kWh)' })
	electricityRate?: Decimal;

	@ApiProperty({ description: 'Tiền nước (VND/m³)' })
	waterRate?: Decimal;

	@ApiProperty({ description: 'Chi phí dịch vụ khác' })
	otherFees?: Record<string, number>;
}

export class ContractAmendmentDto {
	@ApiProperty({ description: 'ID sửa đổi' })
	id: string;

	@ApiProperty({ description: 'Loại sửa đổi' })
	amendmentType: string;

	@ApiProperty({ description: 'Nội dung sửa đổi' })
	description: string;

	@ApiProperty({ description: 'Dữ liệu thay đổi' })
	changes: Record<string, any>;

	@ApiProperty({ description: 'Người thực hiện' })
	amendedBy: string;

	@ApiProperty({ description: 'Ngày thực hiện' })
	amendedAt: Date;

	@ApiProperty({ description: 'Ghi chú' })
	notes?: string;
}

export class ContractEventDto {
	@ApiProperty({ description: 'ID sự kiện' })
	id: string;

	@ApiProperty({ enum: ContractEventType, description: 'Loại sự kiện' })
	eventType: ContractEventType;

	@ApiProperty({ description: 'Mô tả sự kiện' })
	description: string;

	@ApiProperty({ description: 'Dữ liệu sự kiện' })
	eventData?: Record<string, any>;

	@ApiProperty({ description: 'Người tạo sự kiện' })
	triggeredBy?: string;

	@ApiProperty({ description: 'Thời gian xảy ra' })
	occurredAt: Date;
}

export class ContractResponseDto {
	@ApiProperty({ description: 'ID hợp đồng' })
	id: string;

	@ApiProperty({ description: 'Số hợp đồng' })
	contractNumber: string;

	@ApiProperty({ description: 'ID rental liên kết' })
	rentalId: string;

	@ApiProperty({ enum: ContractStatus, description: 'Trạng thái hợp đồng' })
	status: ContractStatus;

	@ApiProperty({ description: 'Ngày bắt đầu hợp đồng' })
	startDate: Date;

	@ApiProperty({ description: 'Ngày kết thúc hợp đồng' })
	endDate?: Date;

	@ApiProperty({ description: 'Thời gian thuê (tháng)' })
	leaseDurationMonths?: number;

	@ApiProperty({ type: ContractPartyDto, description: 'Thông tin chủ nhà' })
	landlord: ContractPartyDto;

	@ApiProperty({ type: ContractPartyDto, description: 'Thông tin khách thuê' })
	tenant: ContractPartyDto;

	@ApiProperty({ type: ContractPropertyDto, description: 'Thông tin bất động sản' })
	property: ContractPropertyDto;

	@ApiProperty({ type: ContractFinancialTermsDto, description: 'Điều khoản tài chính' })
	financialTerms: ContractFinancialTermsDto;

	@ApiProperty({ description: 'Các quy định của phòng' })
	rules: string[];

	@ApiProperty({ description: 'Các tiện ích có sẵn' })
	amenities: string[];

	@ApiProperty({ description: 'URL tài liệu hợp đồng' })
	documentUrl?: string;

	@ApiProperty({ description: 'Nội dung hợp đồng (HTML)' })
	contractContent?: string;

	@ApiProperty({ type: [ContractAmendmentDto], description: 'Lịch sử sửa đổi' })
	amendments: ContractAmendmentDto[];

	@ApiProperty({ type: [ContractEventDto], description: 'Lịch sử sự kiện' })
	events: ContractEventDto[];

	@ApiProperty({ description: 'Ngày tạo' })
	createdAt: Date;

	@ApiProperty({ description: 'Ngày cập nhật' })
	updatedAt: Date;

	@ApiProperty({ description: 'Ghi chú bổ sung' })
	notes?: string;
}
