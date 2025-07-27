import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminUsersController } from './admin-users.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
	imports: [PrismaModule],
	controllers: [UsersController, AdminUsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
