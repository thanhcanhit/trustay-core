import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LandlordController } from './landlord.controller';
import { LandlordService } from './landlord.service';

@Module({
	imports: [PrismaModule],
	controllers: [LandlordController],
	providers: [LandlordService],
})
export class LandlordModule {}
