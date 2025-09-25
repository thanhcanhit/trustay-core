import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, RoommatePostStatus } from '@prisma/client';

export class RoommateSeekingPostResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	title: string;

	@ApiProperty()
	description: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	tenantId: string;

	@ApiPropertyOptional()
	roomInstanceId?: string;

	@ApiPropertyOptional()
	rentalId?: string;

	@ApiPropertyOptional()
	externalAddress?: string;

	@ApiPropertyOptional()
	externalProvinceId?: number;

	@ApiPropertyOptional()
	externalDistrictId?: number;

	@ApiPropertyOptional()
	externalWardId?: number;

	@ApiProperty()
	monthlyRent: number;

	@ApiProperty()
	currency: string;

	@ApiProperty()
	depositAmount: number;

	@ApiPropertyOptional()
	utilityCostPerPerson?: number;

	@ApiProperty()
	seekingCount: number;

	@ApiProperty()
	approvedCount: number;

	@ApiProperty()
	remainingSlots: number;

	@ApiProperty()
	maxOccupancy: number;

	@ApiProperty()
	currentOccupancy: number;

	@ApiPropertyOptional({ enum: Gender })
	preferredGender?: Gender;

	@ApiPropertyOptional()
	additionalRequirements?: string;

	@ApiProperty()
	availableFromDate: string;

	@ApiProperty()
	minimumStayMonths: number;

	@ApiPropertyOptional()
	maximumStayMonths?: number;

	@ApiProperty({ enum: RoommatePostStatus })
	status: RoommatePostStatus;

	@ApiProperty()
	requiresLandlordApproval: boolean;

	@ApiPropertyOptional()
	isApprovedByLandlord?: boolean;

	@ApiPropertyOptional()
	landlordNotes?: string;

	@ApiProperty()
	isActive: boolean;

	@ApiPropertyOptional()
	expiresAt?: string;

	@ApiProperty()
	viewCount: number;

	@ApiProperty()
	contactCount: number;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	// Nested relations
	@ApiPropertyOptional()
	tenant?: {
		id: string;
		firstName: string;
		lastName: string;
		avatarUrl?: string;
		phoneNumber?: string;
	};

	@ApiPropertyOptional()
	roomInstance?: {
		id: string;
		roomNumber: string;
		room: {
			id: string;
			name: string;
			building: {
				id: string;
				name: string;
				address: string;
			};
		};
	};

	@ApiPropertyOptional()
	externalProvince?: {
		id: number;
		name: string;
	};

	@ApiPropertyOptional()
	externalDistrict?: {
		id: number;
		name: string;
	};

	@ApiPropertyOptional()
	externalWard?: {
		id: number;
		name: string;
	};
}
