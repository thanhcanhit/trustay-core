import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	NotFoundException,
	Param,
	Post,
	Put,
	UploadedFile,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MultipleUploadRequestDto, UploadRequestDto } from '../dto/upload-request.dto';
import { MultipleUploadResponseDto, UploadResponseDto } from '../dto/upload-response.dto';
import { UploadService } from '../services/upload.service';

@ApiTags('Upload')
@Controller('upload')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	@Post()
	@UseInterceptors(FileInterceptor('file'))
	@ApiOperation({ summary: 'Upload single image' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
					description: 'Image file to upload',
				},
				altText: {
					type: 'string',
					description: 'Alt text for the image',
				},
			},
			required: ['file'],
		},
	})
	@ApiResponse({ type: UploadResponseDto })
	async uploadImage(
		@UploadedFile() file: Express.Multer.File,
		@Body() uploadRequest: UploadRequestDto,
		@CurrentUser() user: User,
	): Promise<UploadResponseDto> {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}

		if (!file.mimetype.startsWith('image/')) {
			throw new BadRequestException('File must be an image');
		}

		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			throw new BadRequestException('File size must be less than 10MB');
		}

		const result = await this.uploadService.uploadImage(file, uploadRequest);

		return result;
	}

	@Post('bulk')
	@UseInterceptors(FilesInterceptor('files', 10))
	@ApiOperation({ summary: 'Upload multiple images' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				files: {
					type: 'array',
					items: {
						type: 'string',
						format: 'binary',
					},
					description: 'Array of image files to upload',
				},
				altTexts: {
					type: 'array',
					items: { type: 'string' },
					description: 'Alt texts for the images',
				},
			},
			required: ['files'],
		},
	})
	@ApiResponse({ type: MultipleUploadResponseDto })
	async uploadImages(
		@UploadedFiles() files: Express.Multer.File[],
		@Body() uploadRequest: MultipleUploadRequestDto,
		@CurrentUser() user: User,
	): Promise<MultipleUploadResponseDto> {
		if (!files || files.length === 0) {
			throw new BadRequestException('No files uploaded');
		}

		if (files.length > 10) {
			throw new BadRequestException('Maximum 10 files allowed');
		}

		const maxSize = 10 * 1024 * 1024; // 10MB
		for (const file of files) {
			if (!file.mimetype.startsWith('image/')) {
				throw new BadRequestException('All files must be images');
			}
			if (file.size > maxSize) {
				throw new BadRequestException('File size must be less than 10MB');
			}
		}

		const results = await this.uploadService.uploadMultipleImages(files, uploadRequest);

		return {
			results,
			total: results.length,
		};
	}
}
