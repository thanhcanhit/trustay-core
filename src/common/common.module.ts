import { Module } from '@nestjs/common';
import { StaticFilesController } from './controllers/static-files.controller';
import { UploadModule } from './upload/upload.module';

@Module({
	imports: [UploadModule],
	controllers: [StaticFilesController],
	exports: [UploadModule],
})
export class CommonModule {}
