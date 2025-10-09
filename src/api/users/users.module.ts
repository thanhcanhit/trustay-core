import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadModule } from '../../common/upload/upload.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RatingModule } from '../rating/rating.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
	imports: [
		PrismaModule,
		UploadModule,
		NotificationsModule,
		RatingModule,
		MulterModule.register({
			storage: undefined,
			limits: {
				fileSize: 10 * 1024 * 1024, // 10MB limit
				files: 1,
			},
		}),
	],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
