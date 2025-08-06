import { ApiProperty } from '@nestjs/swagger';

export class EnumValuesDto {
	@ApiProperty({ description: 'Gender options', example: ['MALE', 'FEMALE', 'OTHER'] })
	gender: string[];

	@ApiProperty({ description: 'User roles', example: ['TENANT', 'LANDLORD'] })
	userRole: string[];

	@ApiProperty({
		description: 'Room types',
		example: ['BOARDING_HOUSE', 'DORMITORY', 'SLEEPBOX', 'APARTMENT', 'WHOLE_HOUSE'],
	})
	roomType: string[];

	@ApiProperty({
		description: 'Booking statuses',
		example: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
	})
	bookingStatus: string[];

	@ApiProperty({
		description: 'Rental statuses',
		example: ['ACTIVE', 'TERMINATED', 'EXPIRED', 'PENDING_RENEWAL'],
	})
	rentalStatus: string[];

	@ApiProperty({
		description: 'Invitation statuses',
		example: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
	})
	invitationStatus: string[];

	@ApiProperty({
		description: 'Bill statuses',
		example: ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
	})
	billStatus: string[];

	@ApiProperty({
		description: 'Payment types',
		example: ['RENT', 'DEPOSIT', 'UTILITY', 'FEE', 'REFUND'],
	})
	paymentType: string[];

	@ApiProperty({
		description: 'Payment methods',
		example: ['BANK_TRANSFER', 'CASH', 'E_WALLET', 'CARD'],
	})
	paymentMethod: string[];

	@ApiProperty({
		description: 'Payment statuses',
		example: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
	})
	paymentStatus: string[];

	@ApiProperty({ description: 'Reviewer types', example: ['TENANT', 'OWNER'] })
	reviewerType: string[];

	@ApiProperty({
		description: 'Amenity categories',
		example: [
			'BASIC',
			'KITCHEN',
			'BATHROOM',
			'ENTERTAINMENT',
			'SAFETY',
			'CONNECTIVITY',
			'BUILDING',
		],
	})
	amenityCategory: string[];

	@ApiProperty({
		description: 'Cost categories',
		example: ['UTILITY', 'SERVICE', 'PARKING', 'MAINTENANCE'],
	})
	costCategory: string[];

	@ApiProperty({
		description: 'Rule categories',
		example: ['SMOKING', 'PETS', 'VISITORS', 'NOISE', 'CLEANLINESS', 'SECURITY', 'USAGE', 'OTHER'],
	})
	ruleCategory: string[];

	@ApiProperty({
		description: 'Rule types',
		example: ['ALLOWED', 'FORBIDDEN', 'REQUIRED', 'CONDITIONAL'],
	})
	ruleType: string[];

	@ApiProperty({
		description: 'Cost types',
		example: ['FIXED', 'PER_UNIT', 'METERED', 'PERCENTAGE', 'TIERED'],
	})
	costType: string[];

	@ApiProperty({
		description: 'Billing cycles',
		example: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'PER_USE'],
	})
	billingCycle: string[];

	@ApiProperty({
		description: 'Visibility options',
		example: ['ANYONECANFIND', 'ANYONEWITHLINK', 'DOMAINCANFIND', 'DOMAINWITHLINK', 'LIMITED'],
	})
	visibility: string[];

	@ApiProperty({
		description: 'Search post statuses',
		example: ['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'],
	})
	searchPostStatus: string[];

	@ApiProperty({ description: 'Verification types', example: ['EMAIL', 'PHONE', 'PASSWORD_RESET'] })
	verificationType: string[];

	@ApiProperty({
		description: 'Verification statuses',
		example: ['PENDING', 'VERIFIED', 'EXPIRED', 'FAILED'],
	})
	verificationStatus: string[];
}

export class SimpleAmenityDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	category: string;

	@ApiProperty()
	description?: string;
}

export class SimpleCostTypeDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	category: string;

	@ApiProperty()
	defaultUnit?: string;
}

export class SimpleRuleDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	category: string;

	@ApiProperty()
	ruleType: string;

	@ApiProperty()
	description?: string;
}

export class AllReferenceDataDto {
	@ApiProperty({ type: [SimpleAmenityDto], description: 'All available amenities' })
	amenities: SimpleAmenityDto[];

	@ApiProperty({ type: [SimpleCostTypeDto], description: 'All available cost types' })
	costTypes: SimpleCostTypeDto[];

	@ApiProperty({ type: [SimpleRuleDto], description: 'All available room rules' })
	rules: SimpleRuleDto[];

	@ApiProperty({ type: EnumValuesDto, description: 'All enum values for dropdowns and validation' })
	enums: EnumValuesDto;
}
