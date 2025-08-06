import { ApiProperty } from '@nestjs/swagger';

export class EnumValuesDto {
	@ApiProperty({ description: 'Gender options', example: ['male', 'female', 'other'] })
	gender: string[];

	@ApiProperty({ description: 'User roles', example: ['tenant', 'landlord'] })
	userRole: string[];

	@ApiProperty({ description: 'Room types', example: ['single', 'double', 'suite', 'dormitory'] })
	roomType: string[];

	@ApiProperty({
		description: 'Booking statuses',
		example: ['pending', 'approved', 'rejected', 'cancelled'],
	})
	bookingStatus: string[];

	@ApiProperty({
		description: 'Rental statuses',
		example: ['active', 'terminated', 'expired', 'pending_renewal'],
	})
	rentalStatus: string[];

	@ApiProperty({
		description: 'Invitation statuses',
		example: ['pending', 'accepted', 'declined', 'expired'],
	})
	invitationStatus: string[];

	@ApiProperty({
		description: 'Bill statuses',
		example: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
	})
	billStatus: string[];

	@ApiProperty({
		description: 'Payment types',
		example: ['rent', 'deposit', 'utility', 'fee', 'refund'],
	})
	paymentType: string[];

	@ApiProperty({
		description: 'Payment methods',
		example: ['bank_transfer', 'cash', 'e_wallet', 'card'],
	})
	paymentMethod: string[];

	@ApiProperty({
		description: 'Payment statuses',
		example: ['pending', 'completed', 'failed', 'refunded'],
	})
	paymentStatus: string[];

	@ApiProperty({ description: 'Reviewer types', example: ['tenant', 'owner'] })
	reviewerType: string[];

	@ApiProperty({
		description: 'Amenity categories',
		example: [
			'basic',
			'kitchen',
			'bathroom',
			'entertainment',
			'safety',
			'connectivity',
			'building',
		],
	})
	amenityCategory: string[];

	@ApiProperty({
		description: 'Cost categories',
		example: ['utility', 'service', 'parking', 'maintenance'],
	})
	costCategory: string[];

	@ApiProperty({
		description: 'Rule categories',
		example: ['smoking', 'pets', 'visitors', 'noise', 'cleanliness', 'security', 'usage', 'other'],
	})
	ruleCategory: string[];

	@ApiProperty({
		description: 'Cost types',
		example: ['fixed', 'per_unit', 'metered', 'percentage', 'tiered'],
	})
	costType: string[];

	@ApiProperty({
		description: 'Billing cycles',
		example: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'per_use'],
	})
	billingCycle: string[];

	@ApiProperty({
		description: 'Visibility options',
		example: ['anyoneCanFind', 'anyoneWithLink', 'domainCanFind', 'domainWithLink', 'limited'],
	})
	visibility: string[];

	@ApiProperty({
		description: 'Search post statuses',
		example: ['active', 'paused', 'closed', 'expired'],
	})
	searchPostStatus: string[];

	@ApiProperty({ description: 'Verification types', example: ['email', 'phone', 'password_reset'] })
	verificationType: string[];

	@ApiProperty({
		description: 'Verification statuses',
		example: ['pending', 'verified', 'expired', 'failed'],
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
	iconUrl?: string;

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
