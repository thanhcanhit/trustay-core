import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { LoggerService } from "./logger/logger.service";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Use custom logger
	const loggerService = app.get(LoggerService);
	app.useLogger(loggerService);

	const port = process.env.PORT || 3000;
	await app.listen(port);

	loggerService.log(`Application is running on port ${port}`, "Bootstrap");
}

bootstrap().catch((error) => {
	console.error("Application failed to start", error);
});
