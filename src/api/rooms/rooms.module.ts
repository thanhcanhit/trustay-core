import { Module } from '@nestjs/common';
import { UploadService } from '../../common/services/upload.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
	imports: [PrismaModule],
	controllers: [RoomsController],
	providers: [RoomsService, UploadService],
	exports: [RoomsService],
})
export class RoomsModule {}
