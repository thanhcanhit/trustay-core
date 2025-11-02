import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PasswordService } from './auth/services/password.service';
import { AppConfigService } from './config/config.service';
import { LoggerService } from './logger/logger.service';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.set('trust proxy', 1);

	// Get services
	const loggerService = app.get(LoggerService);
	const configService = app.get(AppConfigService);
	const prismaService = app.get(PrismaService);
	const passwordService = app.get(PasswordService);
	const jwtService = app.get(JwtService);

	// Use custom logger
	app.useLogger(loggerService);

	// Enable CORS
	app.enableCors({
		origin: true,
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		credentials: true,
	});

	// Set global prefix for API routes (excluding root, health, and images endpoints)
	app.setGlobalPrefix('api', {
		exclude: [
			{ path: '', method: RequestMethod.GET },
			{ path: 'health', method: RequestMethod.GET },
			{ path: 'images/(.*)', method: RequestMethod.GET },
			{ path: '128x128/images/(.*)', method: RequestMethod.GET },
			{ path: '256x256/images/(.*)', method: RequestMethod.GET },
			{ path: '512x512/images/(.*)', method: RequestMethod.GET },
			{ path: '1024x1024/images/(.*)', method: RequestMethod.GET },
			{ path: '1920x1080/images/(.*)', method: RequestMethod.GET },
		],
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
		.addBearerAuth({
			type: 'http',
			scheme: 'bearer',
			bearerFormat: 'JWT',
			in: 'header',
		})
		.build();

	const document = SwaggerModule.createDocument(app, config);

	let customJsPath: string | undefined;
	let devToken: string | undefined;

	// Seed a default user for development/testing and generate a JWT for Swagger
	if (configService.isDevelopment) {
		try {
			const DEFAULT_USER = {
				email: 'dev.user@trustay.local',
				password: 'DevUser#2025',
				firstName: 'Dev',
				lastName: 'User',
				role: 'tenant' as const,
			};

			const existingUser = await prismaService.user.findUnique({
				where: { email: DEFAULT_USER.email },
				select: { id: true },
			});

			let userId = existingUser?.id as string | undefined;
			if (!userId) {
				const passwordHash = await passwordService.hashPassword(DEFAULT_USER.password);
				const createdUser = await prismaService.user.create({
					data: {
						email: DEFAULT_USER.email,
						passwordHash,
						firstName: DEFAULT_USER.firstName,
						lastName: DEFAULT_USER.lastName,
						role: DEFAULT_USER.role,
						isVerifiedEmail: true,
						isVerifiedPhone: true,
						isVerifiedIdentity: false,
						isVerifiedBank: false,
					},
					select: { id: true },
				});
				userId = createdUser.id;
			}

			devToken = await jwtService.signAsync({
				sub: userId!,
				email: DEFAULT_USER.email,
				role: DEFAULT_USER.role,
			});

			// Expose a small JS to auto authorize Swagger with the dev token
			customJsPath = '/swagger-init.js';
			const httpAdapter = app.getHttpAdapter().getInstance();
			httpAdapter.get(customJsPath, (_req: unknown, res: any) => {
				res
					.type('application/javascript')
					.send(
						`window.addEventListener('load', function(){ if (window.ui && window.ui.preauthorizeApiKey) { window.ui.preauthorizeApiKey('bearer', '${devToken}'); } });`,
					);
			});

			loggerService.log(
				`Default dev user ready: ${DEFAULT_USER.email}\nBearer token: ${devToken}`,
				'Bootstrap',
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			loggerService.error('Failed to prepare default dev user', message, 'Bootstrap');
		}
	}

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
		customJs: customJsPath ? [customJsPath] : undefined,
	});

	// Get port from config
	const port = configService.port;
	const environment = configService.environment;

	await app.listen(port, '0.0.0.0');

	loggerService.log(`Trustay core is running on port ${port} in ${environment} mode`, 'Bootstrap');
	loggerService.log(
		`Swagger documentation is available at http://localhost:${port}/api/docs`,
		'Bootstrap',
	);
}

bootstrap().catch((error) => {
	console.error('Application failed to start', error);
});
