import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RoommateSeekingPostController } from './roommate-seeking-post.controller';
import { RoommateSeekingPostService } from './roommate-seeking-post.service';

@Module({
	imports: [PrismaModule],
	controllers: [RoommateSeekingPostController],
	providers: [RoommateSeekingPostService],
	exports: [RoommateSeekingPostService],
})
export class RoommateSeekingPostModule {}
