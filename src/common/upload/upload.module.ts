import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadService } from '../services/upload.service';
import { UploadController } from './upload.controller';

@Module({
	imports: [
		PrismaModule,
		ConfigModule,
		MulterModule.register({
			storage: undefined, // Use memory storage để xử lý file trong memory
			limits: {
				fileSize: 10 * 1024 * 1024, // 10MB limit
				files: 10, // Maximum 10 files
			},
			// Remove fileFilter - let controller handle validation for better error responses
		}),
	],
	controllers: [UploadController],
	providers: [UploadService],
	exports: [UploadService],
})
export class UploadModule {}
