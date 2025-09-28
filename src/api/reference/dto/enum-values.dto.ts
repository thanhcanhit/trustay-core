import { ApiProperty } from '@nestjs/swagger';
export class EnumValueDto {
	@ApiProperty({ description: 'Enum key' })
	key: string;

	@ApiProperty({ description: 'Display value' })
	value: string;

	@ApiProperty({ description: 'Description of the enum value' })
	description?: string;
}

export class EnumCollectionDto {
	@ApiProperty({ description: 'Enum name' })
	enumName: string;

	@ApiProperty({
		description: 'List of enum values',
		type: [EnumValueDto],
	})
	values: EnumValueDto[];
}

export class AllEnumsResponseDto {
	@ApiProperty({
		description: 'Room types',
		type: [EnumValueDto],
	})
	roomTypes: EnumValueDto[];

	@ApiProperty({
		description: 'Gender options',
		type: [EnumValueDto],
	})
	genders: EnumValueDto[];

	@ApiProperty({
		description: 'User roles',
		type: [EnumValueDto],
	})
	userRoles: EnumValueDto[];

	@ApiProperty({
		description: 'Booking statuses',
		type: [EnumValueDto],
	})
	bookingStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Rental statuses',
		type: [EnumValueDto],
	})
	rentalStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Invitation statuses',
		type: [EnumValueDto],
	})
	invitationStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Bill statuses',
		type: [EnumValueDto],
	})
	billStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Payment types',
		type: [EnumValueDto],
	})
	paymentTypes: EnumValueDto[];

	@ApiProperty({
		description: 'Payment methods',
		type: [EnumValueDto],
	})
	paymentMethods: EnumValueDto[];

	@ApiProperty({
		description: 'Payment statuses',
		type: [EnumValueDto],
	})
	paymentStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Reviewer types',
		type: [EnumValueDto],
	})
	reviewerTypes: EnumValueDto[];

	@ApiProperty({
		description: 'Amenity categories',
		type: [EnumValueDto],
	})
	amenityCategories: EnumValueDto[];

	@ApiProperty({
		description: 'Cost categories',
		type: [EnumValueDto],
	})
	costCategories: EnumValueDto[];

	@ApiProperty({
		description: 'Visibility options',
		type: [EnumValueDto],
	})
	visibilityOptions: EnumValueDto[];

	@ApiProperty({
		description: 'Search post statuses',
		type: [EnumValueDto],
	})
	searchPostStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Verification types',
		type: [EnumValueDto],
	})
	verificationTypes: EnumValueDto[];

	@ApiProperty({
		description: 'Verification statuses',
		type: [EnumValueDto],
	})
	verificationStatuses: EnumValueDto[];

	@ApiProperty({
		description: 'Cost types',
		type: [EnumValueDto],
	})
	costTypes: EnumValueDto[];

	@ApiProperty({
		description: 'Billing cycles',
		type: [EnumValueDto],
	})
	billingCycles: EnumValueDto[];

	@ApiProperty({
		description: 'Rule categories',
		type: [EnumValueDto],
	})
	ruleCategories: EnumValueDto[];
}
