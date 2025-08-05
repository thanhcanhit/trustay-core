import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RuleCategory } from '@prisma/client';

export class SystemRoomRuleDto {
	@ApiProperty({ description: 'Unique identifier' })
	id: string;

	@ApiProperty({ description: 'Rule name in Vietnamese' })
	name: string;

	@ApiProperty({ description: 'Rule name in English' })
	nameEn: string;

	@ApiProperty({
		description: 'Rule category',
		enum: RuleCategory,
	})
	category: RuleCategory;

	@ApiProperty({
		description: 'Rule type',
		enum: ['allowed', 'forbidden', 'required', 'conditional'],
		example: 'forbidden',
	})
	ruleType: string;

	@ApiPropertyOptional({ description: 'Description of the rule' })
	description?: string;

	@ApiPropertyOptional({ description: 'Icon URL for the rule' })
	iconUrl?: string;

	@ApiProperty({ description: 'Whether the rule is active' })
	isActive: boolean;

	@ApiProperty({ description: 'Sort order for display' })
	sortOrder: number;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;

	@ApiProperty({ description: 'Last update timestamp' })
	updatedAt: Date;
}

export class RoomRuleDto {
	@ApiProperty({ description: 'Unique identifier' })
	id: string;

	@ApiProperty({ description: 'Associated system room rule', type: SystemRoomRuleDto })
	systemRule: SystemRoomRuleDto;

	@ApiPropertyOptional({
		description: 'Custom value or condition for this rule',
		example: 'Chỉ cho phép mèo dưới 5kg',
	})
	customValue?: string;

	@ApiProperty({
		description: 'Whether this rule is strictly enforced',
		example: true,
	})
	isEnforced: boolean;

	@ApiPropertyOptional({ description: 'Additional notes about this rule' })
	notes?: string;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;
}

export class CreateRoomRuleDto {
	@ApiProperty({ description: 'System room rule ID' })
	systemRuleId: string;

	@ApiPropertyOptional({ description: 'Custom value or condition for this rule' })
	customValue?: string;

	@ApiPropertyOptional({ description: 'Whether this rule is strictly enforced', default: true })
	isEnforced?: boolean;

	@ApiPropertyOptional({ description: 'Additional notes about this rule' })
	notes?: string;
}

export class UpdateRoomRuleDto {
	@ApiPropertyOptional({ description: 'Custom value or condition for this rule' })
	customValue?: string;

	@ApiPropertyOptional({ description: 'Whether this rule is strictly enforced' })
	isEnforced?: boolean;

	@ApiPropertyOptional({ description: 'Additional notes about this rule' })
	notes?: string;
}
