import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RoomImageItemDto {
	@ApiProperty({
		description: 'Path của hình ảnh (từ upload service)',
		example: '/images/1757854142834-a76f44bd-19d60dce93ed8871.jpg',
	})
	@IsString()
	path: string;

	@ApiPropertyOptional({
		description: 'Alt text cho hình ảnh',
		example: 'KHAI TRƯƠNG TOÀ NHÀ MỚI XÂY GIÁ CHỈ 3 TRIỆU 8',
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	alt?: string;

	@ApiPropertyOptional({
		description: 'Có phải ảnh chính không (nếu không có thì ảnh đầu tiên sẽ là primary)',
		example: true,
	})
	@IsOptional()
	@IsBoolean()
	isPrimary?: boolean;

	@ApiPropertyOptional({
		description: 'Thứ tự sắp xếp ảnh (nếu không có thì sẽ theo thứ tự trong array)',
		example: 0,
		minimum: 0,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	sortOrder?: number;
}

export class CreateRoomImageDto {
	@ApiProperty({
		description: 'Danh sách hình ảnh phòng',
		type: [RoomImageItemDto],
		example: [
			{
				path: '/images/1757854142834-a76f44bd-19d60dce93ed8871.jpg',
				alt: 'KHAI TRƯƠNG TOÀ NHÀ MỚI XÂY GIÁ CHỈ 3 TRIỆU 8',
				isPrimary: true,
				sortOrder: 0,
			},
			{
				path: '/images/1757854142835-a76f44be-19d60dce93ed8872.jpg',
			},
			{
				path: '/images/1757854142836-a76f44bf-19d60dce93ed8873.jpg',
				alt: 'Hình ảnh phòng',
			},
		],
	})
	@IsArray()
	@Type(() => RoomImageItemDto)
	images: RoomImageItemDto[];
}

export class UpdateRoomImageDto {
	@ApiPropertyOptional({
		description: 'Danh sách hình ảnh phòng - GHI ĐÈ HOÀN TOÀN danh sách cũ',
		type: [RoomImageItemDto],
		example: [
			{
				path: '/images/1757854142834-a76f44bd-19d60dce93ed8871.jpg',
				alt: 'KHAI TRƯƠNG TOÀ NHÀ MỚI XÂY GIÁ CHỈ 3 TRIỆU 8',
				isPrimary: true,
				sortOrder: 0,
			},
			{
				path: '/images/1757854142835-a76f44be-19d60dce93ed8872.jpg',
			},
			{
				path: '/images/1757854142836-a76f44bf-19d60dce93ed8873.jpg',
				alt: 'Hình ảnh phòng',
			},
		],
	})
	@IsOptional()
	@IsArray()
	@Type(() => RoomImageItemDto)
	images?: RoomImageItemDto[];
}
