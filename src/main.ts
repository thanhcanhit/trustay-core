import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

	// Enable CORS
	app.enableCors({
		origin: true,
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		credentials: true,
	});

	// Global validation pipe
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	// Swagger configuration
	const config = new DocumentBuilder()
		.setTitle('TrustStay Core')
		.setDescription('API documentation for TrustStay room rental platform')
		.setVersion('1.0')
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api/docs', app, document, {
		swaggerOptions: {
			persistAuthorization: true,
			displayRequestDuration: true,
			docExpansion: 'none',
			filter: true,
			showRequestHeaders: true,
			tryItOutEnabled: true,
			operationsSorter: 'method',
			tagsSorter: 'alpha',
			defaultModelsExpandDepth: 2,
			defaultModelExpandDepth: 2,
			displayOperationId: false,
			showExtensions: false,
			showCommonExtensions: false,
			useUnsafeMarkdown: false,
		},
		customSiteTitle: 'TrustStay 2025',
	});

	// Get port from config
	const port = configService.port;
	const environment = configService.environment;

	await app.listen(port);

	loggerService.log(`Trustay core is running on port ${port} in ${environment} mode`, 'Bootstrap');
	loggerService.log(
		`Swagger documentation is available at http://localhost:${port}/api/docs`,
		'Bootstrap',
	);
}

bootstrap().catch((error) => {
	console.error('Application failed to start', error);
});
