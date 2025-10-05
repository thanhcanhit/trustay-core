import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BookingRequestsModule } from './api/booking-requests/booking-requests.module';
import { BuildingModule } from './api/buildings/building.module';
import { ChatModule } from './api/chat/chat.module';
import { ContractsModule } from './api/contracts/contracts.module';
import { ListingModule } from './api/listing/listing.module';
import { NotificationsModule } from './api/notifications/notifications.module';
import { PaymentsModule } from './api/payments/payments.module';
import { AddressModule } from './api/provinces/address/address.module';
import { DistrictModule } from './api/provinces/district/district.module';
import { ProvinceModule } from './api/provinces/province/province.module';
import { WardModule } from './api/provinces/ward/ward.module';
import { RatingModule } from './api/rating/rating.module';
import { ReferenceModule } from './api/reference/reference.module';
import { RentalsModule } from './api/rentals/rentals.module';
import { RoomInvitationsModule } from './api/room-invitations/room-invitations.module';
import { RoomSeekingPostModule } from './api/room-seeking-post/room-seeking-post.module';
import { RoommateApplicationModule } from './api/roommate-application/roommate-application.module';
import { RoommateSeekingPostModule } from './api/roommate-seeking-post/roommate-seeking-post.module';
import { RoomsModule } from './api/rooms/rooms.module';
import { TenantPreferencesModule } from './api/tenant-preferences/tenant-preferences.module';
import { UsersModule } from './api/users/users.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CacheConfigModule } from './cache/cache.module';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
	imports: [
		ConfigModule,
		CacheConfigModule,
		ThrottlerModule.forRootAsync({
			inject: [AppConfigService],
			useFactory: (config: AppConfigService) => ({
				throttlers: [
					{
						ttl: config.rateLimitConfig.ttl,
						limit: config.rateLimitConfig.limit,
					},
				],
				errorMessage: 'Too many requests. Please try again later.',
			}),
		}),
		LoggerModule,
		PrismaModule,
		CommonModule,
		ProvinceModule,
		DistrictModule,
		WardModule,
		AddressModule,
		UsersModule,
		AuthModule,
		BookingRequestsModule,
		BuildingModule,
		ContractsModule,
		ListingModule,
		ReferenceModule,
		NotificationsModule,
		PaymentsModule,
		RatingModule,
		RentalsModule,
		RoomInvitationsModule,
		RoomsModule,
		RoomSeekingPostModule,
		RoommateSeekingPostModule,
		RoommateApplicationModule,
		TenantPreferencesModule,
		RealtimeModule,
		ChatModule,
	],
	controllers: [AppController],
	providers: [
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
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
