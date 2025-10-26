import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, CostType } from '@prisma/client';
import { SystemCostTypeDto } from './system-cost-type.dto';

export class RoomCostDto {
	@ApiProperty({ description: 'Unique identifier' })
	id: string;

	@ApiProperty({ description: 'Associated system cost type', type: SystemCostTypeDto })
	costTypeTemplate: SystemCostTypeDto;

	@ApiProperty({
		description: 'Type of cost calculation',
		enum: CostType,
		example: 'fixed',
	})
	costType: CostType;

	@ApiPropertyOptional({
		description: 'Legacy base rate (for backward compatibility)',
		example: '3500.00',
	})
	baseRate?: string;

	@ApiPropertyOptional({
		description: 'Price per unit (for per_unit and metered costs)',
		example: '3500.00',
	})
	unitPrice?: string;

	@ApiPropertyOptional({
		description: 'Fixed amount (for fixed costs)',
		example: '100000.00',
	})
	fixedAmount?: string;

	@ApiProperty({ description: 'Currency code', example: 'VND' })
	currency: string;

	@ApiPropertyOptional({
		description: 'Unit override (overrides SystemCostType defaultUnit)',
		example: 'kWh',
	})
	unit?: string;

	@ApiPropertyOptional({
		description: 'Minimum charge amount',
		example: '50000.00',
	})
	minimumCharge?: string;

	@ApiPropertyOptional({
		description: 'Maximum charge amount',
		example: '500000.00',
	})
	maximumCharge?: string;

	@ApiProperty({
		description: 'Whether this cost is metered (requires meter readings)',
		example: false,
	})
	isMetered: boolean;

	@ApiPropertyOptional({
		description: 'Current meter reading',
		example: '150.5',
	})
	meterReading?: string;

	@ApiPropertyOptional({
		description: 'Previous meter reading',
		example: '120.2',
	})
	lastMeterReading?: string;

	@ApiProperty({
		description: 'Billing cycle for this cost',
		enum: BillingCycle,
		example: 'monthly',
	})
	billingCycle: BillingCycle;

	@ApiProperty({
		description: 'Whether this cost is included in rent',
		example: false,
	})
	includedInRent: boolean;

	@ApiProperty({
		description: 'Whether this cost is optional for tenants',
		example: false,
	})
	isOptional: boolean;

	@ApiPropertyOptional({ description: 'Additional notes about this cost' })
	notes?: string;

	@ApiProperty({ description: 'Whether this cost is active' })
	isActive: boolean;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;

	@ApiProperty({ description: 'Last update timestamp' })
	updatedAt: Date;
}

export class CreateRoomCostDto {
	@ApiProperty({ description: 'System cost type ID' })
	costTypeTemplateId: string;

	@ApiProperty({
		description: 'Type of cost calculation',
		enum: CostType,
		default: CostType.fixed,
	})
	costType: CostType;

	@ApiPropertyOptional({ description: 'Legacy base rate (for backward compatibility)' })
	baseRate?: string;

	@ApiPropertyOptional({ description: 'Price per unit (for per_unit and metered costs)' })
	unitPrice?: string;

	@ApiPropertyOptional({ description: 'Fixed amount (for fixed costs)' })
	fixedAmount?: string;

	@ApiPropertyOptional({ description: 'Currency code', default: 'VND' })
	currency?: string;

	@ApiPropertyOptional({ description: 'Unit override' })
	unit?: string;

	@ApiPropertyOptional({ description: 'Minimum charge amount' })
	minimumCharge?: string;

	@ApiPropertyOptional({ description: 'Maximum charge amount' })
	maximumCharge?: string;

	@ApiPropertyOptional({ description: 'Whether this cost is metered', default: false })
	isMetered?: boolean;

	@ApiPropertyOptional({ description: 'Current meter reading' })
	meterReading?: string;

	@ApiPropertyOptional({ description: 'Previous meter reading' })
	lastMeterReading?: string;

	@ApiProperty({
		description: 'Billing cycle for this cost',
		enum: BillingCycle,
		default: BillingCycle.monthly,
	})
	billingCycle: BillingCycle;

	@ApiPropertyOptional({ description: 'Whether this cost is included in rent', default: false })
	includedInRent?: boolean;

	@ApiPropertyOptional({ description: 'Whether this cost is optional for tenants', default: false })
	isOptional?: boolean;

	@ApiPropertyOptional({ description: 'Additional notes about this cost' })
	notes?: string;
}

export class UpdateRoomCostDto {
	@ApiPropertyOptional({
		description: 'Type of cost calculation',
		enum: CostType,
	})
	costType?: CostType;

	@ApiPropertyOptional({ description: 'Legacy base rate (for backward compatibility)' })
	baseRate?: string;

	@ApiPropertyOptional({ description: 'Price per unit (for per_unit and metered costs)' })
	unitPrice?: string;

	@ApiPropertyOptional({ description: 'Fixed amount (for fixed costs)' })
	fixedAmount?: string;

	@ApiPropertyOptional({ description: 'Currency code' })
	currency?: string;

	@ApiPropertyOptional({ description: 'Unit override' })
	unit?: string;

	@ApiPropertyOptional({ description: 'Minimum charge amount' })
	minimumCharge?: string;

	@ApiPropertyOptional({ description: 'Maximum charge amount' })
	maximumCharge?: string;

	@ApiPropertyOptional({ description: 'Whether this cost is metered' })
	isMetered?: boolean;

	@ApiPropertyOptional({ description: 'Current meter reading' })
	meterReading?: string;

	@ApiPropertyOptional({ description: 'Previous meter reading' })
	lastMeterReading?: string;

	@ApiPropertyOptional({
		description: 'Billing cycle for this cost',
		enum: BillingCycle,
	})
	billingCycle?: BillingCycle;

	@ApiPropertyOptional({ description: 'Whether this cost is included in rent' })
	includedInRent?: boolean;

	@ApiPropertyOptional({ description: 'Whether this cost is optional for tenants' })
	isOptional?: boolean;

	@ApiPropertyOptional({ description: 'Additional notes about this cost' })
	notes?: string;

	@ApiPropertyOptional({ description: 'Whether this cost is active' })
	isActive?: boolean;
}
