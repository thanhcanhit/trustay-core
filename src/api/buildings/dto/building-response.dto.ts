import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class BuildingLocationDto {
	@ApiProperty({ example: 'Phường 1' })
	@Expose()
	wardName?: string;

	@ApiProperty({ example: 'Quận 1' })
	@Expose()
	districtName: string;

	@ApiProperty({ example: 'Thành phố Hồ Chí Minh' })
	@Expose()
	provinceName: string;
}

export class BuildingOwnerDto {
	@ApiProperty({ example: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'Nguyễn Văn A' })
	@Expose()
	@Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
	fullName: string;

	@ApiPropertyOptional({ example: 'avatar.jpg' })
	@Expose()
	avatarUrl?: string;

	@ApiProperty({ example: true })
	@Expose()
	isVerifiedIdentity: boolean;
}

export class BuildingResponseDto {
	@ApiProperty({ example: 'nha-tro-minh-phat-quan-1' })
	@Expose()
	id: string;

	@ApiProperty({ example: 'nha-tro-minh-phat-quan-1' })
	@Expose()
	slug: string;

	@ApiProperty({ example: 'Nhà trọ Minh Phát' })
	@Expose()
	name: string;

	@ApiPropertyOptional({ example: 'Nhà trọ cao cấp gần trường ĐH' })
	@Expose()
	description?: string;

	@ApiProperty({ example: '123 Đường Võ Văn Ngân' })
	@Expose()
	addressLine1: string;

	@ApiPropertyOptional({ example: 'Hẻm 456' })
	@Expose()
	addressLine2?: string;

	@ApiProperty({ example: 'Vietnam' })
	@Expose()
	country: string;

	@ApiPropertyOptional({ example: 10.7626 })
	@Expose()
	@Transform(({ value }) => {
		if (value === null || value === undefined) {
			return undefined;
		}
		try {
			return parseFloat(value.toString());
		} catch {
			return undefined;
		}
	})
	latitude?: number;

	@ApiPropertyOptional({ example: 106.6834 })
	@Expose()
	@Transform(({ value }) => {
		if (value === null || value === undefined) {
			return undefined;
		}
		try {
			return parseFloat(value.toString());
		} catch {
			return undefined;
		}
	})
	longitude?: number;

	@ApiProperty({ example: true })
	@Expose()
	isActive: boolean;

	@ApiProperty({ example: false })
	@Expose()
	isVerified: boolean;

	@ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
	@Expose()
	createdAt: Date;

	@ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
	@Expose()
	updatedAt: Date;

	@ApiProperty({ type: BuildingLocationDto })
	@Expose()
	location: BuildingLocationDto;

	@ApiProperty({ type: BuildingOwnerDto })
	@Expose()
	owner: BuildingOwnerDto;

	@ApiPropertyOptional({ example: 5 })
	@Expose()
	roomCount?: number;

	@ApiPropertyOptional({ example: 15 })
	@Expose()
	availableRoomCount?: number;
}
