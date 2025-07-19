import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import configuration from './configuration';
import { validationSchema } from './validation';

@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			load: [configuration],
			validationSchema,
			validationOptions: {
				allowUnknown: true, // Allow other env vars
				abortEarly: false, // Show all validation errors
			},
			isGlobal: true,
			cache: true, // Cache config for performance
		}),
	],
	providers: [AppConfigService],
	exports: [NestConfigModule, AppConfigService],
})
export class ConfigModule {}
