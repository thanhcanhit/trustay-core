import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UploadRequestDto {
	@ApiProperty({ description: 'Alt text for the image', required: false })
	@IsOptional()
	@IsString()
	altText?: string;
}

export class MultipleUploadRequestDto {
	@ApiProperty({
		type: [String],
		description: 'Alt texts for multiple images',
		required: false,
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	altTexts?: string[];
}

export class UpdateImageOrderDto {
	@ApiProperty({ description: 'Image ID' })
	@IsString()
	id: string;

	@ApiProperty({ description: 'Sort order' })
	sortOrder: number;
}

export class UpdateRoomImageOrderDto {
	@ApiProperty({ type: [UpdateImageOrderDto], description: 'Array of image order updates' })
	@IsArray()
	imageOrders: UpdateImageOrderDto[];
}
