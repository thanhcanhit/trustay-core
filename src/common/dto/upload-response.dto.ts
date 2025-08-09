import { ApiProperty } from '@nestjs/swagger';

export class ImageSizeResponseDto {
	@ApiProperty({ description: 'Thumbnail size (128x128)' })
	thumb: string;

	@ApiProperty({ description: 'Small size (256x256)' })
	small: string;

	@ApiProperty({ description: 'Medium size (512x512)' })
	medium: string;

	@ApiProperty({ description: 'Large size (1024x1024)' })
	large: string;

	@ApiProperty({ description: 'HD size (1920x1080)' })
	hd: string;
}

export class UploadResponseDto {
	@ApiProperty({
		description: 'Image path - use with size prefix for different sizes',
		example: '/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg',
	})
	imagePath: string;

	@ApiProperty({ description: 'Whether image was saved to database' })
	savedToDb: boolean;

	@ApiProperty({ description: 'Database image ID if saved', required: false })
	imageId?: string;
}

export class MultipleUploadResponseDto {
	@ApiProperty({ type: [UploadResponseDto], description: 'Array of upload results' })
	results: UploadResponseDto[];

	@ApiProperty({ description: 'Total number of uploaded images' })
	total: number;
}

export class DeleteImageResponseDto {
	@ApiProperty({ description: 'Whether image was successfully deleted' })
	success: boolean;

	@ApiProperty({ description: 'Result message' })
	message: string;
}
