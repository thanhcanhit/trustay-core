import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Get services
	const loggerService = app.get(LoggerService);
	const configService = app.get(AppConfigService);

	// Use custom logger
	app.useLogger(loggerService);

	// Get port from config
	const port = configService.port;
	const environment = configService.environment;

	await app.listen(port);

	loggerService.log(`Application is running on port ${port} in ${environment} mode`, 'Bootstrap');
}

bootstrap().catch((error) => {
	console.error('Application failed to start', error);
});
