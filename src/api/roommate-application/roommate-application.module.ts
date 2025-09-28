import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RoommateApplicationController } from './roommate-application.controller';
import { RoommateApplicationService } from './roommate-application.service';

@Module({
	imports: [PrismaModule],
	controllers: [RoommateApplicationController],
	providers: [RoommateApplicationService],
	exports: [RoommateApplicationService],
})
export class RoommateApplicationModule {}
