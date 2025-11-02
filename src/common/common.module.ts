import { Module } from '@nestjs/common';
import { SizedImagesController } from './controllers/sized-images.controller';
import { StaticFilesController } from './controllers/static-files.controller';
import { WellKnownController } from './controllers/well-known.controller';
import { UploadModule } from './upload/upload.module';

@Module({
	imports: [UploadModule],
	controllers: [StaticFilesController, SizedImagesController, WellKnownController],
	exports: [UploadModule],
})
export class CommonModule {}
