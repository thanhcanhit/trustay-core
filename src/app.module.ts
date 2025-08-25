import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { BuildingModule } from './api/buildings/building.module';
import { ListingModule } from './api/listing/listing.module';
import { AddressModule } from './api/provinces/address/address.module';
import { DistrictModule } from './api/provinces/district/district.module';
import { ProvinceModule } from './api/provinces/province/province.module';
import { WardModule } from './api/provinces/ward/ward.module';
import { ReferenceModule } from './api/reference/reference.module';
import { RoomRequestModule } from './api/room-request/room-request.module';
import { RoomsModule } from './api/rooms/rooms.module';
import { UsersModule } from './api/users/users.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
	imports: [
		ConfigModule,
		LoggerModule,
		PrismaModule,
		CommonModule,
		ProvinceModule,
		DistrictModule,
		WardModule,
		AddressModule,
		UsersModule,
		AuthModule,
		BuildingModule,
		ListingModule,
		ReferenceModule,
		RoomsModule,
		RoomRequestModule,
	],
	controllers: [AppController],
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: LoggingInterceptor,
		},
		{
			provide: APP_FILTER,
			useClass: AllExceptionsFilter,
		},
	],
})
export class AppModule {}
